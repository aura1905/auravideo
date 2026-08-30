//! Native FFmpeg execution.
//!
//! The browser build runs FFmpeg.wasm, which is memory-capped (~2 GB usable in
//! wasm32), cannot use hardware encoders, and decodes only what the browser
//! supports. The desktop build shells out to a real ffmpeg binary instead, so
//! exports can use NVENC / QSV / AMF and read professional codecs.
//!
//! The filter graph itself is unchanged: `src/utils/export.ts` already builds a
//! plain `string[]` of ffmpeg arguments, and those arguments are handed to this
//! module verbatim. Only file resolution and process execution differ.

use once_cell::sync::Lazy;
use serde::Serialize;
use std::collections::HashMap;
use std::io::BufReader;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
/// Keep spawned ffmpeg processes from flashing a console window on Windows.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Running jobs, so the UI can cancel a long export.
static JOBS: Lazy<Mutex<HashMap<String, Child>>> = Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Clone, Serialize)]
pub struct LogEvent {
    pub job_id: String,
    pub line: String,
}

#[derive(Clone, Serialize)]
pub struct FfmpegInfo {
    pub path: String,
    pub version: String,
    /// Hardware encoders actually present in this build, e.g. `h264_nvenc`.
    pub encoders: Vec<String>,
}

/// Candidate locations for the ffmpeg binary, most specific first:
/// 1. `NABIVIDEO_FFMPEG` env override,
/// 2. a binary bundled next to our executable (sidecar),
/// 3. whatever is on `PATH`.
fn candidates(name: &str) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let key = if name == "ffprobe" { "NABIVIDEO_FFPROBE" } else { "NABIVIDEO_FFMPEG" };
    if let Ok(p) = std::env::var(key) {
        if !p.trim().is_empty() {
            out.push(PathBuf::from(p));
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let exe_name = if cfg!(windows) { format!("{name}.exe") } else { name.to_string() };
            out.push(dir.join(&exe_name));
            out.push(dir.join("bin").join(&exe_name));
        }
    }
    out.push(PathBuf::from(name));
    out
}

