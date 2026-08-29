mod grpc;

use tauri::Manager;

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

#[tauri::command]
async fn resolve_app(path: String) -> Result<grpc::AppInfoDto, String> {
    grpc::resolve_app(path).await
}

// persistent curated app library (rooms/library.json); None = no library yet (fall back to scan)
#[tauri::command]
async fn load_library(dir: String) -> Result<Option<String>, String> {
    let p = std::path::Path::new(&dir).join("library.json");
    if !p.is_file() {
        return Ok(None);
    }
    std::fs::read_to_string(&p)
        .map(Some)
        .map_err(|e| format!("read library failed: {e}"))
}

#[tauri::command]
async fn save_library(dir: String, library_json: String) -> Result<(), String> {
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir failed: {e}"))?;
    std::fs::write(std::path::Path::new(&dir).join("library.json"), library_json)
        .map_err(|e| format!("write library failed: {e}"))
}

// wallpaper package lives inside the repo; applied via SetWallpaper RPC
// 2026-08-27: derive from CARGO_MANIFEST_DIR (tauri-ui/src-tauri) so the path
// survives repo relocation; recompile after moving the repo.
const WALLPAPER_DIR: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../wallpapers/dext-room"
);

#[derive(serde::Serialize)]
struct CoverRef {
    kind: String, // "image" | "video"
    src: String,  // path relative to the room dir (forward slashes)
}

#[derive(serde::Serialize)]
struct RoomInfo {
    name: String,
    path: String,
    desks: usize,
    icons: usize,
    covers: Vec<CoverRef>,
}

fn push_cover(covers: &mut Vec<CoverRef>, bg: &serde_json::Value) {
    match bg {
        serde_json::Value::String(s) if !s.is_empty() => covers.push(CoverRef {
            kind: "image".into(),
            src: s.replace('\\', "/"),
        }),
        serde_json::Value::Object(_) => {
            if let Some(src) = bg.get("src").and_then(|s| s.as_str()) {
                if !src.is_empty() {
                    covers.push(CoverRef {
                        kind: "video".into(),
                        src: src.replace('\\', "/"),
                    });
                }
            }
        }
        _ => {}
    }
}

// room library dir for the lib:// protocol; kept in sync by list_rooms
struct LibDir(std::sync::Mutex<String>);

