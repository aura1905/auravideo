//! Temp-file plumbing for the native export path.
//!
//! Most assets are exported straight from their real path on disk (no copy).
//! Two things still need to be materialised as files: subtitle overlay PNGs,
//! which the frontend renders on a canvas, and any asset that only exists as a
//! blob (e.g. a project restored from IndexedDB or imported from a .zip).

use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Per-run scratch directory under the OS temp dir.
fn root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .temp_dir()
        .map_err(|e| format!("임시 디렉터리를 찾지 못했습니다: {e}"))?
        .join("nabivideo");
    fs::create_dir_all(&dir).map_err(|e| format!("임시 디렉터리 생성 실패: {e}"))?;
    Ok(dir)
}

#[tauri::command]
pub fn temp_root(app: tauri::AppHandle) -> Result<String, String> {
    Ok(root(&app)?.display().to_string())
}

/// Write bytes into the scratch directory and return the absolute path.
/// `name` is sanitised — it is only ever a leaf file name.
#[tauri::command]
pub fn write_temp_file(app: tauri::AppHandle, name: String, data: Vec<u8>) -> Result<String, String> {
    let leaf = PathBuf::from(&name);
    let leaf = leaf
        .file_name()
        .ok_or_else(|| format!("잘못된 파일 이름: {name}"))?;
    let path = root(&app)?.join(leaf);
    fs::write(&path, &data).map_err(|e| format!("임시 파일 쓰기 실패 ({}): {e}", path.display()))?;
    Ok(path.display().to_string())
}

/// Delete a file we previously created in the scratch directory. Refuses paths
/// outside it so a bad call can never remove the user's media.
#[tauri::command]
pub fn remove_temp_file(app: tauri::AppHandle, path: String) -> Result<bool, String> {
    let root = root(&app)?;
    let target = PathBuf::from(&path);
    let inside = target
        .canonicalize()
        .ok()
        .zip(root.canonicalize().ok())
        .map(|(t, r)| t.starts_with(r))
        .unwrap_or(false);
    if !inside {
        return Err(format!("임시 디렉터리 밖의 경로는 삭제하지 않습니다: {path}"));
    }
    match fs::remove_file(&target) {
        Ok(_) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(format!("임시 파일 삭제 실패: {e}")),
    }
}

/// Size of a file on disk, used to sanity-check an export actually produced
/// output before we report success.
#[tauri::command]
pub fn file_size(path: String) -> Result<u64, String> {
    fs::metadata(&path)
        .map(|m| m.len())
        .map_err(|e| format!("파일 정보를 읽지 못했습니다 ({path}): {e}"))
}