fn base_command(path: &PathBuf) -> Command {
    let mut cmd = Command::new(path);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Resolve a working binary by actually running `-version` on each candidate.
fn resolve(name: &str) -> Result<(PathBuf, String), String> {
    let mut tried = Vec::new();
    for cand in candidates(name) {
        let out = base_command(&cand).arg("-version").stdout(Stdio::piped()).stderr(Stdio::null()).output();
        match out {
            Ok(o) if o.status.success() => {
                let text = String::from_utf8_lossy(&o.stdout);
                let first = text.lines().next().unwrap_or("").to_string();
                return Ok((cand, first));
            }
            _ => tried.push(cand.display().to_string()),
        }
    }
    Err(format!(
        "{name} 실행 파일을 찾지 못했습니다. 시도한 경로: {}",
        tried.join(", ")
    ))
}

/// Report which ffmpeg we found and which hardware encoders it exposes, so the
/// export dialog can offer NVENC/QSV/AMF only when they really exist.
#[tauri::command]
pub fn ffmpeg_info() -> Result<FfmpegInfo, String> {
    let (path, version) = resolve("ffmpeg")?;
    let mut encoders = Vec::new();
    if let Ok(o) = base_command(&path)
        .args(["-hide_banner", "-encoders"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
    {
        let text = String::from_utf8_lossy(&o.stdout);
        for line in text.lines() {
            // Encoder listing rows look like " V....D h264_nvenc  NVIDIA ..."
            let Some(name) = line.split_whitespace().nth(1) else { continue };
            if name.ends_with("_nvenc") || name.ends_with("_qsv") || name.ends_with("_amf")
                || name.ends_with("_videotoolbox") || name.ends_with("_vaapi")
            {
                encoders.push(name.to_string());
            }
        }
    }
    Ok(FfmpegInfo { path: path.display().to_string(), version, encoders })
}

/// Run ffmpeg with the given arguments, streaming stderr back to the frontend
/// as `ffmpeg://log` events (the frontend already knows how to parse ffmpeg's
/// `time=` progress lines — it does the same for the wasm build).
///
/// Returns the process exit code. A non-zero code is returned rather than
/// raised so the caller can show the collected log alongside it.
#[tauri::command]
pub async fn ffmpeg_run(
    app: AppHandle,
    job_id: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<i32, String> {
    let (path, _) = resolve("ffmpeg")?;

    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = base_command(&path);
        // Running from the scratch directory lets the generated filter graph
        // keep using bare relative names (`rnnoise.rnnn`, `sub0.png`) exactly
        // as the wasm build does — no path rewriting inside filter strings,
        // which would otherwise break on Windows drive letters (`C:\`) since
        // `:` is a filter argument separator.
        if let Some(dir) = cwd.as_ref() {
            cmd.current_dir(dir);
        }
        let mut child = cmd
            // `-nostdin` keeps ffmpeg from consuming our stdin and hanging.
            // It is a global option, so it belongs before the inputs. (ffmpeg
            // 8.1 also accepts it trailing, but that is not something to rely
            // on across builds.)
            .arg("-nostdin")
            .args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("ffmpeg 실행 실패: {e}"))?;

        let stderr = child.stderr.take().ok_or_else(|| "stderr 파이프를 열지 못했습니다".to_string())?;
        JOBS.lock().unwrap().insert(job_id.clone(), child);

        // ffmpeg writes progress with \r (no newline) so read_line would block
        // until the whole run finished. Split on both \r and \n instead.
        let mut reader = BufReader::new(stderr);
        let mut buf: Vec<u8> = Vec::new();
        loop {
            let mut byte = [0u8; 1];
            match std::io::Read::read(&mut reader, &mut byte) {
                Ok(0) => break,
                Ok(_) => {
                    if byte[0] == b'\n' || byte[0] == b'\r' {
                        if !buf.is_empty() {
                            let line = String::from_utf8_lossy(&buf).to_string();
                            let _ = app.emit("ffmpeg://log", LogEvent { job_id: job_id.clone(), line });
                            buf.clear();
                        }
                    } else {
                        buf.push(byte[0]);
                    }
                }
                Err(_) => break,
            }
        }
        if !buf.is_empty() {
            let line = String::from_utf8_lossy(&buf).to_string();
            let _ = app.emit("ffmpeg://log", LogEvent { job_id: job_id.clone(), line });
        }

        let mut child = JOBS
            .lock()
            .unwrap()
            .remove(&job_id)
            .ok_or_else(|| "작업이 취소되었습니다".to_string())?;
        let status = child.wait().map_err(|e| format!("ffmpeg 종료 대기 실패: {e}"))?;
        Ok(status.code().unwrap_or(-1))
    })
    .await
    .map_err(|e| format!("작업 스레드 오류: {e}"))?
}

/// Cancel a running export.
#[tauri::command]
pub fn ffmpeg_cancel(job_id: String) -> Result<bool, String> {
    let mut jobs = JOBS.lock().unwrap();
    match jobs.get_mut(&job_id) {
        Some(child) => {
            let _ = child.kill();
            Ok(true)
        }
        None => Ok(false),
    }
}

#[derive(Clone, Serialize)]
pub struct MediaProbe {
    pub has_video: bool,
    pub has_audio: bool,
    /// True when the video stream carries an alpha channel. Decides whether the
    /// preview proxy must be an alpha-preserving format.
    pub has_alpha: bool,
    pub pix_fmt: String,
    pub width: u32,
    pub height: u32,
    pub duration: f64,
}

/// Authoritative stream info via ffprobe.
///
/// The browser cannot reliably tell whether a file has an audio stream — the
/// web build assumes it does. That assumption breaks export for silent video
/// (image-to-video generators produce exactly this): the filter graph emits
/// `[n:a]` for a stream that does not exist and ffmpeg aborts the whole run
/// with "Stream specifier ':a' matches no streams". On the desktop we can just
/// ask.
#[tauri::command]
pub fn media_probe(path: String) -> Result<MediaProbe, String> {
    let (probe, _) = resolve("ffprobe")?;
    let out = base_command(&probe)
        .args([
            "-v", "error",
            "-show_entries", "stream=codec_type,width,height,pix_fmt",
            "-show_entries", "format=duration",
            "-of", "json",
            &path,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("ffprobe 실행 실패: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "ffprobe 실패 ({path}): {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    let v: serde_json::Value =
        serde_json::from_slice(&out.stdout).map_err(|e| format!("ffprobe 출력 파싱 실패: {e}"))?;

    let mut has_video = false;
    let mut has_audio = false;
    let mut has_alpha = false;
    let mut pix_fmt = String::new();
    let (mut width, mut height) = (0u32, 0u32);
    if let Some(streams) = v.get("streams").and_then(|s| s.as_array()) {
        for s in streams {
            match s.get("codec_type").and_then(|c| c.as_str()) {
                Some("video") => {
                    has_video = true;
                    if width == 0 {
                        width = s.get("width").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
                        height = s.get("height").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
                        pix_fmt = s
                            .get("pix_fmt")
                            .and_then(|x| x.as_str())
                            .unwrap_or("")
                            .to_string();
                        // ffmpeg spells alpha several ways: yuva*, rgba/argb/
                        // bgra/abgr, ya8/ya16, gbrap.
                        let pf = pix_fmt.as_str();
                        has_alpha = pf.starts_with("yuva")
                            || pf.starts_with("ya")
                            || pf.starts_with("gbrap")
                            || pf.contains("rgba")
                            || pf.contains("argb")
                            || pf.contains("bgra")
                            || pf.contains("abgr");
                    }
                }
                Some("audio") => has_audio = true,
                _ => {}
            }
        }
    }
    let duration = v
        .get("format")
        .and_then(|f| f.get("duration"))
        .and_then(|d| d.as_str())
        .and_then(|d| d.parse::<f64>().ok())
        .unwrap_or(0.0);

    Ok(MediaProbe { has_video, has_audio, has_alpha, pix_fmt, width, height, duration })
}