#[tauri::command]
async fn list_rooms(app: tauri::AppHandle, dir: String) -> Result<Vec<RoomInfo>, String> {
    if app.try_state::<LibDir>().is_none() {
        app.manage(LibDir(std::sync::Mutex::new(dir.clone())));
    } else {
        *app.state::<LibDir>().0.lock().unwrap() = dir.clone();
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| format!("read dir failed: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_dir() && p.join("room.json").is_file() {
            let (mut desks, mut icons) = (0usize, 0usize);
            let mut covers = Vec::new();
            if let Ok(txt) = std::fs::read_to_string(p.join("room.json")) {
                if let Ok(j) = serde_json::from_str::<serde_json::Value>(&txt) {
                    if let Some(arr) = j["desks"].as_array() {
                        desks = arr.len();
                        for d in arr {
                            icons += d["icons"].as_array().map(|a| a.len()).unwrap_or(0);
                            push_cover(&mut covers, &d["background"]);
                        }
                    }
                }
            }
            out.push(RoomInfo {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: p.to_string_lossy().into_owned(),
                desks,
                icons,
                covers,
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

fn save_room_css_file(room_dir: &std::path::Path, css: &str) -> Result<(), String> {
    if !room_dir.is_dir() {
        return Err(format!("room directory not found: {}", room_dir.display()));
    }
    if !room_dir.join("room.json").is_file() {
        return Err(format!(
            "not a Room directory (room.json missing): {}",
            room_dir.display()
        ));
    }
    std::fs::write(room_dir.join("room.css"), css)
        .map_err(|e| format!("write room.css failed: {e}"))
}

#[tauri::command]
async fn save_room_css(room_dir: String, css: String) -> Result<(), String> {
    save_room_css_file(std::path::Path::new(&room_dir), &css)
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

const ROOM_ASSET_DIRS: [&str; 5] = ["background", "transition", "switch", "start", "end"];
const ROOM_OPTIONAL_FILES: [&str; 2] = ["room.js", "room.css"];

fn remove_room_owned_path(path: &std::path::Path, label: &str) -> Result<(), String> {
    if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|e| format!("remove old {label} failed: {e}"))?;
    } else if path.exists() {
        std::fs::remove_file(path).map_err(|e| format!("remove old {label} failed: {e}"))?;
    }
    Ok(())
}

fn copy_room_dir(src: &std::path::Path, dst: &std::path::Path, label: &str) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| format!("mkdir {label} failed: {e}"))?;
    for entry in std::fs::read_dir(src).map_err(|e| format!("read {label} failed: {e}"))? {
        let entry = entry.map_err(|e| format!("read {label} entry failed: {e}"))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("inspect {label} entry failed: {e}"))?;
        let target = dst.join(entry.file_name());
        if file_type.is_dir() {
            copy_room_dir(&entry.path(), &target, label)?;
        } else if file_type.is_file() {
            std::fs::copy(entry.path(), target).map_err(|e| format!("copy {label} failed: {e}"))?;
        }
    }
    Ok(())
}

fn sync_room_to_package(
    src: &std::path::Path,
    pkg: &std::path::Path,
    source_stamp: &str,
) -> Result<(), String> {
    // Validate and serialize first: an unreadable Room must not clean the active package.
    let mut room: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(src.join("room.json"))
            .map_err(|e| format!("read room.json failed: {e}"))?,
    )
    .map_err(|e| format!("parse room.json failed: {e}"))?;
    let object = room
        .as_object_mut()
        .ok_or_else(|| "parse room.json failed: root must be an object".to_string())?;
    object.insert(
        "__source".into(),
        serde_json::Value::String(source_stamp.to_string()),
    );
    let room_json =
        serde_json::to_vec_pretty(&room).map_err(|e| format!("serialize room.json failed: {e}"))?;

    std::fs::create_dir_all(pkg).map_err(|e| format!("mkdir wallpaper package failed: {e}"))?;
    for sub in ROOM_ASSET_DIRS {
        let source = src.join(sub);
        let target = pkg.join(sub);
        remove_room_owned_path(&target, sub)?;
        if source.is_dir() {
            copy_room_dir(&source, &target, sub)?;
        }
    }
    for name in ROOM_OPTIONAL_FILES {
        let source = src.join(name);
        let target = pkg.join(name);
        remove_room_owned_path(&target, name)?;
        if source.is_file() {
            std::fs::copy(source, target).map_err(|e| format!("copy {name} failed: {e}"))?;
        }
    }
    std::fs::write(pkg.join("room.json"), room_json)
        .map_err(|e| format!("copy room.json failed: {e}"))
}

// Mirror Room-owned data into the wallpaper package, then reload it.
// WebView2 virtual host can only serve files inside the package dir (ERRORS #7/#27).
#[tauri::command]
async fn apply_room(room_dir: String) -> Result<(), String> {
    let src = std::path::Path::new(&room_dir);
    let pkg = std::path::Path::new(WALLPAPER_DIR);
    sync_room_to_package(src, pkg, &room_dir)?;
    grpc::set_wallpaper(WALLPAPER_DIR).await
}

