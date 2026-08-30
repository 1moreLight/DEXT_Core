mod grpc;

use tauri::Manager;

pub mod proto {
    pub mod desktop {
        include!(concat!(
            env!("OUT_DIR"),
            "/lively.grpc.common.proto.desktop.rs"
        ));
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
    std::fs::write(
        std::path::Path::new(&dir).join("library.json"),
        library_json,
    )
    .map_err(|e| format!("write library failed: {e}"))
}

// wallpaper package lives inside the repo; applied via SetWallpaper RPC
// 2026-08-27: derive from CARGO_MANIFEST_DIR (tauri-ui/src-tauri) so the path
// survives repo relocation; recompile after moving the repo.
const WALLPAPER_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../wallpapers/dext-room");

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
        serde_json::Value::Object(_) => {
            let kind = bg.get("type").and_then(|value| value.as_str());
            if matches!(kind, Some("image" | "video")) {
                let src = bg.get("src").and_then(|s| s.as_str()).unwrap_or_default();
                if !src.is_empty() {
                    covers.push(CoverRef {
                        kind: kind.unwrap_or("image").into(),
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

fn reject_unknown_keys(
    object: &serde_json::Map<String, serde_json::Value>,
    allowed: &[&str],
    label: &str,
) -> Result<(), String> {
    if let Some(key) = object.keys().find(|key| !allowed.contains(&key.as_str())) {
        return Err(format!("{label} contains unknown field {key:?}"));
    }
    Ok(())
}

fn required_string<'a>(
    object: &'a serde_json::Map<String, serde_json::Value>,
    key: &str,
    label: &str,
) -> Result<&'a str, String> {
    object
        .get(key)
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("{label}.{key} must be a non-empty string"))
}

fn ensure_string_limit(value: &str, maximum: usize, label: &str) -> Result<(), String> {
    if value.chars().count() > maximum {
        Err(format!("{label} is longer than {maximum} characters"))
    } else {
        Ok(())
    }
}

fn validate_content(value: &serde_json::Value, directory: &str, label: &str) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or_else(|| format!("{label} must be a Content object"))?;
    reject_unknown_keys(object, &["name", "type", "src"], label)?;
    ensure_string_limit(
        required_string(object, "name", label)?,
        120,
        &format!("{label}.name"),
    )?;
    let content_type = required_string(object, "type", label)?;
    let src = required_string(object, "src", label)?;
    if !matches!(content_type, "image" | "video" | "html") {
        return Err(format!("{label}.type must be image, video, or html"));
    }
    if src.len() > 1024
        || src.contains('\\')
        || src
            .chars()
            .any(|character| character.is_control() || ":*?\"<>|".contains(character))
        || src.starts_with('/')
        || !src.starts_with(&format!("{directory}/"))
        || src.split('/').any(|part| {
            part.is_empty()
                || part == "."
                || part == ".."
                || part.ends_with('.')
                || part.ends_with(' ')
        })
    {
        return Err(format!("{label}.src must stay inside {directory}/"));
    }
    let extension = std::path::Path::new(src)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let extension_ok = match content_type {
        "image" => matches!(
            extension,
            "png" | "jpg" | "jpeg" | "webp" | "bmp" | "gif" | "svg"
        ),
        "video" => matches!(extension, "mp4" | "webm"),
        "html" => matches!(extension, "html" | "htm"),
        _ => false,
    };
    if !extension_ok {
        return Err(format!(
            "{label}.src extension does not match {content_type}"
        ));
    }
    Ok(())
}

fn validate_switch(value: &serde_json::Value, label: &str) -> Result<(), String> {
    if let Some(preset) = value.as_str() {
        return if matches!(preset, "slide" | "fade" | "zoom" | "none") {
            Ok(())
        } else {
            Err(format!("{label} has unsupported preset {preset:?}"))
        };
    }
    validate_content(value, "switch", label)
}

fn validate_launch(value: &serde_json::Value, label: &str) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or_else(|| format!("{label} must be an object"))?;
    reject_unknown_keys(object, &["target", "args", "workdir"], label)?;
    ensure_string_limit(
        required_string(object, "target", label)?,
        2048,
        &format!("{label}.target"),
    )?;
    for key in ["args", "workdir"] {
        if !object.get(key).is_some_and(|value| value.is_string()) {
            return Err(format!("{label}.{key} must be a string"));
        }
        let maximum = if key == "args" { 4096 } else { 2048 };
        ensure_string_limit(
            object[key].as_str().unwrap_or_default(),
            maximum,
            &format!("{label}.{key}"),
        )?;
    }
    Ok(())
}

fn validate_icon(value: &serde_json::Value, desktop: bool, label: &str) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or_else(|| format!("{label} must be an object"))?;
    reject_unknown_keys(
        object,
        &[
            "label", "icon_png", "glyph", "color", "action", "launch", "x", "y",
        ],
        label,
    )?;
    ensure_string_limit(
        required_string(object, "label", label)?,
        160,
        &format!("{label}.label"),
    )?;
    for key in ["icon_png", "glyph", "color", "action"] {
        if object.get(key).is_some_and(|value| !value.is_string()) {
            return Err(format!("{label}.{key} must be a string"));
        }
    }
    for (key, maximum) in [("glyph", 32), ("color", 128), ("action", 512)] {
        if let Some(value) = object.get(key).and_then(|value| value.as_str()) {
            ensure_string_limit(value, maximum, &format!("{label}.{key}"))?;
        }
    }
    if let Some(launch) = object.get("launch") {
        validate_launch(launch, &format!("{label}.launch"))?;
    }
    if desktop {
        for key in ["x", "y"] {
            if !object
                .get(key)
                .is_some_and(|value| value.as_u64().is_some())
            {
                return Err(format!("{label}.{key} must be a non-negative integer"));
            }
        }
    } else if object.contains_key("x") || object.contains_key("y") {
        return Err(format!("{label} Dock icon must not contain x/y"));
    }
    Ok(())
}

