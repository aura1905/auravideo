mod bridge;
mod ffmpeg;
mod files;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            ffmpeg::ffmpeg_info,
            ffmpeg::ffmpeg_run,
            ffmpeg::ffmpeg_cancel,
            files::temp_root,
            files::write_temp_file,
            files::remove_temp_file,
            files::file_size,
            bridge::agent_reply,
        ])
        .setup(|app| {
            bridge::start(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