// dext:// protocol maps the wallpaper package dir into the configurator webview,
// so the editor can embed the real renderer in an iframe (preview).
// copy a picked image/video into the room's background/ folder; returns the background value
#[tauri::command]
async fn import_background(
    room_dir: String,
    src_path: String,
    kind: String,
) -> Result<serde_json::Value, String> {
    let src = std::path::Path::new(&src_path);
    if !src.is_file() {
        return Err(format!("file not found: {src_path}"));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let video = matches!(ext.as_str(), "mp4" | "webm" | "mkv" | "mov" | "avi");
    let image = matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp" | "bmp" | "gif");
    // kind: "video"/"image" → background/, "transition" → transition/
    let (ok, subdir, value) = match kind.as_str() {
        "video" => (video, "background", true),
        "transition" => (video, "transition", true),
        _ => (image, "background", false),
    };
    if !ok {
        return Err(format!(".{ext} 不是有效的{kind}格式"));
    }
    let dst_dir = std::path::Path::new(&room_dir).join(subdir);
    std::fs::create_dir_all(&dst_dir).map_err(|e| format!("mkdir failed: {e}"))?;
    let name = format!(
        "{kind}-{}.{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        ext
    );
    std::fs::copy(src, dst_dir.join(&name)).map_err(|e| format!("copy failed: {e}"))?;
    let rel = format!("{subdir}/{name}");
    Ok(match value {
        true => serde_json::json!({ "type": "video", "src": rel }),
        false => serde_json::Value::String(rel),
    })
}

fn mime_of(path: &std::path::Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "json" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        _ => "application/octet-stream",
    }
}

fn respond_file(full: &std::path::Path, cache: bool) -> tauri::http::Response<Vec<u8>> {
    match std::fs::read(full) {
        Ok(bytes) => {
            // cache only for the room library (imported assets are immutable, timestamped names);
            // never cache dext:// — room.json there is rewritten by apply_room
            let mut b = tauri::http::Response::builder().header("Content-Type", mime_of(full));
            if cache {
                b = b.header("Cache-Control", "max-age=604800");
            }
            b.body(bytes).unwrap()
        }
        Err(_) => tauri::http::Response::builder()
            .status(404)
            .body(Vec::new())
            .unwrap(),
    }
}

fn decode_url_path(url_path: &str) -> Option<Vec<String>> {
    use percent_encoding::percent_decode_str;
    let decoded = percent_decode_str(url_path.trim_start_matches('/'))
        .decode_utf8_lossy()
        .into_owned();
    let segments: Vec<String> = decoded
        .split(['/', '\\'])
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();
    if segments.iter().any(|s| s == "..") || segments.is_empty() {
        return None;
    }
    Some(segments)
}

fn serve_package_file(url_path: &str) -> tauri::http::Response<Vec<u8>> {
    match decode_url_path(url_path) {
        Some(segments) => {
            let mut full = std::path::PathBuf::from(WALLPAPER_DIR);
            for s in &segments {
                full.push(s);
            }
            respond_file(&full, false)
        }
        None => tauri::http::Response::builder()
            .status(403)
            .body(Vec::new())
            .unwrap(),
    }
}

