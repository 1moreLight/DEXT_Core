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

// ponytail: fixed wallpaper folder for now, make configurable when room management exists
const WALLPAPER_DIR: &str = r"D:\midDOW\dext-room-wallpaper";

#[tauri::command]
async fn save_room(room_json: String) -> Result<(), String> {
    let path = std::path::Path::new(WALLPAPER_DIR).join("room.json");
    std::fs::write(&path, room_json).map_err(|e| format!("save room.json failed: {e}"))
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
            save_room,
            set_wallpaper,
            core_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