fn validate_dock(value: &serde_json::Value, label: &str) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or_else(|| format!("{label} must be an object"))?;
    reject_unknown_keys(
        object,
        &[
            "enabled",
            "position",
            "autoHide",
            "indicator",
            "style",
            "icons",
        ],
        label,
    )?;
    for key in ["enabled", "autoHide"] {
        if object.get(key).is_some_and(|value| !value.is_boolean()) {
            return Err(format!("{label}.{key} must be boolean"));
        }
    }
    if object
        .get("position")
        .is_some_and(|value| !matches!(value.as_str(), Some("bottom" | "top" | "left" | "right")))
    {
        return Err(format!("{label}.position is invalid"));
    }
    if object
        .get("indicator")
        .is_some_and(|value| !matches!(value.as_str(), Some("text" | "dots")))
    {
        return Err(format!("{label}.indicator is invalid"));
    }
    if let Some(style) = object.get("style") {
        let style = style
            .as_object()
            .ok_or_else(|| format!("{label}.style must be an object"))?;
        reject_unknown_keys(
            style,
            &["bg", "blur", "radius", "gap", "pad", "icon"],
            &format!("{label}.style"),
        )?;
        for key in ["bg", "radius", "pad"] {
            if style.get(key).is_some_and(|value| !value.is_string()) {
                return Err(format!("{label}.style.{key} must be a string"));
            }
        }
        for (key, maximum) in [("bg", 256), ("radius", 64), ("pad", 64)] {
            if let Some(value) = style.get(key).and_then(|value| value.as_str()) {
                ensure_string_limit(value, maximum, &format!("{label}.style.{key}"))?;
            }
        }
        for key in ["blur", "gap", "icon"] {
            if style.get(key).is_some_and(|value| value.as_f64().is_none()) {
                return Err(format!("{label}.style.{key} must be a number"));
            }
        }
        for (key, minimum, maximum) in [
            ("blur", 0.0, 100.0),
            ("gap", 0.0, 256.0),
            ("icon", 16.0, 256.0),
        ] {
            if let Some(value) = style.get(key).and_then(|value| value.as_f64()) {
                if !(minimum..=maximum).contains(&value) {
                    return Err(format!(
                        "{label}.style.{key} is outside {minimum}..{maximum}"
                    ));
                }
            }
        }
    }
    if let Some(icons) = object.get("icons") {
        let icons = icons
            .as_array()
            .ok_or_else(|| format!("{label}.icons must be an array"))?;
        for (index, icon) in icons.iter().enumerate() {
            validate_icon(icon, false, &format!("{label}.icons[{index}]"))?;
        }
    }
    Ok(())
}