// lib:// protocol maps the room library dir (rooms/<name>/...) into the webview,
// so the home page can show cover thumbnails straight from the source rooms.
fn serve_lib_file(url_path: &str, lib_dir: &str) -> tauri::http::Response<Vec<u8>> {
    match decode_url_path(url_path) {
        // require at least <room-name>/<file>
        Some(segments) if segments.len() >= 2 => {
            let mut full = std::path::PathBuf::from(lib_dir);
            for s in &segments {
                full.push(s);
            }
            respond_file(&full, true)
        }
        _ => tauri::http::Response::builder()
            .status(403)
            .body(Vec::new())
            .unwrap(),
    }
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .register_uri_scheme_protocol("dext", |_ctx, request| {
            serve_package_file(request.uri().path())
        })
        .register_uri_scheme_protocol("lib", |ctx, request| {
            let dir = match ctx.app_handle().try_state::<LibDir>() {
                Some(s) => s.0.lock().unwrap().clone(),
                None => String::new(),
            };
            serve_lib_file(request.uri().path(), &dir)
        })
        .invoke_handler(tauri::generate_handler![
            get_wallpapers,
            get_installed_apps,
            launch_app,
            resolve_app,
            load_library,
            save_library,
            list_rooms,
            read_room,
            write_room,
            save_room_css,
            create_room,
            apply_room,
            import_background,
            set_wallpaper,
            core_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{save_room_css_file, sync_room_to_package};

    fn test_dir(label: &str) -> std::path::PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("dext-{label}-{}-{stamp}", std::process::id()))
    }

    #[test]
    fn saves_and_overwrites_room_css() {
        let dir = test_dir("room-css");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("room.json"), r#"{"desks":[{"icons":[]}]}"#).unwrap();

        save_room_css_file(&dir, "/* first */").unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("room.css")).unwrap(), "/* first */");

        save_room_css_file(&dir, "/* second */").unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("room.css")).unwrap(), "/* second */");

        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn rejects_non_room_for_room_css() {
        let dir = test_dir("not-room");
        std::fs::create_dir_all(&dir).unwrap();

        let error = save_room_css_file(&dir, "/* nope */").unwrap_err();
        assert!(error.contains("room.json missing"));
        assert!(!dir.join("room.css").exists());

        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn room_apply_removes_previous_room_owned_files() {
        let root = test_dir("room-apply-isolation");
        let src = root.join("source");
        let pkg = root.join("package");
        std::fs::create_dir_all(src.join("background/nested")).unwrap();
        std::fs::create_dir_all(pkg.join("background/obsolete")).unwrap();
        for sub in ["transition", "switch", "start", "end"] {
            std::fs::create_dir_all(pkg.join(sub)).unwrap();
            std::fs::write(pkg.join(sub).join("cockpit.txt"), "old").unwrap();
        }
        std::fs::write(
            src.join("room.json"),
            r#"{"desks":[{"name":"Clean","icons":[]}]}"#,
        )
        .unwrap();
        std::fs::write(src.join("background/new.png"), "new background").unwrap();
        std::fs::write(src.join("background/nested/asset.txt"), "nested").unwrap();
        std::fs::write(pkg.join("room.json"), r#"{"name":"cockpit"}"#).unwrap();
        std::fs::write(pkg.join("background/old.png"), "old background").unwrap();
        std::fs::write(pkg.join("background/obsolete/old.txt"), "old nested").unwrap();
        std::fs::write(pkg.join("room.js"), "cockpit script").unwrap();
        std::fs::write(pkg.join("room.css"), "cockpit style").unwrap();

        sync_room_to_package(&src, &pkg, "C:/rooms/clean-room").unwrap();

        assert!(!pkg.join("room.js").exists());
        assert!(!pkg.join("room.css").exists());
        for sub in ["transition", "switch", "start", "end"] {
            assert!(!pkg.join(sub).exists(), "stale {sub} directory remains");
        }
        assert!(!pkg.join("background/old.png").exists());
        assert!(!pkg.join("background/obsolete").exists());
        assert_eq!(
            std::fs::read_to_string(pkg.join("background/new.png")).unwrap(),
            "new background"
        );
        assert_eq!(
            std::fs::read_to_string(pkg.join("background/nested/asset.txt")).unwrap(),
            "nested"
        );
        let applied: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(pkg.join("room.json")).unwrap()).unwrap();
        assert_eq!(applied["desks"][0]["name"], "Clean");
        assert_eq!(applied["__source"], "C:/rooms/clean-room");

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn invalid_room_json_keeps_active_package_unchanged() {
        let root = test_dir("room-apply-invalid");
        let src = root.join("source");
        let pkg = root.join("package");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::create_dir_all(pkg.join("start")).unwrap();
        std::fs::write(src.join("room.json"), "{ invalid").unwrap();
        std::fs::write(pkg.join("room.json"), "active room").unwrap();
        std::fs::write(pkg.join("room.js"), "active script").unwrap();
        std::fs::write(pkg.join("start/active.txt"), "active asset").unwrap();

        let error = sync_room_to_package(&src, &pkg, "C:/rooms/broken").unwrap_err();

        assert!(error.contains("parse room.json failed"));
        assert_eq!(
            std::fs::read_to_string(pkg.join("room.json")).unwrap(),
            "active room"
        );
        assert_eq!(
            std::fs::read_to_string(pkg.join("room.js")).unwrap(),
            "active script"
        );
        assert_eq!(
            std::fs::read_to_string(pkg.join("start/active.txt")).unwrap(),
            "active asset"
        );

        std::fs::remove_dir_all(root).unwrap();
    }
}
