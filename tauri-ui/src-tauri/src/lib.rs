mod grpc;

pub mod proto {
    pub mod desktop {
        include!(concat!(env!("OUT_DIR"), "/lively.grpc.common.proto.desktop.rs"));
    }
    pub mod grpc_dotnet_named_pipes {
        pub mod generated {
            include!(concat!(
                env!("OUT_DIR"),
                "/grpc_dot_net_named_pipes.generated.rs"
            ));
        }
    }
}

#[tauri::command]
async fn get_wallpapers() -> Result<Vec<grpc::WallpaperInfo>, String> {
    grpc::get_wallpapers().await
}

#[tauri::command]
async fn get_installed_apps() -> Result<Vec<grpc::AppInfoDto>, String> {
    grpc::get_installed_apps().await
}

#[tauri::command]
async fn launch_app(target: String, arguments: String, working_dir: String) -> Result<(), String> {
    grpc::launch_app(target, arguments, working_dir).await
}

// wallpaper package lives inside the repo; applied via SetWallpaper RPC
const WALLPAPER_DIR: &str = r"D:\midDOW\lively-core-separation\wallpapers\dext-room";

#[derive(serde::Serialize)]
struct RoomInfo {
    name: String,
    path: String,
}

#[tauri::command]
async fn list_rooms(dir: String) -> Result<Vec<RoomInfo>, String> {
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| format!("read dir failed: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_dir() && p.join("room.json").is_file() {
            out.push(RoomInfo {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: p.to_string_lossy().into_owned(),
            });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[tauri::command]
async fn read_room(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("read room failed: {e}"))
}

#[tauri::command]
async fn write_room(path: String, room_json: String) -> Result<(), String> {
    std::fs::write(&path, room_json).map_err(|e| format!("write room failed: {e}"))
}

#[tauri::command]
async fn create_room(dir: String, name: String) -> Result<String, String> {
    if name.is_empty()
        || name
            .chars()
            .any(|c| c == '\\' || c == '/' || c == ':' || c == '*' || c == '?' || c == '"' || c == '<' || c == '>' || c == '|')
    {
        return Err("invalid room name".into());
    }
    let room_dir = std::path::Path::new(&dir).join(&name);
    if room_dir.exists() {
        return Err(format!("room already exists: {name}"));
    }
    std::fs::create_dir_all(&room_dir).map_err(|e| format!("mkdir failed: {e}"))?;
    let skeleton = serde_json::json!({
        "desks": [{ "name": "Desk 1", "background": "", "icons": [] }]
    });
    std::fs::write(
        room_dir.join("room.json"),
        serde_json::to_string_pretty(&skeleton).unwrap(),
    )
    .map_err(|e| format!("write room.json failed: {e}"))?;
    Ok(room_dir.to_string_lossy().into_owned())
}

// copy room data (room.json + background/) into the wallpaper package, then reload.
// WebView2 virtual host can only serve files inside the package dir (ERRORS #7).
#[tauri::command]
async fn apply_room(room_dir: String) -> Result<(), String> {
    let src = std::path::Path::new(&room_dir);
    let pkg = std::path::Path::new(WALLPAPER_DIR);
    std::fs::copy(src.join("room.json"), pkg.join("room.json"))
        .map_err(|e| format!("copy room.json failed: {e}"))?;
    let bg_src = src.join("background");
    if bg_src.is_dir() {
        let bg_dst = pkg.join("background");
        std::fs::create_dir_all(&bg_dst).map_err(|e| format!("mkdir background failed: {e}"))?;
        for entry in std::fs::read_dir(&bg_src).map_err(|e| format!("read background failed: {e}"))? {
            let entry = entry.map_err(|e| e.to_string())?;
            if entry.file_type().map_err(|e| e.to_string())?.is_file() {
                std::fs::copy(entry.path(), bg_dst.join(entry.file_name()))
                    .map_err(|e| format!("copy background failed: {e}"))?;
            }
        }
    }
    grpc::set_wallpaper(WALLPAPER_DIR).await
}

#[tauri::command]
async fn set_wallpaper(folder: String) -> Result<(), String> {
    grpc::set_wallpaper(&folder).await
}

#[tauri::command]
async fn core_stats() -> Result<String, String> {
    grpc::core_stats().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_wallpapers,
            get_installed_apps,
            launch_app,
            list_rooms,
            read_room,
            write_room,
            create_room,
            apply_room,
            set_wallpaper,
            core_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