fn allowed_switches(desk_count: usize) -> std::collections::HashSet<String> {
    let mut allowed = std::collections::HashSet::new();
    for index in 1..desk_count {
        allowed.insert(format!("{}>{index}", index - 1));
        allowed.insert(format!("{index}>{}", index - 1));
    }
    if desk_count > 2 {
        allowed.insert(format!("0>{}", desk_count - 1));
        allowed.insert(format!("{}>0", desk_count - 1));
    }
    allowed
}

fn validate_room_v1(room: &serde_json::Value) -> Result<(), String> {
    let object = room
        .as_object()
        .ok_or_else(|| "room root must be an object".to_string())?;
    reject_unknown_keys(
        object,
        &[
            "version",
            "startDesk",
            "start",
            "end",
            "switch",
            "switches",
            "dock",
            "desks",
        ],
        "room",
    )?;
    if object.get("version").and_then(|value| value.as_u64()) != Some(1) {
        return Err("room.version must be 1".into());
    }
    let desks = object
        .get("desks")
        .and_then(|value| value.as_array())
        .filter(|desks| !desks.is_empty())
        .ok_or_else(|| "room.desks must be a non-empty array".to_string())?;
    let start_desk = object
        .get("startDesk")
        .and_then(|value| value.as_u64())
        .ok_or_else(|| "room.startDesk must be a non-negative integer".to_string())?
        as usize;
    if start_desk >= desks.len() {
        return Err("room.startDesk is outside desks".into());
    }
    for (key, directory) in [("start", "start"), ("end", "end")] {
        if let Some(value) = object.get(key) {
            validate_content(value, directory, &format!("room.{key}"))?;
        }
    }
    if let Some(value) = object.get("switch") {
        validate_switch(value, "room.switch")?;
    }
    let switches = object
        .get("switches")
        .and_then(|value| value.as_object())
        .ok_or_else(|| "room.switches must be an object".to_string())?;
    let allowed = allowed_switches(desks.len());
    for (key, value) in switches {
        if !allowed.contains(key) {
            return Err(format!("room.switches direction {key:?} is not adjacent"));
        }
        validate_switch(value, &format!("room.switches[{key:?}]"))?;
    }
    if let Some(value) = object.get("dock") {
        validate_dock(value, "room.dock")?;
    }
    for (index, value) in desks.iter().enumerate() {
        let label = format!("room.desks[{index}]");
        let desk = value
            .as_object()
            .ok_or_else(|| format!("{label} must be an object"))?;
        reject_unknown_keys(
            desk,
            &["name", "background", "iconSize", "icons", "dock"],
            &label,
        )?;
        ensure_string_limit(
            required_string(desk, "name", &label)?,
            120,
            &format!("{label}.name"),
        )?;
        let background = desk
            .get("background")
            .ok_or_else(|| format!("{label}.background is required"))?;
        if !background.is_null() {
            validate_content(background, "background", &format!("{label}.background"))?;
        }
        if !matches!(
            desk.get("iconSize").and_then(|value| value.as_str()),
            Some("large" | "medium" | "small")
        ) {
            return Err(format!("{label}.iconSize is invalid"));
        }
        let icons = desk
            .get("icons")
            .and_then(|value| value.as_array())
            .ok_or_else(|| format!("{label}.icons must be an array"))?;
        for (icon_index, icon) in icons.iter().enumerate() {
            validate_icon(icon, true, &format!("{label}.icons[{icon_index}]"))?;
        }
        if let Some(value) = desk.get("dock") {
            validate_dock(value, &format!("{label}.dock"))?;
        }
    }
    Ok(())
}

fn atomic_write(path: &std::path::Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let parent = path
        .parent()
        .ok_or_else(|| format!("invalid output path: {}", path.display()))?;
    std::fs::create_dir_all(parent).map_err(|error| format!("mkdir failed: {error}"))?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|error| format!("create temp failed: {error}"))?;
    temp.write_all(bytes)
        .and_then(|_| temp.flush())
        .map_err(|error| format!("write temp failed: {error}"))?;
    temp.persist(path)
        .map(|_| ())
        .map_err(|error| format!("commit room failed: {}", error.error))
}

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
    write_room_file(std::path::Path::new(&path), &room_json)
}

