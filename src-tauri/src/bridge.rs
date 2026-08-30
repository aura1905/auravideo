//! Agent control bridge.
//!
//! Lets an external process (a CLI, a script, or an AI agent) drive the editor
//! the same way a person does: every command is forwarded to the frontend and
//! applied through the ordinary Zustand actions, so there is no second
//! implementation of editing logic that could drift from the UI's.
//!
//! Transport is a loopback HTTP server. It is OFF unless `NABIVIDEO_AGENT=1`,
//! binds to 127.0.0.1 only, and requires a bearer token that is generated per
//! run and written to `<temp>/nabivideo/agent.json` — a local file readable by
//! the user who launched the app. Without the env var no socket is opened at
//! all.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// Pending requests, keyed by id, waiting for the frontend to answer.
static PENDING: Lazy<Mutex<HashMap<String, Sender<serde_json::Value>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Clone, Serialize)]
struct AgentRequest {
    id: String,
    cmd: String,
    args: serde_json::Value,
}

#[derive(Deserialize)]
struct IncomingBody {
    cmd: String,
    #[serde(default)]
    args: serde_json::Value,
}

#[derive(Serialize)]
struct Handshake {
    port: u16,
    token: String,
}

/// The frontend calls this to answer a request it received via `agent://request`.
#[tauri::command]
pub fn agent_reply(id: String, result: serde_json::Value) {
    let tx = PENDING.lock().unwrap().remove(&id);
    if let Some(tx) = tx {
        let _ = tx.send(result);
    }
}

fn json_response(status: u16, body: serde_json::Value) -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
    let bytes = serde_json::to_vec(&body).unwrap_or_else(|_| b"{}".to_vec());
    tiny_http::Response::from_data(bytes)
        .with_status_code(status)
        .with_header(
            tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap(),
        )
}

/// Start the bridge if `NABIVIDEO_AGENT=1`. Returns without doing anything
/// otherwise, so a normal launch never opens a port.
pub fn start(app: &AppHandle) {
    if std::env::var("NABIVIDEO_AGENT").unwrap_or_default() != "1" {
        return;
    }

    let server = match tiny_http::Server::http("127.0.0.1:0") {
        Ok(s) => s,
        Err(e) => {
            log::error!("agent bridge: could not bind: {e}");
            return;
        }
    };
    let port = match server.server_addr().to_ip() {
        Some(addr) => addr.port(),
        None => return,
    };

    // Per-run token. Not a secret against a local attacker with the same user
    // account (they can read the handshake file) — it exists so that another
    // process on the machine cannot blindly POST to the port.
    let token: String = {
        let n: u128 = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        format!("{n:x}{:x}", std::process::id())
    };

    if let Ok(dir) = app.path().temp_dir() {
        let dir = dir.join("nabivideo");
        let _ = std::fs::create_dir_all(&dir);
        let hs = Handshake { port, token: token.clone() };
        if let Ok(bytes) = serde_json::to_vec_pretty(&hs) {
            let _ = std::fs::write(dir.join("agent.json"), bytes);
        }
    }
    log::info!("agent bridge listening on 127.0.0.1:{port}");

    let app = app.clone();
    std::thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let authorized = request
                .headers()
                .iter()
                .any(|h| h.field.equiv("X-Agent-Token") && h.value.as_str() == token);
            if !authorized {
                let _ = request.respond(json_response(401, serde_json::json!({ "error": "unauthorized" })));
                continue;
            }

            let mut body = String::new();
            if request.as_reader().read_to_string(&mut body).is_err() {
                let _ = request.respond(json_response(400, serde_json::json!({ "error": "unreadable body" })));
                continue;
            }
            let parsed: IncomingBody = match serde_json::from_str(&body) {
                Ok(v) => v,
                Err(e) => {
                    let _ = request.respond(json_response(400, serde_json::json!({ "error": format!("bad json: {e}") })));
                    continue;
                }
            };

            let id = format!("{:x}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0));
            let (tx, rx) = channel();
            PENDING.lock().unwrap().insert(id.clone(), tx);

            let emitted = app.emit(
                "agent://request",
                AgentRequest { id: id.clone(), cmd: parsed.cmd.clone(), args: parsed.args },
            );
            if emitted.is_err() {
                PENDING.lock().unwrap().remove(&id);
                let _ = request.respond(json_response(500, serde_json::json!({ "error": "frontend unreachable" })));
                continue;
            }

            // Generous: an export of a long timeline legitimately takes a while.
            let reply = rx.recv_timeout(Duration::from_secs(3600));
            PENDING.lock().unwrap().remove(&id);
            let resp = match reply {
                Ok(v) => json_response(200, v),
                Err(_) => json_response(504, serde_json::json!({ "error": "frontend did not answer in time" })),
            };
            let _ = request.respond(resp);
        }
    });
}