fn write_room_file(path: &std::path::Path, room_json: &str) -> Result<(), String> {
    if path.file_name().and_then(|name| name.to_str()) != Some("room.json") {
        return Err("write_room only accepts a room.json target".into());
    }
    let mut room: serde_json::Value = serde_json::from_str(&room_json)
        .map_err(|error| format!("parse room.json failed: {error}"))?;
    let object = room
        .as_object_mut()
        .ok_or_else(|| "room root must be an object".to_string())?;
    object.remove("__source");
    validate_room_v1(&room)?;
    let bytes = serde_json::to_vec_pretty(&room)
        .map_err(|error| format!("serialize room.json failed: {error}"))?;
    atomic_write(path, &bytes)
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

fn validate_room_name(name: &str) -> Result<(), String> {
    if name.is_empty()
        || name != name.trim()
        || name == "."
        || name == ".."
        || name.ends_with('.')
        || name.chars().any(|c| {
            c.is_control()
                || c == '\\'
                || c == '/'
                || c == ':'
                || c == '*'
                || c == '?'
                || c == '"'
                || c == '<'
                || c == '>'
                || c == '|'
        })
    {
        Err("invalid room name".into())
    } else {
        Ok(())
    }
}

fn create_room_dir(dir: &std::path::Path, name: &str) -> Result<std::path::PathBuf, String> {
    validate_room_name(name)?;
    std::fs::create_dir_all(dir).map_err(|e| format!("mkdir library failed: {e}"))?;
    let room_dir = dir.join(name);
    if room_dir.exists() {
        return Err(format!("room already exists: {name}"));
    }
    std::fs::create_dir(&room_dir).map_err(|e| format!("mkdir failed: {e}"))?;
    let skeleton = serde_json::json!({
        "version": 1,
        "startDesk": 0,
        "switch": "slide",
        "switches": {},
        "desks": [{
            "name": "Desk 1",
            "background": null,
            "iconSize": "medium",
            "icons": []
        }]
    });
    let result = (|| {
        atomic_write(
            &room_dir.join("room.json"),
            &serde_json::to_vec_pretty(&skeleton).unwrap(),
        )
        .map_err(|e| format!("write room.json failed: {e}"))?;
        for directory in ROOM_ASSET_DIRS {
            std::fs::create_dir(room_dir.join(directory))
                .map_err(|error| format!("mkdir {directory} failed: {error}"))?;
        }
        Ok::<(), String>(())
    })();
    if let Err(error) = result {
        let _ = std::fs::remove_dir_all(&room_dir);
        return Err(error);
    }
    Ok(room_dir)
}

#[tauri::command]
async fn create_room(dir: String, name: String) -> Result<String, String> {
    create_room_dir(std::path::Path::new(&dir), &name)
        .map(|room_dir| room_dir.to_string_lossy().into_owned())
}

const ROOM_ASSET_DIRS: [&str; 4] = ["background", "switch", "start", "end"];
const ROOM_LEGACY_PATHS: [&str; 3] = ["transition", "room.js", "room.css"];

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

fn save_room_as_dir(
    source_room: &std::path::Path,
    destination_root: &std::path::Path,
    name: &str,
    room_json: &str,
) -> Result<std::path::PathBuf, String> {
    let source_room = source_room
        .canonicalize()
        .map_err(|error| format!("source Room not found: {error}"))?;
    if !source_room.join("room.json").is_file() {
        return Err(format!(
            "not a Room directory (room.json missing): {}",
            source_room.display()
        ));
    }

    let target = create_room_dir(destination_root, name)?;
    let result = (|| {
        write_room_file(&target.join("room.json"), room_json)?;
        for directory in ROOM_ASSET_DIRS {
            let source = source_room.join(directory);
            if source.is_dir() {
                copy_room_dir(&source, &target.join(directory), directory)?;
            }
        }
        Ok::<(), String>(())
    })();
    if let Err(error) = result {
        let _ = std::fs::remove_dir_all(&target);
        return Err(error);
    }
    Ok(target)
}

#[tauri::command]
async fn save_room_as(
    room_dir: String,
    dir: String,
    name: String,
    room_json: String,
) -> Result<String, String> {
    save_room_as_dir(
        std::path::Path::new(&room_dir),
        std::path::Path::new(&dir),
        &name,
        &room_json,
    )
    .map(|path| path.to_string_lossy().into_owned())
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
    validate_room_v1(&room)?;
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
    for name in ROOM_LEGACY_PATHS {
        remove_room_owned_path(&pkg.join(name), name)?;
    }
    atomic_write(&pkg.join("room.json"), &room_json)
        .map_err(|e| format!("copy room.json failed: {e}"))
}

// Mirror Room-owned data into the wallpaper package, then reload it.
// WebView2 virtual host can only serve files inside the package dir (ERRORS #7/#27).
#[tauri::command]
async fn apply_room(room_dir: String) -> Result<(), String> {
    let canonical = std::path::Path::new(&room_dir)
        .canonicalize()
        .map_err(|error| format!("Room directory not found: {error}"))?;
    let src = canonical.as_path();
    let pkg = std::path::Path::new(WALLPAPER_DIR);
    sync_room_to_package(src, pkg, &canonical.to_string_lossy())?;
    grpc::set_wallpaper(WALLPAPER_DIR).await
}

fn import_room_content_file(
    room_dir: &std::path::Path,
    src: &std::path::Path,
    slot: &str,
    content_type: &str,
) -> Result<serde_json::Value, String> {
    if !room_dir.join("room.json").is_file() {
        return Err(format!(
            "not a Room directory (room.json missing): {}",
            room_dir.display()
        ));
    }
    if !src.is_file() {
        return Err(format!("file not found: {}", src.display()));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let video = matches!(ext.as_str(), "mp4" | "webm");
    let image = matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "bmp" | "gif" | "svg"
    );
    let html = matches!(ext.as_str(), "html" | "htm");
    let valid_type = match content_type {
        "image" => image,
        "video" => video,
        "html" => html,
        _ => return Err(format!("unsupported Room content type: {content_type}")),
    };
    if !valid_type {
        return Err(format!(".{ext} 不是有效的{content_type}格式"));
    }
    if !ROOM_ASSET_DIRS.contains(&slot) {
        return Err(format!("unsupported Room content slot: {slot}"));
    }

    let dst_dir = room_dir.join(slot);
    std::fs::create_dir_all(&dst_dir).map_err(|e| format!("mkdir failed: {e}"))?;
    let name = format!(
        "{content_type}-{}.{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos(),
        ext
    );
    std::fs::copy(src, dst_dir.join(&name)).map_err(|e| format!("copy failed: {e}"))?;
    let display_name = src
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("素材");
    Ok(
        serde_json::json!({ "name": display_name, "type": content_type, "src": format!("{slot}/{name}") }),
    )
}

// Reuse the existing command name, but make it a generic v1 content importer for
// background/start/switch/end instead of maintaining one copy path per UI button.
#[tauri::command]
async fn import_background(
    room_dir: String,
    src_path: String,
    slot: String,
    content_type: String,
) -> Result<serde_json::Value, String> {
    import_room_content_file(
        std::path::Path::new(&room_dir),
        std::path::Path::new(&src_path),
        &slot,
        &content_type,
    )
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

#[tauri::command]
async fn core_identity() -> Result<grpc::CoreIdentity, String> {
    grpc::core_identity().await
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
            save_room_as,
            apply_room,
            import_background,
            set_wallpaper,
            core_stats,
            core_identity
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        import_room_content_file, save_room_as_dir, save_room_css_file, sync_room_to_package,
        validate_room_v1, write_room_file,
    };

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
        assert_eq!(
            std::fs::read_to_string(dir.join("room.css")).unwrap(),
            "/* first */"
        );

        save_room_css_file(&dir, "/* second */").unwrap();
        assert_eq!(
            std::fs::read_to_string(dir.join("room.css")).unwrap(),
            "/* second */"
        );

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
    fn save_as_copies_v1_assets_and_keeps_source_unchanged() {
        let root = test_dir("room-save-as");
        let source = root.join("source");
        let library = root.join("library");
        for directory in ["background", "start", "switch", "end"] {
            std::fs::create_dir_all(source.join(directory)).unwrap();
            std::fs::write(source.join(directory).join("asset.txt"), directory).unwrap();
        }
        let source_json = r#"{"legacy":"source stays untouched"}"#;
        std::fs::write(source.join("room.json"), source_json).unwrap();
        let room_json = r#"{
            "version":1,
            "startDesk":0,
            "switch":"slide",
            "switches":{},
            "desks":[{
                "name":"Copied",
                "background":null,
                "iconSize":"medium",
                "icons":[]
            }],
            "__source":"C:/forged"
        }"#;

        let target = save_room_as_dir(&source, &library, "copy", room_json).unwrap();

        assert_eq!(
            std::fs::read_to_string(source.join("room.json")).unwrap(),
            source_json
        );
        let saved: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(target.join("room.json")).unwrap())
                .unwrap();
        assert_eq!(saved["desks"][0]["name"], "Copied");
        assert!(saved.get("__source").is_none());
        for directory in ["background", "start", "switch", "end"] {
            assert_eq!(
                std::fs::read_to_string(target.join(directory).join("asset.txt")).unwrap(),
                directory
            );
        }

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn failed_save_as_removes_new_target() {
        let root = test_dir("room-save-as-invalid");
        let source = root.join("source");
        let library = root.join("library");
        std::fs::create_dir_all(&source).unwrap();
        std::fs::write(source.join("room.json"), "{}").unwrap();

        let error = save_room_as_dir(
            &source,
            &library,
            "broken-copy",
            r#"{"version":1,"unknown":true}"#,
        )
        .unwrap_err();

        assert!(error.contains("unknown field"));
        assert!(!library.join("broken-copy").exists());
        assert_eq!(
            std::fs::read_to_string(source.join("room.json")).unwrap(),
            "{}"
        );

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn imports_all_v1_content_types_into_requested_slots() {
        let root = test_dir("room-content-import");
        let room = root.join("room");
        let source = root.join("source");
        let original_room_json = "{\"version\":1}";
        std::fs::create_dir_all(&room).unwrap();
        std::fs::create_dir_all(&source).unwrap();
        std::fs::write(room.join("room.json"), original_room_json).unwrap();
        std::fs::write(source.join("scene.png"), "image").unwrap();
        std::fs::write(source.join("scene.mp4"), "video").unwrap();
        std::fs::write(source.join("scene.html"), "<html></html>").unwrap();

        for (slot, content_type, filename) in [
            ("background", "image", "scene.png"),
            ("start", "html", "scene.html"),
            ("switch", "video", "scene.mp4"),
            ("end", "image", "scene.png"),
        ] {
            let content =
                import_room_content_file(&room, &source.join(filename), slot, content_type)
                    .unwrap();
            assert_eq!(content["name"], "scene");
            assert_eq!(content["type"], content_type);
            let relative = content["src"].as_str().unwrap();
            assert!(relative.starts_with(&format!("{slot}/")));
            assert!(room.join(relative).is_file());
        }

        let error =
            import_room_content_file(&room, &source.join("scene.html"), "background", "video")
                .unwrap_err();
        assert!(error.contains("不是有效的video格式"));
        assert_eq!(
            std::fs::read_to_string(room.join("room.json")).unwrap(),
            original_room_json
        );

        std::fs::remove_dir_all(root).unwrap();
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
            r#"{
                "version":1,
                "startDesk":0,
                "switch":"slide",
                "switches":{},
                "desks":[{
                    "name":"Clean",
                    "background":null,
                    "iconSize":"medium",
                    "icons":[]
                }]
            }"#,
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

    #[test]
    fn write_room_strips_source_stamp_and_rejects_unknown_fields() {
        let root = test_dir("room-write-v1");
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("room.json");
        write_room_file(
            &path,
            r#"{
                "version":1,
                "startDesk":0,
                "switches":{},
                "desks":[{
                    "name":"Desk 1",
                    "background":null,
                    "iconSize":"medium",
                    "icons":[]
                }],
                "__source":"C:/forged"
            }"#,
        )
        .unwrap();
        let saved: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert!(saved.get("__source").is_none());

        let error = write_room_file(
            &path,
            r#"{
                "version":1,
                "startDesk":0,
                "switches":{},
                "desks":[{
                    "name":"Desk 1",
                    "background":null,
                    "iconSize":"medium",
                    "icons":[]
                }],
                "runtimeState":true
            }"#,
        )
        .unwrap_err();
        assert!(error.contains("unknown field"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_non_adjacent_switch_direction() {
        let desks = (0..4)
            .map(|index| {
                serde_json::json!({
                    "name": format!("Desk {}", index + 1),
                    "background": null,
                    "iconSize": "medium",
                    "icons": []
                })
            })
            .collect::<Vec<_>>();
        let room = serde_json::json!({
            "version": 1,
            "startDesk": 0,
            "switches": { "0>2": "fade" },
            "desks": desks
        });
        let error = validate_room_v1(&room).unwrap_err();
        assert!(error.contains("not adjacent"));
    }
}
