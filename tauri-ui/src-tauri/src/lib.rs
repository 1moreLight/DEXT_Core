mod grpc;
mod creator;

use tauri::Manager;

pub mod proto {
    pub mod desktop {
        include!(concat!(
            env!("OUT_DIR"),
            "/lively.grpc.common.proto.desktop.rs"
        ));
    }
    pub mod settings {
        include!(concat!(
            env!("OUT_DIR"),
            "/lively.grpc.common.proto.settings.rs"
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
const CMD_ROOM_LAYOUT_SYNC: i32 = 26;
const CMD_DESKTOP_ICON_PREFERENCES: i32 = 27;
static DESK_LAYOUT_SYNC_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[derive(serde::Serialize)]
struct CoverRef {
    kind: String, // "image" | "video"
    src: String,  // path relative to the room dir (forward slashes)
}

#[derive(serde::Serialize)]
struct RoomInfo {
    name: String,
    path: String,
    version: Option<u64>,
    desks: usize,
    icons: usize,
    widgets: usize,
    covers: Vec<CoverRef>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ActiveRoom {
    source_path: String,
    runtime_path: String,
}

struct ActiveWallpaper {
    room: ActiveRoom,
    lively_info_path: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DeskLayoutSyncResult {
    active: bool,
    saved: bool,
    live_updated: bool,
    room_json: Option<String>,
    live_error: Option<String>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DextSettings {
    startup: bool,
    fullscreen_pause: bool,
    battery_pause: bool,
    power_save_pause: bool,
    audio_only_on_desktop: bool,
    desktop_icon_feedback_style: String,
    show_desktop_icon_labels: bool,
    desktop_icon_hit_target_size: String,
    desktop_icon_visual_size: String,
    desktop_icon_spacing: String,
}

#[derive(Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DextSettingsPatch {
    startup: Option<bool>,
    fullscreen_pause: Option<bool>,
    battery_pause: Option<bool>,
    power_save_pause: Option<bool>,
    audio_only_on_desktop: Option<bool>,
    desktop_icon_feedback_style: Option<String>,
    show_desktop_icon_labels: Option<bool>,
    desktop_icon_hit_target_size: Option<String>,
    desktop_icon_visual_size: Option<String>,
    desktop_icon_spacing: Option<String>,
}

impl DextSettingsPatch {
    fn changes_desktop_icons(&self) -> bool {
        self.desktop_icon_feedback_style.is_some()
            || self.show_desktop_icon_labels.is_some()
            || self.desktop_icon_hit_target_size.is_some()
            || self.desktop_icon_visual_size.is_some()
            || self.desktop_icon_spacing.is_some()
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DextSettingsUpdate {
    settings: DextSettings,
    delivery_status: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AboutDocument {
    id: String,
    label: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AboutInfo {
    configurator_version: String,
    documents: Vec<AboutDocument>,
}

const MAX_ARCHIVE_FILES: usize = 2048;
const MAX_ARCHIVE_FILE_BYTES: u64 = 256 * 1024 * 1024;
const MAX_ARCHIVE_TOTAL_BYTES: u64 = 1024 * 1024 * 1024;
const MAX_WIDGETS_PER_DESK: usize = 32;
const MAX_WIDGETS_PER_ROOM: usize = 64;
const MAX_WIDGET_RESOURCES: usize = 256;
const MAX_WIDGET_CONFIG_BYTES: usize = 65_536;
const MAX_WIDGET_CONFIG_DEPTH: usize = 12;

#[derive(Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PermissionStore {
    version: u32,
    rooms: std::collections::BTreeMap<String, RoomPermissionGrant>,
}

#[derive(Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoomPermissionGrant {
    fingerprint: String,
    subjects: std::collections::BTreeMap<String, Vec<String>>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PermissionReview {
    id: String,
    label: String,
    declared: Vec<String>,
    granted: Vec<String>,
    current: bool,
}

fn permission_store_path() -> std::path::PathBuf {
    grpc::local_app_data_path().join("permissions-v1.json")
}

fn normalized_room_path(path: &std::path::Path) -> Result<(std::path::PathBuf, String), String> {
    let candidate = if path.is_dir() { path.join("room.json") } else { path.to_path_buf() };
    if candidate.file_name().and_then(|name| name.to_str()) != Some("room.json") || !candidate.is_file() {
        return Err("permission target must be an existing room.json".into());
    }
    let canonical = candidate
        .canonicalize()
        .map_err(|error| format!("resolve permission target failed: {error}"))?;
    let normalized = canonical.to_string_lossy().replace('\\', "/").to_lowercase();
    Ok((canonical, normalized))
}

fn room_fingerprint(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn permission_subjects(room: &serde_json::Value) -> Vec<(String, String, Vec<String>)> {
    let permissions = |value: &serde_json::Value| {
        value.get("permissions")
            .and_then(|item| item.as_array())
            .into_iter()
            .flatten()
            .filter_map(|item| item.as_str().map(str::to_string))
            .collect::<Vec<_>>()
    };
    let mut subjects = Vec::new();
    for key in ["start", "idle"] {
        if let Some(content) = room.get(key).filter(|item| item.is_object()) {
            subjects.push((format!("scene:{key}"), format!("{} Scene", if key == "start" { "启动" } else { "待机" }), permissions(content)));
        }
    }
    if let Some(switches) = room.get("switches").and_then(|item| item.as_object()) {
        for (route, content) in switches.iter().filter(|(_, item)| item.is_object()) {
            subjects.push((format!("scene:switch:{route}"), format!("切换 {route} Scene"), permissions(content)));
        }
    }
    if let Some(desks) = room.get("desks").and_then(|item| item.as_array()) {
        for (desk_index, desk) in desks.iter().enumerate() {
            if let Some(content) = desk.get("background").filter(|item| item.is_object()) {
                subjects.push((format!("scene:desk:{desk_index}"), format!("Desk {} Scene", desk_index + 1), permissions(content)));
            }
            if let Some(widgets) = desk.get("widgets").and_then(|item| item.as_array()) {
                for widget in widgets {
                    if let Some(id) = widget.get("id").and_then(|item| item.as_str()) {
                        subjects.push((
                            format!("widget:{id}"),
                            widget.get("name").and_then(|item| item.as_str()).unwrap_or(id).to_string(),
                            permissions(widget),
                        ));
                    }
                }
            }
        }
    }
    subjects
}

fn read_permission_store() -> Result<PermissionStore, String> {
    let path = permission_store_path();
    if !path.is_file() {
        return Ok(PermissionStore { version: 1, ..Default::default() });
    }
    let bytes = std::fs::read(&path).map_err(|error| format!("read permission store failed: {error}"))?;
    let store: PermissionStore = serde_json::from_slice(&bytes)
        .map_err(|error| format!("parse permission store failed: {error}"))?;
    if store.version != 1 {
        return Err("unsupported permission store version".into());
    }
    Ok(store)
}

fn write_permission_store(store: &PermissionStore) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(store)
        .map_err(|error| format!("serialize permission store failed: {error}"))?;
    atomic_write(&permission_store_path(), &bytes)
}

#[tauri::command]
async fn get_permission_review(path: String) -> Result<Vec<PermissionReview>, String> {
    let (room_path, key) = normalized_room_path(std::path::Path::new(&path))?;
    let bytes = std::fs::read(&room_path).map_err(|error| format!("read room permissions failed: {error}"))?;
    let room: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|error| format!("parse room permissions failed: {error}"))?;
    validate_room_contract(&room)?;
    validate_room_asset_references(room_path.parent().unwrap(), &room)?;
    let fingerprint = room_fingerprint(&bytes);
    let store = read_permission_store()?;
    let grant = store.rooms.get(&key).filter(|item| item.fingerprint == fingerprint);
    Ok(permission_subjects(&room).into_iter().map(|(id, label, declared)| {
        let granted = grant.and_then(|item| item.subjects.get(&id)).cloned().unwrap_or_default();
        PermissionReview { id, label, declared, granted, current: grant.is_some() }
    }).collect())
}

#[tauri::command]
async fn set_subject_permission(path: String, subject_id: String, approved: bool) -> Result<Vec<PermissionReview>, String> {
    let (room_path, key) = normalized_room_path(std::path::Path::new(&path))?;
    let bytes = std::fs::read(&room_path).map_err(|error| format!("read room permissions failed: {error}"))?;
    let room: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|error| format!("parse room permissions failed: {error}"))?;
    validate_room_contract(&room)?;
    validate_room_asset_references(room_path.parent().unwrap(), &room)?;
    let subjects = permission_subjects(&room);
    let declared = subjects.iter().find(|(id, _, _)| id == &subject_id)
        .map(|(_, _, permissions)| permissions.clone())
        .ok_or_else(|| "permission subject is not part of this Room".to_string())?;
    let fingerprint = room_fingerprint(&bytes);
    let mut store = read_permission_store()?;
    store.version = 1;
    let grant = store.rooms.entry(key).or_default();
    if grant.fingerprint != fingerprint {
        grant.fingerprint = fingerprint;
        grant.subjects.clear();
    }
    if approved {
        grant.subjects.insert(subject_id, declared);
    } else {
        grant.subjects.remove(&subject_id);
    }
    write_permission_store(&store)?;
    get_permission_review(room_path.to_string_lossy().into_owned()).await
}

fn validate_room_library_path(path: &std::path::Path) -> Result<std::path::PathBuf, String> {
    if path.as_os_str().is_empty() {
        return Err("Room library path cannot be empty".into());
    }
    if path.exists() && is_reparse_point(path)? {
        return Err("Room library cannot be a symlink or reparse point".into());
    }
    std::fs::create_dir_all(path)
        .map_err(|error| format!("create Room library failed: {error}"))?;
    if !path.is_dir() {
        return Err("Room library path is not a directory".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("resolve Room library failed: {error}"))?;
    if is_reparse_point(&canonical)? {
        return Err("Room library cannot be a symlink or reparse point".into());
    }
    std::fs::read_dir(&canonical)
        .map_err(|error| format!("Room library is not readable: {error}"))?;

    use std::io::Write;
    let mut probe = tempfile::Builder::new()
        .prefix(".dext-write-check-")
        .tempfile_in(&canonical)
        .map_err(|error| format!("Room library is not writable: {error}"))?;
    probe
        .write_all(b"dext")
        .and_then(|_| probe.flush())
        .map_err(|error| format!("Room library write check failed: {error}"))?;
    probe
        .close()
        .map_err(|error| format!("Room library cleanup check failed: {error}"))?;
    Ok(canonical)
}

#[tauri::command]
async fn validate_room_library(path: String) -> Result<String, String> {
    validate_room_library_path(std::path::Path::new(&path))
        .map(|validated| validated.to_string_lossy().into_owned())
}

#[tauri::command]
async fn about_info() -> Result<AboutInfo, String> {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .map_err(|error| format!("resolve Dext repository failed: {error}"))?;
    let entries = [
        (
            "license",
            "Lively Core 许可证",
            "lively-core-separation/LICENSE",
        ),
        (
            "lively-readme",
            "Lively Core 上游说明",
            "lively-core-separation/README.md",
        ),
        (
            "configurator-readme",
            "Dext 配置器说明",
            "tauri-ui/README.md",
        ),
    ];
    let mut documents = Vec::with_capacity(entries.len());
    for (id, label, relative) in entries {
        let path = root.join(relative);
        if !path.is_file() {
            return Err(format!("About document is missing: {relative}"));
        }
        let canonical = path
            .canonicalize()
            .map_err(|error| format!("resolve About document failed: {error}"))?;
        if !canonical.starts_with(&root) {
            return Err(format!(
                "About document escaped the Dext repository: {relative}"
            ));
        }
        documents.push(AboutDocument {
            id: id.into(),
            label: label.into(),
        });
    }
    Ok(AboutInfo {
        configurator_version: env!("CARGO_PKG_VERSION").into(),
        documents,
    })
}

fn about_document_path(document_id: &str) -> Result<std::path::PathBuf, String> {
    let relative = match document_id {
        "license" => "lively-core-separation/LICENSE",
        "lively-readme" => "lively-core-separation/README.md",
        "configurator-readme" => "tauri-ui/README.md",
        _ => return Err("unknown About document".into()),
    };
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .map_err(|error| format!("resolve Dext repository failed: {error}"))?;
    let path = root
        .join(relative)
        .canonicalize()
        .map_err(|error| format!("resolve About document failed: {error}"))?;
    if !path.is_file() || !path.starts_with(&root) {
        return Err("About document is outside the Dext repository".into());
    }
    Ok(path)
}

#[tauri::command]
async fn open_about_document(app: tauri::AppHandle, document_id: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let path = about_document_path(&document_id)?;
    app.opener()
        .open_path(path.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|error| format!("open About document failed: {error}"))
}

#[tauri::command]
async fn open_dext_directory(app: tauri::AppHandle, kind: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let identity = grpc::core_identity().await?;
    let data = std::path::PathBuf::from(identity.app_data_directory);
    let target = match kind.as_str() {
        "data" => data,
        "logs" => data.join("logs"),
        _ => return Err("unknown Dext directory".into()),
    };
    std::fs::create_dir_all(&target)
        .map_err(|error| format!("create Dext directory failed: {error}"))?;
    let canonical = target
        .canonicalize()
        .map_err(|error| format!("resolve Dext directory failed: {error}"))?;
    app.opener()
        .open_path(canonical.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|error| format!("open Dext directory failed: {error}"))
}

fn is_reparse_point(path: &std::path::Path) -> Result<bool, String> {
    let metadata =
        std::fs::symlink_metadata(path).map_err(|error| format!("inspect path failed: {error}"))?;
    if metadata.file_type().is_symlink() {
        return Ok(true);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        return Ok(metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0);
    }
    #[cfg(not(windows))]
    Ok(false)
}

fn direct_room_entry_in_library(
    library_dir: &std::path::Path,
    room_dir: &std::path::Path,
) -> Result<std::path::PathBuf, String> {
    let library = library_dir
        .canonicalize()
        .map_err(|error| format!("Room library not found: {error}"))?;
    if is_reparse_point(&library)? {
        return Err("Room library cannot be a symlink or reparse point".into());
    }
    let room = room_dir
        .canonicalize()
        .map_err(|error| format!("Room directory not found: {error}"))?;
    if room == library || room.parent() != Some(library.as_path()) {
        return Err("Room must be a direct child of the selected Room library".into());
    }
    if is_reparse_point(&room)? {
        return Err("Room cannot be a symlink or reparse point".into());
    }
    let room_json = room.join("room.json");
    if !room_json.is_file() || is_reparse_point(&room_json)? {
        return Err("selected directory is not a valid Room (room.json missing)".into());
    }
    Ok(room)
}

fn direct_room_in_library(
    library_dir: &std::path::Path,
    room_dir: &std::path::Path,
) -> Result<std::path::PathBuf, String> {
    let room = direct_room_entry_in_library(library_dir, room_dir)?;
    let room_json = room.join("room.json");
    let value: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&room_json)
            .map_err(|error| format!("read room.json failed: {error}"))?,
    )
    .map_err(|error| format!("parse room.json failed: {error}"))?;
    validate_room_contract(&value)?;
    validate_room_asset_references(&room, &value)?;
    Ok(room)
}

fn validate_room_asset_references(
    room_dir: &std::path::Path,
    room: &serde_json::Value,
) -> Result<(), String> {
    let mut references = Vec::new();
    for key in ["start", "idle"] {
        if let Some(src) = room
            .get(key)
            .and_then(|value| value.get("src"))
            .and_then(|value| value.as_str())
        {
            references.push((key.to_string(), src.to_string()));
        }
    }
    if let Some(desks) = room.get("desks").and_then(|value| value.as_array()) {
        for (index, desk) in desks.iter().enumerate() {
            if let Some(src) = desk
                .get("background")
                .and_then(|value| value.get("src"))
                .and_then(|value| value.as_str())
            {
                references.push((format!("desks[{index}].background"), src.to_string()));
            }
            if let Some(widgets) = desk.get("widgets").and_then(|value| value.as_array()) {
                for (widget_index, widget) in widgets.iter().enumerate() {
                    if let Some(resources) =
                        widget.get("resources").and_then(|value| value.as_array())
                    {
                        for (resource_index, resource) in resources.iter().enumerate() {
                            if let Some(resource) = resource.as_str() {
                                references.push((
                                    format!(
                                        "desks[{index}].widgets[{widget_index}].resources[{resource_index}]"
                                    ),
                                    resource.to_string(),
                                ));
                            }
                        }
                    }
                }
            }
        }
    }
    if let Some(switches) = room.get("switches").and_then(|value| value.as_object()) {
        for (route, value) in switches {
            if let Some(src) = value.get("src").and_then(|value| value.as_str()) {
                references.push((format!("switches[{route}]"), src.to_string()));
            }
        }
    }
    for (label, source) in references {
        let path = room_dir.join(source.replace('/', std::path::MAIN_SEPARATOR_STR));
        if !path.is_file() {
            return Err(format!("{label} references missing asset {source:?}"));
        }
        if is_reparse_point(&path)? {
            return Err(format!(
                "{label} asset cannot be a symlink or reparse point"
            ));
        }
    }
    validate_room_contract(room)?;
    validate_widget_resource_inventory(room_dir, room)
}

fn validate_widget_resource_inventory(
    room_dir: &std::path::Path,
    room: &serde_json::Value,
) -> Result<(), String> {
    let mut declared = std::collections::HashSet::new();
    for desk in room
        .get("desks")
        .and_then(|value| value.as_array())
        .into_iter()
        .flatten()
    {
        for widget in desk
            .get("widgets")
            .and_then(|value| value.as_array())
            .into_iter()
            .flatten()
        {
            for resource in widget
                .get("resources")
                .and_then(|value| value.as_array())
                .into_iter()
                .flatten()
            {
                if let Some(resource) = resource.as_str() {
                    declared.insert(resource.to_ascii_lowercase());
                }
            }
        }
    }

    let root = room_dir.join("widgets");
    if !root.exists() {
        return if declared.is_empty() {
            Ok(())
        } else {
            Err("Room v2 declares Widget resources but widgets/ is missing".into())
        };
    }
    if !root.is_dir() || is_reparse_point(&root)? {
        return Err("widgets/ must be a regular directory".into());
    }
    let mut pending = vec![root];
    while let Some(current) = pending.pop() {
        for entry in
            std::fs::read_dir(&current).map_err(|error| format!("read widgets/ failed: {error}"))?
        {
            let entry = entry.map_err(|error| format!("read widgets/ entry failed: {error}"))?;
            let path = entry.path();
            if is_reparse_point(&path)? {
                return Err(format!(
                    "Widget resources cannot contain links: {}",
                    path.display()
                ));
            }
            if path.is_dir() {
                pending.push(path);
            } else if path.is_file() {
                let relative = path
                    .strip_prefix(room_dir)
                    .map_err(|_| "Widget resource escaped Room root".to_string())?
                    .to_string_lossy()
                    .replace('\\', "/")
                    .to_ascii_lowercase();
                if !declared.contains(&relative) {
                    return Err(format!("undeclared Widget resource {relative:?}"));
                }
            } else {
                return Err(format!(
                    "Widget resource is not a regular file: {}",
                    path.display()
                ));
            }
        }
    }
    Ok(())
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

const CONTENT_PERMISSIONS: &[&str] = &[
    "time.read",
    "locale.read",
    "viewport.read",
    "desk.read",
    "playback.read",
    "audio.spectrum",
    "hardware.cpu.read",
    "hardware.gpu.read",
    "hardware.memory.read",
    "now-playing.read",
    "now-playing.artwork.read",
    "system.volume.read",
    "hardware.network.read",
    "action.invoke",
];

fn validate_permissions(
    value: Option<&serde_json::Value>,
    required: bool,
    label: &str,
) -> Result<std::collections::HashSet<String>, String> {
    let Some(value) = value else {
        return if required {
            Err(format!("{label} must be an array"))
        } else {
            Ok(std::collections::HashSet::new())
        };
    };
    let permissions = value
        .as_array()
        .ok_or_else(|| format!("{label} must be an array"))?;
    let mut permission_set = std::collections::HashSet::new();
    for (index, permission) in permissions.iter().enumerate() {
        let permission = permission
            .as_str()
            .ok_or_else(|| format!("{label}[{index}] must be a string"))?;
        if !CONTENT_PERMISSIONS.contains(&permission) {
            return Err(format!("{label} contains unknown permission {permission:?}"));
        }
        if !permission_set.insert(permission.to_string()) {
            return Err(format!("{label} contains duplicate permission {permission:?}"));
        }
    }
    Ok(permission_set)
}

fn validate_hotspots(
    value: Option<&serde_json::Value>,
    bounds_width: u64,
    bounds_height: u64,
    permissions: &std::collections::HashSet<String>,
    label: &str,
) -> Result<(), String> {
    let Some(value) = value else { return Ok(()); };
    let hotspots = value
        .as_array()
        .filter(|items| items.len() <= 64)
        .ok_or_else(|| format!("{label} must be an array with at most 64 items"))?;
    if !hotspots.is_empty() && !permissions.contains("action.invoke") {
        return Err(format!("{label} requires action.invoke permission"));
    }
    let mut ids = std::collections::HashSet::new();
    for (index, hotspot) in hotspots.iter().enumerate() {
        let item_label = format!("{label}[{index}]");
        let object = hotspot
            .as_object()
            .ok_or_else(|| format!("{item_label} must be an object"))?;
        reject_unknown_keys(object, &["id", "label", "placement", "action"], &item_label)?;
        let id = required_string(object, "id", &item_label)?;
        if !widget_id_is_valid(id) || !ids.insert(id.to_string()) {
            return Err(format!("{item_label}.id must be a unique lowercase ASCII slug"));
        }
        ensure_string_limit(
            required_string(object, "label", &item_label)?,
            120,
            &format!("{item_label}.label"),
        )?;
        let placement = object
            .get("placement")
            .and_then(|item| item.as_object())
            .ok_or_else(|| format!("{item_label}.placement must be an object"))?;
        reject_unknown_keys(
            placement,
            &["x", "y", "width", "height", "z"],
            &format!("{item_label}.placement"),
        )?;
        let integer = |key: &str| {
            placement
                .get(key)
                .and_then(|item| item.as_u64())
                .ok_or_else(|| format!("{item_label}.placement.{key} must be a non-negative integer"))
        };
        let x = integer("x")?;
        let y = integer("y")?;
        let width = integer("width")?;
        let height = integer("height")?;
        let z = integer("z")?;
        if width < 16 || height < 16 || x + width > bounds_width || y + height > bounds_height || z > 255 {
            return Err(format!("{item_label}.placement must stay inside its content bounds"));
        }
        let action = object
            .get("action")
            .and_then(|item| item.as_object())
            .ok_or_else(|| format!("{item_label}.action must be an object"))?;
        reject_unknown_keys(action, &["id", "value"], &format!("{item_label}.action"))?;
        let action_id = required_string(action, "id", &format!("{item_label}.action"))?;
        let value = action.get("value");
        match action_id {
            "system.media.play"
            | "system.media.pause"
            | "system.media.toggle-play-pause"
            | "system.media.next"
            | "system.media.previous"
            | "system.volume.toggle-mute" if value.is_none() => {}
            "system.volume.set" if value
                .and_then(|item| item.as_f64())
                .is_some_and(|item| item.is_finite() && (0.0..=1.0).contains(&item)) => {}
            "system.volume.mute" if value.is_some_and(|item| item.is_boolean()) => {}
            _ => return Err(format!("{item_label}.action has an unsupported id or value")),
        }
    }
    Ok(())
}

fn validate_content(value: &serde_json::Value, directory: &str, label: &str) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or_else(|| format!("{label} must be a Content object"))?;
    reject_unknown_keys(object, &["name", "type", "src", "permissions", "hotspots"], label)?;
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
    if content_type != "html" && (object.contains_key("permissions") || object.contains_key("hotspots")) {
        return Err(format!("{label} capabilities are only valid for HTML content"));
    }
    let permissions = validate_permissions(object.get("permissions"), false, &format!("{label}.permissions"))?;
    validate_hotspots(
        object.get("hotspots"),
        1920,
        1080,
        &permissions,
        &format!("{label}.hotspots"),
    )?;
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

fn room_version(room: &serde_json::Value) -> Result<u64, String> {
    room.as_object()
        .ok_or_else(|| "room root must be an object".to_string())?
        .get("version")
        .and_then(|value| value.as_u64())
        .ok_or_else(|| "room.version must be a positive integer".to_string())
}

fn widget_id_is_valid(value: &str) -> bool {
    if value.is_empty() || value.len() > 64 || !value.is_ascii() {
        return false;
    }
    let mut parts = value.split('-');
    let first = parts.next().unwrap_or_default();
    !first.is_empty()
        && first.as_bytes()[0].is_ascii_lowercase()
        && first
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
        && parts.all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
        })
}

fn widget_path_is_valid(path: &str, widget_id: &str, html_only: bool) -> bool {
    const RESOURCE_EXTENSIONS: &[&str] = &[
        "html", "htm", "css", "js", "mjs", "json", "png", "jpg", "jpeg", "webp", "gif", "svg",
        "woff", "woff2", "ttf", "otf",
    ];
    if path.len() > 1024
        || path.contains('\\')
        || path.starts_with('/')
        || !path.starts_with(&format!("widgets/{widget_id}/"))
        || path
            .chars()
            .any(|character| character.is_control() || ":*?\"<>|".contains(character))
        || path.split('/').any(|part| {
            part.is_empty()
                || part == "."
                || part == ".."
                || part.ends_with('.')
                || part.ends_with(' ')
        })
    {
        return false;
    }
    let extension = std::path::Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if html_only {
        matches!(extension, "html" | "htm")
    } else {
        RESOURCE_EXTENSIONS.contains(&extension)
    }
}

fn json_depth(value: &serde_json::Value, depth: usize) -> usize {
    match value {
        serde_json::Value::Object(object) => object
            .values()
            .map(|value| json_depth(value, depth + 1))
            .max()
            .unwrap_or(depth),
        serde_json::Value::Array(array) => array
            .iter()
            .map(|value| json_depth(value, depth + 1))
            .max()
            .unwrap_or(depth),
        _ => depth,
    }
}

fn validate_widget(value: &serde_json::Value, label: &str) -> Result<String, String> {
    let object = value
        .as_object()
        .ok_or_else(|| format!("{label} must be an object"))?;
    reject_unknown_keys(
        object,
        &[
            "id",
            "name",
            "src",
            "resources",
            "placement",
            "config",
            "permissions",
            "hotspots",
        ],
        label,
    )?;
    let id = required_string(object, "id", label)?;
    if !widget_id_is_valid(id) {
        return Err(format!("{label}.id must be a lowercase ASCII slug"));
    }
    ensure_string_limit(
        required_string(object, "name", label)?,
        120,
        &format!("{label}.name"),
    )?;
    let src = required_string(object, "src", label)?;
    if !widget_path_is_valid(src, id, true) {
        return Err(format!(
            "{label}.src must be an HTML file inside widgets/{id}/"
        ));
    }
    let resources = object
        .get("resources")
        .and_then(|value| value.as_array())
        .filter(|items| !items.is_empty() && items.len() <= MAX_WIDGET_RESOURCES)
        .ok_or_else(|| {
            format!("{label}.resources must contain 1..={MAX_WIDGET_RESOURCES} paths")
        })?;
    let mut resource_set = std::collections::HashSet::new();
    for (index, resource) in resources.iter().enumerate() {
        let resource = resource
            .as_str()
            .ok_or_else(|| format!("{label}.resources[{index}] must be a string"))?;
        if !widget_path_is_valid(resource, id, false) {
            return Err(format!(
                "{label}.resources[{index}] must stay inside widgets/{id}/"
            ));
        }
        if !resource_set.insert(resource) {
            return Err(format!(
                "{label}.resources contains duplicate path {resource:?}"
            ));
        }
    }
    if !resource_set.contains(src) {
        return Err(format!("{label}.src must be listed in resources"));
    }
    let placement = object
        .get("placement")
        .and_then(|value| value.as_object())
        .ok_or_else(|| format!("{label}.placement must be an object"))?;
    reject_unknown_keys(
        placement,
        &["x", "y", "width", "height", "z"],
        &format!("{label}.placement"),
    )?;
    let integer = |key: &str| {
        placement
            .get(key)
            .and_then(|value| value.as_u64())
            .ok_or_else(|| format!("{label}.placement.{key} must be a non-negative integer"))
    };
    let x = integer("x")?;
    let y = integer("y")?;
    let width = integer("width")?;
    let height = integer("height")?;
    let z = integer("z")?;
    if !(64..=1920).contains(&width)
        || !(64..=1080).contains(&height)
        || x + width > 1920
        || y + height > 1080
        || z > 255
    {
        return Err(format!(
            "{label}.placement must stay inside the 1920x1080 canvas"
        ));
    }
    let config = object
        .get("config")
        .filter(|value| value.is_object())
        .ok_or_else(|| format!("{label}.config must be an object"))?;
    let config_bytes = serde_json::to_vec(config)
        .map_err(|error| format!("serialize {label}.config failed: {error}"))?;
    if config_bytes.len() > MAX_WIDGET_CONFIG_BYTES {
        return Err(format!(
            "{label}.config exceeds {MAX_WIDGET_CONFIG_BYTES} bytes"
        ));
    }
    if json_depth(config, 1) > MAX_WIDGET_CONFIG_DEPTH {
        return Err(format!(
            "{label}.config exceeds depth {MAX_WIDGET_CONFIG_DEPTH}"
        ));
    }
    let permission_set = validate_permissions(
        object.get("permissions"),
        true,
        &format!("{label}.permissions"),
    )?;
    validate_hotspots(
        object.get("hotspots"),
        width,
        height,
        &permission_set,
        &format!("{label}.hotspots"),
    )?;
    Ok(id.to_string())
}

fn validate_room_v2(room: &serde_json::Value) -> Result<(), String> {
    validate_room_structure(room)?;
    let object = room.as_object().unwrap();

    let desks = object["desks"].as_array().unwrap();
    let mut widget_ids = std::collections::HashSet::new();
    let mut widget_count = 0usize;
    for (desk_index, desk) in desks.iter().enumerate() {
        let label = format!("room.desks[{desk_index}]");
        let desk = desk.as_object().unwrap();
        let widgets = desk
            .get("widgets")
            .and_then(|value| value.as_array())
            .ok_or_else(|| format!("{label}.widgets must be an array"))?;
        if widgets.len() > MAX_WIDGETS_PER_DESK {
            return Err(format!(
                "{label}.widgets exceeds {MAX_WIDGETS_PER_DESK} items"
            ));
        }
        widget_count += widgets.len();
        for (widget_index, widget) in widgets.iter().enumerate() {
            let id = validate_widget(widget, &format!("{label}.widgets[{widget_index}]"))?;
            if !widget_ids.insert(id.clone()) {
                return Err(format!("duplicate Widget id {id:?}"));
            }
        }
    }
    if widget_count > MAX_WIDGETS_PER_ROOM {
        return Err(format!("Room has more than {MAX_WIDGETS_PER_ROOM} Widgets"));
    }
    Ok(())
}

fn validate_room_contract(room: &serde_json::Value) -> Result<(), String> {
    match room_version(room)? {
        2 => validate_room_v2(room),
        version => Err(format!("unsupported room.version {version}")),
    }
}

fn validate_room_structure(room: &serde_json::Value) -> Result<(), String> {
    let object = room
        .as_object()
        .ok_or_else(|| "room root must be an object".to_string())?;
    reject_unknown_keys(
        object,
        &[
            "version",
            "startDesk",
            "start",
            "idle",
            "switch",
            "switches",
            "dock",
            "desks",
        ],
        "room",
    )?;
    if object.get("version").and_then(|value| value.as_u64()) != Some(2) {
        return Err("room.version must be 2".into());
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
    for (key, directory) in [("start", "start"), ("idle", "idle")] {
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
            &["name", "background", "iconSize", "icons", "dock", "widgets"],
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
            let (mut desks, mut icons, mut widgets) = (0usize, 0usize, 0usize);
            let mut version = None;
            let mut covers = Vec::new();
            if let Ok(txt) = std::fs::read_to_string(p.join("room.json")) {
                if let Ok(j) = serde_json::from_str::<serde_json::Value>(&txt) {
                    version = j.get("version").and_then(|value| value.as_u64());
                    if let Some(arr) = j["desks"].as_array() {
                        desks = arr.len();
                        for d in arr {
                            icons += d["icons"].as_array().map(|a| a.len()).unwrap_or(0);
                            widgets += d["widgets"].as_array().map(|a| a.len()).unwrap_or(0);
                            push_cover(&mut covers, &d["background"]);
                        }
                    }
                }
            }
            out.push(RoomInfo {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: p.to_string_lossy().into_owned(),
                version,
                desks,
                icons,
                widgets,
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
    validate_room_contract(&room)?;
    let room_dir = path
        .parent()
        .ok_or_else(|| "room.json target has no parent directory".to_string())?;
    validate_room_asset_references(room_dir, &room)?;
    let bytes = serde_json::to_vec_pretty(&room)
        .map_err(|error| format!("serialize room.json failed: {error}"))?;
    atomic_write(path, &bytes)
}

fn replace_desk_icons(
    room: &mut serde_json::Value,
    desk_index: usize,
    icons: serde_json::Value,
) -> Result<(), String> {
    if !icons.is_array() {
        return Err("Desk icons must be an array".into());
    }
    let desks = room
        .get_mut("desks")
        .and_then(serde_json::Value::as_array_mut)
        .ok_or_else(|| "room.desks must be an array".to_string())?;
    let desk = desks
        .get_mut(desk_index)
        .and_then(serde_json::Value::as_object_mut)
        .ok_or_else(|| "target Desk is outside the Room".to_string())?;
    desk.insert("icons".into(), icons);
    Ok(())
}

fn update_desk_layout_source(
    source: &std::path::Path,
    desk_index: usize,
    icons: serde_json::Value,
) -> Result<String, String> {
    let path = source.join("room.json");
    let mut room: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&path).map_err(|error| format!("read room.json failed: {error}"))?,
    )
    .map_err(|error| format!("parse room.json failed: {error}"))?;
    replace_desk_icons(&mut room, desk_index, icons)?;
    let object = room
        .as_object_mut()
        .ok_or_else(|| "room root must be an object".to_string())?;
    object.remove("__source");
    let room_json = serde_json::to_string_pretty(&room)
        .map_err(|error| format!("serialize room.json failed: {error}"))?;
    write_room_file(&path, &room_json)?;
    Ok(room_json)
}

fn room_layout_message(
    room_json: &str,
    desk_index: usize,
    enter_edit: bool,
    highlight_target: Option<&str>,
) -> Result<String, String> {
    let room: serde_json::Value = serde_json::from_str(room_json)
        .map_err(|error| format!("serialize room layout message failed: {error}"))?;
    let mut source_contract = room.clone();
    source_contract
        .as_object_mut()
        .ok_or_else(|| "room layout message root must be an object".to_string())?
        .remove("__source");
    validate_room_contract(&source_contract)?;
    serde_json::to_string(&serde_json::json!({
        "Type": CMD_ROOM_LAYOUT_SYNC,
        "RoomJson": room_json,
        "DeskIndex": desk_index,
        "EnterEdit": enter_edit,
        "HighlightTarget": highlight_target.unwrap_or_default(),
    }))
    .map_err(|error| format!("serialize room layout message failed: {error}"))
}

fn write_runtime_desk_layout(
    runtime_dir: &std::path::Path,
    room_json: &str,
    source: &std::path::Path,
) -> Result<String, String> {
    let mut runtime_room: serde_json::Value = serde_json::from_str(room_json)
        .map_err(|error| format!("parse synced room.json failed: {error}"))?;
    let runtime_object = runtime_room
        .as_object_mut()
        .ok_or_else(|| "synced room root must be an object".to_string())?;
    runtime_object.insert(
        "__source".into(),
        serde_json::Value::String(display_path(source)),
    );
    let runtime_json = serde_json::to_string_pretty(&runtime_room)
        .map_err(|error| format!("serialize active room.json failed: {error}"))?;
    atomic_write(&runtime_dir.join("room.json"), runtime_json.as_bytes())
        .map_err(|error| format!("write active room.json failed: {error}"))?;
    Ok(runtime_json)
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
        "version": 2,
        "startDesk": 0,
        "switch": "slide",
        "switches": {},
        "desks": [{
            "name": "Desk 1",
            "background": null,
            "iconSize": "medium",
            "icons": [],
            "widgets": []
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

const ROOM_CONTENT_DIRS: [&str; 4] = ["background", "switch", "start", "idle"];
const ROOM_ASSET_DIRS: [&str; 5] = ["background", "switch", "start", "idle", "widgets"];
const ROOM_LEGACY_PATHS: [&str; 4] = ["transition", "end", "room.js", "room.css"];

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
    let mut target_value: serde_json::Value = serde_json::from_str(room_json)
        .map_err(|error| format!("parse target room.json failed: {error}"))?;
    target_value
        .as_object_mut()
        .ok_or_else(|| "room root must be an object".to_string())?
        .remove("__source");
    validate_room_contract(&target_value)?;
    let source_value: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(source_room.join("room.json"))
            .map_err(|error| format!("read source room.json failed: {error}"))?,
    )
    .map_err(|error| format!("parse source room.json failed: {error}"))?;
    validate_room_contract(&source_value)?;
    validate_room_asset_references(&source_room, &target_value)?;

    let target = create_room_dir(destination_root, name)?;
    let result = (|| {
        for directory in ROOM_ASSET_DIRS {
            let source = source_room.join(directory);
            if source.is_dir() {
                copy_room_dir(&source, &target.join(directory), directory)?;
            } else {
                std::fs::create_dir_all(target.join(directory))
                    .map_err(|error| format!("mkdir {directory} failed: {error}"))?;
            }
        }
        write_room_file(&target.join("room.json"), room_json)?;
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

fn duplicate_room_dir(
    library_dir: &std::path::Path,
    room_dir: &std::path::Path,
    name: &str,
) -> Result<std::path::PathBuf, String> {
    let source = direct_room_in_library(library_dir, room_dir)?;
    let room_json = std::fs::read_to_string(source.join("room.json"))
        .map_err(|error| format!("read source room.json failed: {error}"))?;
    save_room_as_dir(&source, library_dir, name, &room_json)
}

#[tauri::command]
async fn duplicate_room(
    library_dir: String,
    room_dir: String,
    name: String,
) -> Result<String, String> {
    duplicate_room_dir(
        std::path::Path::new(&library_dir),
        std::path::Path::new(&room_dir),
        &name,
    )
    .map(|path| path.to_string_lossy().into_owned())
}

fn rename_room_dir(
    library_dir: &std::path::Path,
    room_dir: &std::path::Path,
    name: &str,
) -> Result<std::path::PathBuf, String> {
    validate_room_name(name)?;
    let source = direct_room_in_library(library_dir, room_dir)?;
    let library = source
        .parent()
        .ok_or_else(|| "Room has no library parent".to_string())?;
    let target = library.join(name);
    if target.exists() {
        return Err(format!("room already exists: {name}"));
    }
    std::fs::rename(&source, &target)
        .map_err(|error| format!("rename Room failed: {error}"))?;
    Ok(target)
}

#[tauri::command]
async fn rename_room(
    library_dir: String,
    room_dir: String,
    name: String,
) -> Result<String, String> {
    rename_room_dir(
        std::path::Path::new(&library_dir),
        std::path::Path::new(&room_dir),
        &name,
    )
    .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn delete_room(library_dir: String, room_dir: String) -> Result<(), String> {
    let room = direct_room_entry_in_library(
        std::path::Path::new(&library_dir),
        std::path::Path::new(&room_dir),
    )?;
    trash::delete(&room).map_err(|error| {
        format!(
            "move Room {:?} to the Windows Recycle Bin failed: {error}",
            room.file_name().unwrap_or_default()
        )
    })
}

fn zip_directory(
    writer: &mut zip::ZipWriter<&mut std::fs::File>,
    root: &std::path::Path,
    directory: &str,
) -> Result<(), String> {
    use std::io::Write;
    let source = root.join(directory);
    if !source.exists() {
        return Ok(());
    }
    if !source.is_dir() || is_reparse_point(&source)? {
        return Err(format!("{directory}/ must be a regular directory"));
    }
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);
    let mut pending = vec![source];
    while let Some(current) = pending.pop() {
        let mut entries = std::fs::read_dir(&current)
            .map_err(|error| format!("read {directory}/ failed: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("read {directory}/ entry failed: {error}"))?;
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let path = entry.path();
            if is_reparse_point(&path)? {
                return Err(format!(
                    "archive input cannot contain links: {}",
                    path.display()
                ));
            }
            if path.is_dir() {
                pending.push(path);
                continue;
            }
            if !path.is_file() {
                return Err(format!(
                    "archive input is not a regular file: {}",
                    path.display()
                ));
            }
            let relative = path
                .strip_prefix(root)
                .map_err(|_| "archive path escaped Room root".to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            writer
                .start_file(relative, options)
                .map_err(|error| format!("write zip entry failed: {error}"))?;
            let bytes = std::fs::read(&path)
                .map_err(|error| format!("read archive asset failed: {error}"))?;
            writer
                .write_all(&bytes)
                .map_err(|error| format!("write zip asset failed: {error}"))?;
        }
    }
    Ok(())
}

fn export_room_zip_file(
    room_dir: &std::path::Path,
    destination: &std::path::Path,
) -> Result<(), String> {
    use std::io::Write;
    let mut room: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(room_dir.join("room.json"))
            .map_err(|error| format!("read room.json failed: {error}"))?,
    )
    .map_err(|error| format!("parse room.json failed: {error}"))?;
    room.as_object_mut()
        .ok_or_else(|| "room root must be an object".to_string())?
        .remove("__source");
    validate_room_contract(&room)?;
    validate_room_asset_references(room_dir, &room)?;

    let parent = destination
        .parent()
        .ok_or_else(|| "zip destination has no parent directory".to_string())?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("create zip destination failed: {error}"))?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|error| format!("create temporary zip failed: {error}"))?;
    {
        let mut writer = zip::ZipWriter::new(temp.as_file_mut());
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o644);
        writer
            .start_file("room.json", options)
            .map_err(|error| format!("write room.json entry failed: {error}"))?;
        writer
            .write_all(
                &serde_json::to_vec_pretty(&room)
                    .map_err(|error| format!("serialize room.json failed: {error}"))?,
            )
            .map_err(|error| format!("write room.json entry failed: {error}"))?;
        for directory in ROOM_ASSET_DIRS {
            zip_directory(&mut writer, room_dir, directory)?;
        }
        writer
            .finish()
            .map_err(|error| format!("finish zip failed: {error}"))?;
    }
    temp.as_file_mut()
        .sync_all()
        .map_err(|error| format!("flush zip failed: {error}"))?;
    if destination.exists() {
        return Err(format!(
            "destination already exists: {}",
            destination.display()
        ));
    }
    temp.persist(destination)
        .map(|_| ())
        .map_err(|error| format!("commit zip failed: {}", error.error))
}

#[tauri::command]
async fn export_room_zip(
    library_dir: String,
    room_dir: String,
    destination: String,
) -> Result<String, String> {
    let room = direct_room_in_library(
        std::path::Path::new(&library_dir),
        std::path::Path::new(&room_dir),
    )?;
    let destination = std::path::PathBuf::from(destination);
    export_room_zip_file(&room, &destination)?;
    Ok(destination.to_string_lossy().into_owned())
}

fn validate_archive_entry_name(name: &str) -> Result<std::path::PathBuf, String> {
    if name.is_empty()
        || name.starts_with('/')
        || name.starts_with('\\')
        || name.contains('\\')
        || name.contains(':')
        || name.contains('\0')
    {
        return Err(format!("unsafe zip entry path: {name:?}"));
    }
    let path = std::path::Path::new(name);
    if path.components().any(|component| {
        matches!(
            component,
            std::path::Component::ParentDir
                | std::path::Component::RootDir
                | std::path::Component::Prefix(_)
        )
    }) {
        return Err(format!("unsafe zip entry path: {name:?}"));
    }
    let top = path
        .components()
        .next()
        .and_then(|component| component.as_os_str().to_str())
        .unwrap_or_default();
    if top != "room.json" && !ROOM_ASSET_DIRS.contains(&top) {
        return Err(format!("unsupported top-level zip entry: {top:?}"));
    }
    if top == "room.json" && path.components().count() != 1 {
        return Err("room.json must be at the zip root".into());
    }
    Ok(path.to_path_buf())
}

fn import_room_zip_file(
    library_dir: &std::path::Path,
    archive_path: &std::path::Path,
    requested_name: Option<&str>,
) -> Result<std::path::PathBuf, String> {
    use std::io::Read;
    let library = library_dir
        .canonicalize()
        .or_else(|_| {
            std::fs::create_dir_all(library_dir)?;
            library_dir.canonicalize()
        })
        .map_err(|error: std::io::Error| format!("prepare Room library failed: {error}"))?;
    if is_reparse_point(&library)? {
        return Err("Room library cannot be a symlink or reparse point".into());
    }
    if !archive_path.is_file() || is_reparse_point(archive_path)? {
        return Err("selected archive is not a regular zip file".into());
    }
    let file = std::fs::File::open(archive_path)
        .map_err(|error| format!("open Room zip failed: {error}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|error| format!("open Room zip failed: {error}"))?;
    if archive.len() == 0 || archive.len() > MAX_ARCHIVE_FILES {
        return Err(format!(
            "Room zip must contain 1..={MAX_ARCHIVE_FILES} entries"
        ));
    }
    let staging = tempfile::Builder::new()
        .prefix(".dext-import-")
        .tempdir_in(&library)
        .map_err(|error| format!("create import staging directory failed: {error}"))?;
    let mut names = std::collections::HashSet::new();
    let mut total = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("read zip entry failed: {error}"))?;
        let name = entry.name().to_string();
        let relative = validate_archive_entry_name(&name)?;
        let normalized = name.trim_end_matches('/').to_ascii_lowercase();
        if normalized.is_empty() || !names.insert(normalized) {
            return Err(format!("duplicate zip entry: {name:?}"));
        }
        if entry
            .unix_mode()
            .is_some_and(|mode| mode & 0o170000 == 0o120000)
        {
            return Err(format!("zip entry cannot be a symbolic link: {name:?}"));
        }
        if entry.size() > MAX_ARCHIVE_FILE_BYTES {
            return Err(format!("zip entry is too large: {name:?}"));
        }
        total = total
            .checked_add(entry.size())
            .ok_or_else(|| "Room zip size overflow".to_string())?;
        if total > MAX_ARCHIVE_TOTAL_BYTES {
            return Err("Room zip expands beyond the 1 GiB limit".into());
        }
        if entry.size() > 10 * 1024 * 1024
            && (entry.compressed_size() == 0 || entry.size() / entry.compressed_size().max(1) > 500)
        {
            return Err(format!("suspicious compression ratio for {name:?}"));
        }
        let output = staging.path().join(relative);
        if entry.is_dir() {
            std::fs::create_dir_all(&output)
                .map_err(|error| format!("create extracted directory failed: {error}"))?;
            continue;
        }
        let parent = output
            .parent()
            .ok_or_else(|| format!("invalid zip entry path: {name:?}"))?;
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("create extracted directory failed: {error}"))?;
        let mut output_file = std::fs::File::create(&output)
            .map_err(|error| format!("create extracted file failed: {error}"))?;
        let copied = std::io::copy(
            &mut entry.by_ref().take(MAX_ARCHIVE_FILE_BYTES + 1),
            &mut output_file,
        )
        .map_err(|error| format!("extract zip entry failed: {error}"))?;
        if copied > MAX_ARCHIVE_FILE_BYTES {
            return Err(format!("zip entry is too large: {name:?}"));
        }
    }
    let room_path = staging.path().join("room.json");
    if !room_path.is_file() {
        return Err("Room zip is missing root room.json".into());
    }
    let mut room: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&room_path)
            .map_err(|error| format!("read imported room.json failed: {error}"))?,
    )
    .map_err(|error| format!("parse imported room.json failed: {error}"))?;
    if room.get("__source").is_some() {
        return Err("imported room.json must not contain __source".into());
    }
    room.as_object_mut()
        .ok_or_else(|| "room root must be an object".to_string())?;
    validate_room_contract(&room)?;
    validate_room_asset_references(staging.path(), &room)?;
    for directory in ROOM_ASSET_DIRS {
        std::fs::create_dir_all(staging.path().join(directory))
            .map_err(|error| format!("create imported {directory} directory failed: {error}"))?;
    }

    let inferred = archive_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("imported-room");
    let name = requested_name.unwrap_or(inferred).trim();
    validate_room_name(name)?;
    let destination = library.join(name);
    if destination.exists() {
        return Err(format!(
            "room already exists: {name}; choose a different name"
        ));
    }
    let staged = staging.keep();
    if let Err(error) = std::fs::rename(&staged, &destination) {
        let _ = std::fs::remove_dir_all(&staged);
        return Err(format!("commit imported Room failed: {error}"));
    }
    Ok(destination)
}

#[tauri::command]
async fn import_room_zip(
    library_dir: String,
    archive_path: String,
    requested_name: Option<String>,
) -> Result<String, String> {
    import_room_zip_file(
        std::path::Path::new(&library_dir),
        std::path::Path::new(&archive_path),
        requested_name.as_deref(),
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
    validate_room_contract(&room)?;
    validate_room_asset_references(src, &room)?;
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
    sync_room_to_package(src, pkg, &display_path(&canonical))?;
    grpc::set_wallpaper(WALLPAPER_DIR).await
}

fn display_path(path: &std::path::Path) -> String {
    let value = path.to_string_lossy();
    #[cfg(windows)]
    {
        if let Some(stripped) = value.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{stripped}");
        }
        if let Some(stripped) = value.strip_prefix(r"\\?\") {
            return stripped.to_string();
        }
    }
    value.into_owned()
}

fn normalized_path(path: &std::path::Path) -> String {
    path.to_string_lossy()
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

async fn active_wallpaper_value() -> Result<Option<ActiveWallpaper>, String> {
    let wallpapers = grpc::get_wallpapers().await?;
    let runtime = std::path::Path::new(WALLPAPER_DIR)
        .canonicalize()
        .unwrap_or_else(|_| std::path::PathBuf::from(WALLPAPER_DIR));
    let runtime_norm = normalized_path(&runtime);
    let running = wallpapers.into_iter().find(|wallpaper| {
        let path = std::path::Path::new(&wallpaper.path)
            .canonicalize()
            .unwrap_or_else(|_| std::path::PathBuf::from(&wallpaper.path));
        let candidate = normalized_path(&path);
        candidate == runtime_norm || candidate.starts_with(&(runtime_norm.clone() + "\\"))
    });
    let Some(running) = running else { return Ok(None); };
    let room: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(runtime.join("room.json"))
            .map_err(|error| format!("read active room.json failed: {error}"))?,
    )
    .map_err(|error| format!("parse active room.json failed: {error}"))?;
    let source = room
        .get("__source")
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "active Dext package has no trusted __source".to_string())?;
    Ok(Some(ActiveWallpaper {
        room: ActiveRoom {
            source_path: display_path(std::path::Path::new(source)),
            runtime_path: display_path(&runtime),
        },
        lively_info_path: running.path,
    }))
}

async fn active_room_value() -> Result<Option<ActiveRoom>, String> {
    active_wallpaper_value().await.map(|active| active.map(|value| value.room))
}

#[tauri::command]
async fn active_room() -> Result<Option<ActiveRoom>, String> {
    active_room_value().await
}

#[tauri::command]
async fn sync_active_desk_icons(
    library_dir: String,
    room_dir: String,
    desk_index: usize,
    icons: serde_json::Value,
    enter_edit: bool,
    highlight_target: Option<String>,
) -> Result<DeskLayoutSyncResult, String> {
    let _guard = DESK_LAYOUT_SYNC_LOCK.lock().await;
    let source = direct_room_in_library(
        std::path::Path::new(&library_dir),
        std::path::Path::new(&room_dir),
    )?;
    let Some(active) = active_wallpaper_value().await? else {
        return Ok(DeskLayoutSyncResult {
            active: false,
            saved: false,
            live_updated: false,
            room_json: None,
            live_error: None,
        });
    };
    let active_source = std::path::Path::new(&active.room.source_path)
        .canonicalize()
        .unwrap_or_else(|_| std::path::PathBuf::from(&active.room.source_path));
    if normalized_path(&source) != normalized_path(&active_source) {
        return Ok(DeskLayoutSyncResult {
            active: false,
            saved: false,
            live_updated: false,
            room_json: None,
            live_error: None,
        });
    }

    let room_json = update_desk_layout_source(&source, desk_index, icons)?;
    let runtime_result = write_runtime_desk_layout(
        std::path::Path::new(WALLPAPER_DIR),
        &room_json,
        &source,
    );
    let runtime_json = match runtime_result {
        Ok(value) => value,
        Err(error) => return Ok(DeskLayoutSyncResult {
            active: true,
            saved: true,
            live_updated: false,
            room_json: Some(room_json),
            live_error: Some(error),
        }),
    };
    let message = match room_layout_message(
        &runtime_json,
        desk_index,
        enter_edit,
        highlight_target.as_deref(),
    ) {
        Ok(value) => value,
        Err(error) => return Ok(DeskLayoutSyncResult {
            active: true,
            saved: true,
            live_updated: false,
            room_json: Some(room_json),
            live_error: Some(error),
        }),
    };
    match grpc::send_message_wallpaper(&active.lively_info_path, &message).await {
        Ok(()) => Ok(DeskLayoutSyncResult {
            active: true,
            saved: true,
            live_updated: true,
            room_json: Some(room_json),
            live_error: None,
        }),
        Err(error) => Ok(DeskLayoutSyncResult {
            active: true,
            saved: true,
            live_updated: false,
            room_json: Some(room_json),
            live_error: Some(error),
        }),
    }
}

#[tauri::command]
async fn stop_wallpapers() -> Result<(), String> {
    grpc::close_all_wallpapers().await
}

fn desktop_icon_feedback_name(value: i32) -> &'static str {
    match value {
        1 => "compact",
        2 => "bare",
        _ => "halo",
    }
}

fn desktop_icon_size_name(value: i32) -> &'static str {
    match value {
        1 => "small",
        2 => "large",
        _ => "standard",
    }
}

fn desktop_icon_spacing_name(value: i32) -> &'static str {
    match value {
        1 => "compact",
        2 => "spacious",
        _ => "standard",
    }
}

fn parse_desktop_icon_feedback(value: &str) -> Result<i32, String> {
    match value {
        "halo" => Ok(0),
        "compact" => Ok(1),
        "bare" => Ok(2),
        _ => Err(format!("unsupported desktop icon feedback style: {value}")),
    }
}

fn parse_desktop_icon_size(value: &str, label: &str) -> Result<i32, String> {
    match value {
        "standard" => Ok(0),
        "small" => Ok(1),
        "large" => Ok(2),
        _ => Err(format!("unsupported desktop icon {label}: {value}")),
    }
}

fn parse_desktop_icon_spacing(value: &str) -> Result<i32, String> {
    match value {
        "standard" => Ok(0),
        "compact" => Ok(1),
        "spacious" => Ok(2),
        _ => Err(format!("unsupported desktop icon spacing: {value}")),
    }
}

static DESKTOP_ICON_REVISION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn next_desktop_icon_revision() -> u64 {
    use std::sync::atomic::Ordering;
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let mut previous = DESKTOP_ICON_REVISION.load(Ordering::Relaxed);
    loop {
        let next = millis.max(previous + 1);
        match DESKTOP_ICON_REVISION.compare_exchange_weak(previous, next, Ordering::SeqCst, Ordering::Relaxed) {
            Ok(_) => return next,
            Err(current) => previous = current,
        }
    }
}

fn desktop_icon_preferences_message(
    settings: &crate::proto::settings::SettingsDataModel,
    revision: u64,
) -> Result<String, String> {
    serde_json::to_string(&serde_json::json!({
        "Type": CMD_DESKTOP_ICON_PREFERENCES,
        "FeedbackStyle": desktop_icon_feedback_name(settings.desktop_icon_feedback_style),
        "ShowLabels": settings.show_desktop_icon_labels.unwrap_or(true),
        "HitTargetSize": desktop_icon_size_name(settings.desktop_icon_hit_target_size),
        "VisualSize": desktop_icon_size_name(settings.desktop_icon_visual_size),
        "Spacing": desktop_icon_spacing_name(settings.desktop_icon_spacing),
        "Revision": revision,
    }))
    .map_err(|error| format!("serialize desktop icon preferences failed: {error}"))
}

fn settings_view(settings: &crate::proto::settings::SettingsDataModel) -> DextSettings {
    DextSettings {
        startup: settings.startup,
        fullscreen_pause: settings.app_fullscreen_pause == 0,
        battery_pause: settings.battery_pause == 0,
        power_save_pause: settings.power_save_mode_pause == 0,
        audio_only_on_desktop: settings.audio_only_on_desktop,
        desktop_icon_feedback_style: desktop_icon_feedback_name(
            settings.desktop_icon_feedback_style,
        )
        .into(),
        show_desktop_icon_labels: settings.show_desktop_icon_labels.unwrap_or(true),
        desktop_icon_hit_target_size: desktop_icon_size_name(settings.desktop_icon_hit_target_size)
            .into(),
        desktop_icon_visual_size: desktop_icon_size_name(settings.desktop_icon_visual_size).into(),
        desktop_icon_spacing: desktop_icon_spacing_name(settings.desktop_icon_spacing).into(),
    }
}

#[tauri::command]
async fn get_dext_settings() -> Result<DextSettings, String> {
    grpc::get_settings()
        .await
        .map(|settings| settings_view(&settings))
}

fn apply_settings_patch(
    settings: &mut crate::proto::settings::SettingsDataModel,
    patch: DextSettingsPatch,
) -> Result<(), String> {
    if let Some(value) = patch.startup {
        settings.startup = value;
    }
    if let Some(value) = patch.fullscreen_pause {
        settings.app_fullscreen_pause = if value { 0 } else { 1 };
    }
    if let Some(value) = patch.battery_pause {
        settings.battery_pause = if value { 0 } else { 1 };
    }
    if let Some(value) = patch.power_save_pause {
        settings.power_save_mode_pause = if value { 0 } else { 1 };
    }
    if let Some(value) = patch.audio_only_on_desktop {
        settings.audio_only_on_desktop = value;
    }
    if let Some(value) = patch.desktop_icon_feedback_style {
        settings.desktop_icon_feedback_style = parse_desktop_icon_feedback(&value)?;
    }
    if let Some(value) = patch.show_desktop_icon_labels {
        settings.show_desktop_icon_labels = Some(value);
    }
    if let Some(value) = patch.desktop_icon_hit_target_size {
        settings.desktop_icon_hit_target_size = parse_desktop_icon_size(&value, "hit target size")?;
    }
    if let Some(value) = patch.desktop_icon_visual_size {
        settings.desktop_icon_visual_size = parse_desktop_icon_size(&value, "visual size")?;
    }
    if let Some(value) = patch.desktop_icon_spacing {
        settings.desktop_icon_spacing = parse_desktop_icon_spacing(&value)?;
    }
    Ok(())
}

#[tauri::command]
async fn patch_dext_settings(patch: DextSettingsPatch) -> Result<DextSettingsUpdate, String> {
    let changes_desktop_icons = patch.changes_desktop_icons();
    let mut settings = grpc::get_settings().await?;
    apply_settings_patch(&mut settings, patch)?;
    grpc::set_settings(&settings).await?;
    let delivery_status = if !changes_desktop_icons {
        "not_needed"
    } else {
        let message = desktop_icon_preferences_message(&settings, next_desktop_icon_revision());
        match (active_wallpaper_value().await, message) {
            (Ok(Some(active)), Ok(message)) => {
                if grpc::send_message_wallpaper(&active.lively_info_path, &message)
                    .await
                    .is_ok()
                {
                    "applied"
                } else {
                    "deferred"
                }
            }
            _ => "deferred",
        }
    };
    Ok(DextSettingsUpdate {
        settings: settings_view(&settings),
        delivery_status: delivery_status.into(),
    })
}

async fn diagnostic_value() -> Result<serde_json::Value, String> {
    let identity = grpc::core_identity().await?;
    let wallpapers = grpc::get_wallpapers().await?;
    let active = active_room_value().await?;
    Ok(serde_json::json!({
        "configuratorVersion": env!("CARGO_PKG_VERSION"),
        "core": identity,
        "pipe": grpc::pipe_name(),
        "dataDirectory": identity.app_data_directory,
        "logDirectory": std::path::Path::new(&identity.app_data_directory).join("logs"),
        "wallpapers": wallpapers,
        "activeRoom": active,
    }))
}

#[tauri::command]
async fn diagnostics_json() -> Result<String, String> {
    serde_json::to_string_pretty(&diagnostic_value().await?)
        .map_err(|error| format!("serialize diagnostics failed: {error}"))
}

#[tauri::command]
async fn export_diagnostics(path: String) -> Result<String, String> {
    let value = diagnostic_value().await?;
    let bytes = serde_json::to_vec_pretty(&value)
        .map_err(|error| format!("serialize diagnostics failed: {error}"))?;
    let path = std::path::PathBuf::from(path);
    atomic_write(&path, &bytes)?;
    Ok(path.to_string_lossy().into_owned())
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
    let room: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(room_dir.join("room.json"))
            .map_err(|error| format!("read room.json failed: {error}"))?,
    )
    .map_err(|error| format!("parse room.json failed: {error}"))?;
    validate_room_contract(&room)?;
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
    if !ROOM_CONTENT_DIRS.contains(&slot) {
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

// Reuse the existing command name, but make it a generic Room content importer for
// background/start/switch/idle instead of maintaining one copy path per UI button.
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

fn copy_widget_source(
    source_root: &std::path::Path,
    current: &std::path::Path,
    target_root: &std::path::Path,
    widget_id: &str,
    resources: &mut Vec<String>,
    total_bytes: &mut u64,
) -> Result<(), String> {
    if is_reparse_point(current)? {
        return Err("Widget source cannot contain symlinks or reparse points".into());
    }
    for entry in std::fs::read_dir(current)
        .map_err(|error| format!("read Widget source failed: {error}"))?
    {
        let entry = entry.map_err(|error| format!("read Widget entry failed: {error}"))?;
        let path = entry.path();
        if is_reparse_point(&path)? {
            return Err(format!("Widget source contains a link: {}", path.display()));
        }
        let relative = path
            .strip_prefix(source_root)
            .map_err(|_| "Widget source escaped its root".to_string())?;
        let target = target_root.join(relative);
        if path.is_dir() {
            std::fs::create_dir_all(&target)
                .map_err(|error| format!("create Widget directory failed: {error}"))?;
            copy_widget_source(source_root, &path, target_root, widget_id, resources, total_bytes)?;
            continue;
        }
        if !path.is_file() {
            return Err(format!("Widget resource is not a regular file: {}", path.display()));
        }
        let relative_text = relative.to_string_lossy().replace('\\', "/");
        let room_path = format!("widgets/{widget_id}/{relative_text}");
        if !widget_path_is_valid(&room_path, widget_id, false) {
            return Err(format!("unsupported Widget resource path {relative_text:?}"));
        }
        if resources.len() >= MAX_WIDGET_RESOURCES {
            return Err(format!("Widget exceeds {MAX_WIDGET_RESOURCES} resources"));
        }
        let bytes = path
            .metadata()
            .map_err(|error| format!("inspect Widget resource failed: {error}"))?
            .len();
        if bytes > MAX_ARCHIVE_FILE_BYTES {
            return Err(format!("Widget resource is too large: {relative_text}"));
        }
        *total_bytes = total_bytes
            .checked_add(bytes)
            .ok_or_else(|| "Widget resource size overflow".to_string())?;
        if *total_bytes > MAX_ARCHIVE_TOTAL_BYTES {
            return Err("Widget resources exceed the package size limit".into());
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("create Widget resource directory failed: {error}"))?;
        }
        std::fs::copy(&path, &target)
            .map_err(|error| format!("copy Widget resource failed: {error}"))?;
        resources.push(room_path);
    }
    Ok(())
}

fn import_widget_dir(
    room_dir: &std::path::Path,
    source_dir: &std::path::Path,
    widget_id: &str,
    widget_name: &str,
    desk_index: usize,
    room_json: &str,
) -> Result<serde_json::Value, String> {
    if !widget_id_is_valid(widget_id) {
        return Err("Widget id must be a lowercase ASCII slug".into());
    }
    if widget_name.trim().is_empty() || widget_name.chars().count() > 120 {
        return Err("Widget name must contain 1..=120 characters".into());
    }
    if !room_dir.join("room.json").is_file() {
        return Err("not a Room directory (room.json missing)".into());
    }
    let source = source_dir
        .canonicalize()
        .map_err(|error| format!("resolve Widget source failed: {error}"))?;
    if !source.is_dir() || is_reparse_point(&source)? {
        return Err("Widget source must be a regular directory".into());
    }
    let room_root = room_dir
        .canonicalize()
        .map_err(|error| format!("resolve Room failed: {error}"))?;
    if source.starts_with(&room_root) {
        return Err("Widget source must be outside the target Room".into());
    }
    let mut room: serde_json::Value = serde_json::from_str(room_json)
        .map_err(|error| format!("parse Room draft failed: {error}"))?;
    validate_room_contract(&room)?;
    let desks = room
        .get("desks")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Room draft desks are missing".to_string())?;
    let desk = desks
        .get(desk_index)
        .and_then(|value| value.as_object())
        .ok_or_else(|| "target Desk is outside the Room".to_string())?;
    let widgets = desk
        .get("widgets")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "target Desk widgets are missing".to_string())?;
    let widget_count = widgets.len();
    if widget_count >= MAX_WIDGETS_PER_DESK {
        return Err(format!("Desk already has {MAX_WIDGETS_PER_DESK} Widgets"));
    }
    let duplicate = desks.iter().any(|desk| {
        desk.get("widgets")
            .and_then(|value| value.as_array())
            .into_iter()
            .flatten()
            .any(|widget| widget.get("id").and_then(|value| value.as_str()) == Some(widget_id))
    });
    if duplicate {
        return Err(format!("Widget id already exists: {widget_id}"));
    }

    let widgets_root = room_root.join("widgets");
    std::fs::create_dir_all(&widgets_root)
        .map_err(|error| format!("create widgets directory failed: {error}"))?;
    let target = widgets_root.join(widget_id);
    if target.exists() {
        return Err(format!("Widget directory already exists: {widget_id}"));
    }
    let staging = widgets_root.join(format!(".dext-import-{widget_id}-{}", std::process::id()));
    if staging.exists() {
        return Err("Widget import staging directory already exists".into());
    }
    std::fs::create_dir(&staging)
        .map_err(|error| format!("create Widget staging directory failed: {error}"))?;
    let result = (|| {
        let mut resources = Vec::new();
        let mut total_bytes = 0;
        copy_widget_source(&source, &source, &staging, widget_id, &mut resources, &mut total_bytes)?;
        resources.sort();
        let src = format!("widgets/{widget_id}/index.html");
        if !resources.iter().any(|resource| resource == &src) {
            return Err("Widget source must contain index.html".into());
        }
        let offset = widget_count as u64 * 32;
        let widget = serde_json::json!({
            "id": widget_id,
            "name": widget_name.trim(),
            "src": src,
            "resources": resources,
            "placement": { "x": 96 + offset, "y": 96 + offset, "width": 480, "height": 240, "z": widget_count },
            "config": {},
            "permissions": [],
            "hotspots": []
        });
        room["desks"][desk_index]["widgets"]
            .as_array_mut()
            .ok_or_else(|| "target Desk widgets are missing".to_string())?
            .push(widget.clone());
        std::fs::rename(&staging, &target)
            .map_err(|error| format!("commit Widget directory failed: {error}"))?;
        if let Err(error) = validate_room_asset_references(&room_root, &room) {
            let _ = std::fs::remove_dir_all(&target);
            return Err(error);
        }
        if let Err(error) = write_room_file(&room_root.join("room.json"), &serde_json::to_string_pretty(&room).unwrap()) {
            let _ = std::fs::remove_dir_all(&target);
            return Err(error);
        }
        Ok(widget)
    })();
    if result.is_err() && staging.exists() {
        let _ = std::fs::remove_dir_all(&staging);
    }
    result
}

#[tauri::command]
async fn import_widget(
    room_dir: String,
    source_dir: String,
    widget_id: String,
    widget_name: String,
    desk_index: usize,
    room_json: String,
) -> Result<serde_json::Value, String> {
    import_widget_dir(
        std::path::Path::new(&room_dir),
        std::path::Path::new(&source_dir),
        &widget_id,
        &widget_name,
        desk_index,
        &room_json,
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
async fn get_system_media() -> Result<grpc::SystemMediaDto, String> {
    grpc::get_system_media().await
}

#[tauri::command]
async fn control_system_media(action: String) -> Result<(), String> {
    grpc::control_system_media(&action).await
}

#[tauri::command]
async fn get_system_volume() -> Result<grpc::SystemVolumeDto, String> {
    grpc::get_system_volume().await
}

#[tauri::command]
async fn set_system_volume(
    level: Option<f64>,
    muted: Option<bool>,
) -> Result<grpc::SystemVolumeDto, String> {
    grpc::set_system_volume(level, muted).await
}

#[tauri::command]
async fn core_identity() -> Result<grpc::CoreIdentity, String> {
    grpc::core_identity().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(creator::CreatorImports::default())
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
        .register_uri_scheme_protocol("creator", |ctx, request| {
            match ctx.app_handle().try_state::<creator::CreatorImports>() {
                Some(imports) => creator::serve_creator_file(request.uri().path(), &imports),
                None => tauri::http::Response::builder().status(500).body(Vec::new()).unwrap(),
            }
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
            create_room,
            save_room_as,
            duplicate_room,
            rename_room,
            delete_room,
            export_room_zip,
            import_room_zip,
            apply_room,
            active_room,
            sync_active_desk_icons,
            stop_wallpapers,
            import_background,
            import_widget,
            creator::export_ai_context,
            creator::inspect_creator_pack,
            creator::confirm_creator_import,
            creator::discard_creator_import,
            get_dext_settings,
            patch_dext_settings,
            diagnostics_json,
            export_diagnostics,
            validate_room_library,
            about_info,
            open_about_document,
            open_dext_directory,
            set_wallpaper,
            core_stats,
            core_identity,
            get_system_media,
            control_system_media,
            get_system_volume,
            set_system_volume,
            get_permission_review,
            set_subject_permission
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        apply_settings_patch, create_room_dir, desktop_icon_preferences_message,
        direct_room_entry_in_library, direct_room_in_library, display_path, duplicate_room_dir,
        export_room_zip_file, import_room_content_file, import_room_zip_file, import_widget_dir,
        rename_room_dir, replace_desk_icons, room_layout_message, save_room_as_dir, settings_view,
        sync_room_to_package, update_desk_layout_source, validate_room_contract,
        validate_room_library_path, validate_room_v2, write_room_file, write_runtime_desk_layout,
        DextSettingsPatch, ROOM_ASSET_DIRS,
    };

    fn test_dir(label: &str) -> std::path::PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("dext-{label}-{}-{stamp}", std::process::id()))
    }

    fn write_valid_room(path: &std::path::Path, with_asset: bool) {
        std::fs::create_dir_all(path).unwrap();
        let background = if with_asset {
            std::fs::create_dir_all(path.join("background")).unwrap();
            std::fs::write(path.join("background/scene.png"), b"png fixture").unwrap();
            serde_json::json!({"name":"Scene","type":"image","src":"background/scene.png"})
        } else {
            serde_json::Value::Null
        };
        let room = serde_json::json!({
            "version": 2,
            "startDesk": 0,
            "switch": "slide",
            "switches": {},
            "desks": [{
                "name": "Desk 1",
                "background": background,
                "iconSize": "medium",
                "icons": [],
                "widgets": []
            }]
        });
        std::fs::write(
            path.join("room.json"),
            serde_json::to_vec_pretty(&room).unwrap(),
        )
        .unwrap();
    }

    fn valid_v2_room() -> serde_json::Value {
        serde_json::json!({
            "version": 2,
            "startDesk": 0,
            "idle": {"name":"Idle","type":"image","src":"idle/standby.png"},
            "switches": {},
            "desks": [{
                "name": "Desk 1",
                "background": null,
                "iconSize": "medium",
                "icons": [],
                "widgets": [{
                    "id": "system-meter",
                    "name": "System meter",
                    "src": "widgets/system-meter/index.html",
                    "resources": [
                        "widgets/system-meter/index.html",
                        "widgets/system-meter/style.css"
                    ],
                    "placement": {"x":72,"y":96,"width":420,"height":220,"z":2},
                    "config": {"accent":"#7cecff"},
                    "permissions": ["audio.spectrum","hardware.cpu.read"]
                }]
            }]
        })
    }

    fn write_valid_v2_room(path: &std::path::Path) {
        std::fs::create_dir_all(path.join("idle")).unwrap();
        std::fs::create_dir_all(path.join("widgets/system-meter")).unwrap();
        std::fs::write(path.join("idle/standby.png"), b"idle fixture").unwrap();
        std::fs::write(
            path.join("widgets/system-meter/index.html"),
            b"<!doctype html><title>system meter</title>",
        )
        .unwrap();
        std::fs::write(
            path.join("widgets/system-meter/style.css"),
            b":root{color-scheme:dark}",
        )
        .unwrap();
        std::fs::write(
            path.join("room.json"),
            serde_json::to_vec_pretty(&valid_v2_room()).unwrap(),
        )
        .unwrap();
    }

    #[test]
    fn accepts_only_native_v2_rooms() {
        let v1 = serde_json::json!({
            "version":1,"startDesk":0,"switches":{},
            "desks":[{"name":"Desk","background":null,"iconSize":"medium","icons":[]}]
        });
        assert!(validate_room_contract(&v1)
            .unwrap_err()
            .contains("unsupported room.version 1"));
        validate_room_contract(&valid_v2_room()).unwrap();
        let mut unknown = valid_v2_room();
        unknown["version"] = serde_json::Value::from(3);
        assert!(validate_room_contract(&unknown)
            .unwrap_err()
            .contains("unsupported room.version 3"));
    }

    #[test]
    fn imports_widget_directory_and_rolls_back_missing_entry() {
        let root = test_dir("widget-import");
        let room = root.join("room");
        let source = root.join("source");
        let broken = root.join("broken");
        write_valid_room(&room, false);
        std::fs::create_dir_all(source.join("assets")).unwrap();
        std::fs::write(source.join("index.html"), b"<!doctype html><title>Widget</title>").unwrap();
        std::fs::write(source.join("assets/style.css"), b"body{color:white}").unwrap();
        std::fs::create_dir_all(&broken).unwrap();
        std::fs::write(broken.join("main.js"), b"console.log('missing entry')").unwrap();
        let draft = std::fs::read_to_string(room.join("room.json")).unwrap();

        let widget = import_widget_dir(&room, &source, "status-panel", "Status panel", 0, &draft).unwrap();
        assert_eq!(widget["id"], "status-panel");
        assert!(room.join("widgets/status-panel/index.html").is_file());
        let saved: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(room.join("room.json")).unwrap()
        ).unwrap();
        assert_eq!(saved["desks"][0]["widgets"][0]["id"], "status-panel");

        let saved_text = serde_json::to_string_pretty(&saved).unwrap();
        let error = import_widget_dir(&room, &broken, "broken-widget", "Broken", 0, &saved_text).unwrap_err();
        assert!(error.contains("index.html"));
        assert!(!room.join("widgets/broken-widget").exists());
        assert!(!room.join("widgets").read_dir().unwrap().any(|entry| {
            entry.unwrap().file_name().to_string_lossy().starts_with(".dext-import-broken-widget")
        }));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn validates_v2_widget_identity_paths_permissions_placement_and_config() {
        let mut duplicate = valid_v2_room();
        let copy = duplicate["desks"][0]["widgets"][0].clone();
        duplicate["desks"][0]["widgets"]
            .as_array_mut()
            .unwrap()
            .push(copy);
        assert!(validate_room_v2(&duplicate)
            .unwrap_err()
            .contains("duplicate Widget id"));

        let mut wrong_path = valid_v2_room();
        wrong_path["desks"][0]["widgets"][0]["src"] =
            serde_json::Value::String("widgets/other/index.html".into());
        assert!(validate_room_v2(&wrong_path)
            .unwrap_err()
            .contains("widgets/system-meter/"));

        let mut unknown_permission = valid_v2_room();
        unknown_permission["desks"][0]["widgets"][0]["permissions"] =
            serde_json::json!(["shell.execute"]);
        assert!(validate_room_v2(&unknown_permission)
            .unwrap_err()
            .contains("unknown permission"));

        let mut outside = valid_v2_room();
        outside["desks"][0]["widgets"][0]["placement"]["x"] = serde_json::Value::from(1800);
        assert!(validate_room_v2(&outside)
            .unwrap_err()
            .contains("1920x1080"));

        let mut too_large = valid_v2_room();
        too_large["desks"][0]["widgets"][0]["config"] =
            serde_json::json!({"payload":"x".repeat(65_536)});
        assert!(validate_room_v2(&too_large)
            .unwrap_err()
            .contains("65536 bytes"));

        let mut too_deep = valid_v2_room();
        let mut nested = serde_json::Value::Object(serde_json::Map::new());
        for _ in 0..12 {
            nested = serde_json::json!({"next": nested});
        }
        too_deep["desks"][0]["widgets"][0]["config"] = nested;
        assert!(validate_room_v2(&too_deep)
            .unwrap_err()
            .contains("depth 12"));

        let mut hotspot = valid_v2_room();
        hotspot["desks"][0]["widgets"][0]["hotspots"] = serde_json::json!([{
            "id":"play", "label":"Play",
            "placement":{"x":0,"y":0,"width":80,"height":32,"z":1},
            "action":{"id":"system.media.play"}
        }]);
        assert!(validate_room_v2(&hotspot)
            .unwrap_err()
            .contains("requires action.invoke"));
        hotspot["desks"][0]["widgets"][0]["permissions"] =
            serde_json::json!(["action.invoke"]);
        assert!(validate_room_v2(&hotspot).is_ok());
        hotspot["desks"][0]["widgets"][0]["hotspots"][0]["action"] =
            serde_json::json!({"id":"system.volume.set","value":1.5});
        assert!(validate_room_v2(&hotspot)
            .unwrap_err()
            .contains("unsupported id or value"));
    }

    #[test]
    fn v2_write_save_as_zip_and_apply_preserve_declared_widget_resources() {
        let root = test_dir("room-v2-operations");
        let source = root.join("source");
        let library = root.join("library");
        let import_library = root.join("import-library");
        let package = root.join("package");
        std::fs::create_dir_all(&library).unwrap();
        std::fs::create_dir_all(&import_library).unwrap();
        std::fs::create_dir_all(&package).unwrap();
        write_valid_v2_room(&source);
        let mut room = valid_v2_room();
        room["desks"][0]["widgets"][0]["config"]["accent"] =
            serde_json::Value::String("#00ffaa".into());
        let room_json = serde_json::to_string_pretty(&room).unwrap();
        write_room_file(&source.join("room.json"), &room_json).unwrap();

        let copied = save_room_as_dir(&source, &library, "copied-v2", &room_json).unwrap();
        assert!(copied.join("widgets/system-meter/index.html").is_file());
        assert!(copied.join("widgets/system-meter/style.css").is_file());
        let copied_room: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(copied.join("room.json")).unwrap())
                .unwrap();
        assert_eq!(
            copied_room["desks"][0]["widgets"][0]["config"]["accent"],
            "#00ffaa"
        );

        let archive = root.join("v2.zip");
        export_room_zip_file(&source, &archive).unwrap();
        let imported =
            import_room_zip_file(&import_library, &archive, Some("imported-v2")).unwrap();
        assert!(imported.join("widgets/system-meter/index.html").is_file());
        let imported_room: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(imported.join("room.json")).unwrap())
                .unwrap();
        assert_eq!(imported_room["version"], 2);
        assert!(imported_room.get("__source").is_none());

        std::fs::write(package.join("room.json"), "active package").unwrap();
        std::fs::create_dir_all(package.join("widgets/old")).unwrap();
        std::fs::write(package.join("widgets/old/old.js"), "old").unwrap();
        sync_room_to_package(&source, &package, "C:/rooms/v2").unwrap();
        assert!(!package.join("widgets/old").exists());
        assert!(package.join("widgets/system-meter/index.html").is_file());
        let applied: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(package.join("room.json")).unwrap())
                .unwrap();
        assert_eq!(applied["version"], 2);
        assert_eq!(applied["__source"], "C:/rooms/v2");

        let asset = root.join("asset.png");
        std::fs::write(&asset, b"asset").unwrap();
        let imported_content =
            import_room_content_file(&source, &asset, "background", "image").unwrap();
        assert!(source
            .join(imported_content["src"].as_str().unwrap())
            .is_file());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v2_missing_or_undeclared_widget_resources_leave_active_package_unchanged() {
        let root = test_dir("room-v2-resource-boundary");
        let source = root.join("source");
        let package = root.join("package");
        write_valid_v2_room(&source);
        std::fs::create_dir_all(&package).unwrap();
        std::fs::write(package.join("room.json"), "active package").unwrap();
        std::fs::write(source.join("widgets/system-meter/extra.js"), "extra").unwrap();

        let error = sync_room_to_package(&source, &package, "C:/rooms/v2").unwrap_err();
        assert!(error.contains("undeclared Widget resource"));
        assert_eq!(
            std::fs::read_to_string(package.join("room.json")).unwrap(),
            "active package"
        );

        std::fs::remove_file(source.join("widgets/system-meter/extra.js")).unwrap();
        std::fs::remove_file(source.join("widgets/system-meter/style.css")).unwrap();
        let error = export_room_zip_file(&source, &root.join("invalid.zip")).unwrap_err();
        assert!(error.contains("references missing asset"));
        assert!(!root.join("invalid.zip").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn save_as_copies_v2_assets_and_keeps_source_unchanged() {
        let root = test_dir("room-save-as");
        let source = root.join("source");
        let library = root.join("library");
        for directory in ["background", "start", "switch", "idle"] {
            std::fs::create_dir_all(source.join(directory)).unwrap();
            std::fs::write(source.join(directory).join("asset.txt"), directory).unwrap();
        }
        write_valid_room(&source, false);
        let source_json = std::fs::read_to_string(source.join("room.json")).unwrap();
        let room_json = r#"{
            "version":2,
            "startDesk":0,
            "switch":"slide",
            "switches":{},
            "desks":[{
                "name":"Copied",
                "background":null,
                "iconSize":"medium",
                "icons":[],
                "widgets":[]
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
        for directory in ["background", "start", "switch", "idle"] {
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
        write_valid_room(&source, false);
        let source_json = std::fs::read_to_string(source.join("room.json")).unwrap();

        let error = save_room_as_dir(
            &source,
            &library,
            "broken-copy",
            r#"{"version":2,"unknown":true}"#,
        )
        .unwrap_err();

        assert!(error.contains("unknown field"));
        assert!(!library.join("broken-copy").exists());
        assert_eq!(
            std::fs::read_to_string(source.join("room.json")).unwrap(),
            source_json
        );

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn imports_all_v2_content_types_into_requested_slots() {
        let root = test_dir("room-content-import");
        let room = root.join("room");
        let source = root.join("source");
        write_valid_room(&room, false);
        let original_room_json = std::fs::read_to_string(room.join("room.json")).unwrap();
        std::fs::create_dir_all(&source).unwrap();
        std::fs::write(source.join("scene.png"), "image").unwrap();
        std::fs::write(source.join("scene.mp4"), "video").unwrap();
        std::fs::write(source.join("scene.html"), "<html></html>").unwrap();

        for (slot, content_type, filename) in [
            ("background", "image", "scene.png"),
            ("start", "html", "scene.html"),
            ("switch", "video", "scene.mp4"),
            ("idle", "image", "scene.png"),
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
        for sub in ["transition", "switch", "start", "idle", "end"] {
            std::fs::create_dir_all(pkg.join(sub)).unwrap();
            std::fs::write(pkg.join(sub).join("cockpit.txt"), "old").unwrap();
        }
        std::fs::write(
            src.join("room.json"),
            r#"{
                "version":2,
                "startDesk":0,
                "switch":"slide",
                "switches":{},
                "desks":[{
                    "name":"Clean",
                    "background":null,
                    "iconSize":"medium",
                    "icons":[],
                    "widgets":[]
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
        for sub in ["transition", "switch", "start", "idle", "end"] {
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
    fn write_room_strips_source_stamp_preserves_idle_and_rejects_unknown_fields() {
        let root = test_dir("room-write-v2");
        std::fs::create_dir_all(root.join("idle")).unwrap();
        std::fs::write(root.join("idle/scene.png"), "idle").unwrap();
        let path = root.join("room.json");
        write_room_file(
            &path,
            r#"{
                "version":2,
                "startDesk":0,
                "switches":{},
                "idle":{"name":"Idle","type":"image","src":"idle/scene.png"},
                "desks":[{
                    "name":"Desk 1",
                    "background":null,
                    "iconSize":"medium",
                    "icons":[],
                    "widgets":[]
                }],
                "__source":"C:/forged"
            }"#,
        )
        .unwrap();
        let saved: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert!(saved.get("__source").is_none());
        assert_eq!(saved["idle"]["src"], "idle/scene.png");

        let error = write_room_file(
            &path,
            r#"{
                "version":2,
                "startDesk":0,
                "switches":{},
                "desks":[{
                    "name":"Desk 1",
                    "background":null,
                    "iconSize":"medium",
                    "icons":[],
                    "widgets":[]
                }],
                "runtimeState":true
            }"#,
        )
        .unwrap_err();
        assert!(error.contains("unknown field"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn desk_layout_updates_only_requested_icons_and_rejects_invalid_input() {
        let mut room = valid_v2_room();
        room["desks"][0]["icons"] = serde_json::json!([{
            "label":"Old", "icon_png":"", "launch":{"target":"old.exe","args":"","workdir":""}, "x":0, "y":0
        }]);
        let before = room.clone();
        let icons = serde_json::json!([{
            "label":"New", "icon_png":"", "launch":{"target":"new.exe","args":"","workdir":""}, "x":4, "y":2
        }]);

        replace_desk_icons(&mut room, 0, icons).unwrap();

        assert_eq!(room["desks"][0]["icons"][0]["label"], "New");
        assert_eq!(room["desks"][0]["widgets"], before["desks"][0]["widgets"]);
        assert!(replace_desk_icons(&mut room, 1, serde_json::json!([]))
            .unwrap_err()
            .contains("target Desk"));
        assert!(replace_desk_icons(&mut room, 0, serde_json::json!({}))
            .unwrap_err()
            .contains("icons"));
    }

    #[test]
    fn desk_layout_source_write_and_message_keep_paths_trusted() {
        let root = test_dir("desk-layout-source");
        let library = root.join("library");
        let room = library.join("current");
        std::fs::create_dir_all(&library).unwrap();
        write_valid_v2_room(&room);
        let icons = serde_json::json!([{
            "label":"New", "icon_png":"", "launch":{"target":"new.exe","args":"","workdir":""}, "x":1, "y":2
        }]);

        let room_json = update_desk_layout_source(&room, 0, icons).unwrap();
        let saved: serde_json::Value = serde_json::from_str(&room_json).unwrap();
        assert_eq!(saved["desks"][0]["icons"][0]["launch"]["target"], "new.exe");
        assert!(saved.get("__source").is_none());

        let message: serde_json::Value = serde_json::from_str(
            &room_layout_message(&room_json, 0, true, Some("new.exe")).unwrap(),
        ).unwrap();
        assert_eq!(message["Type"], 26);
        assert_eq!(message["DeskIndex"], 0);
        assert_eq!(message["EnterEdit"], true);
        assert_eq!(message["HighlightTarget"], "new.exe");
        assert_eq!(message["RoomJson"], room_json);

        let mut runtime_room = saved;
        runtime_room["__source"] = serde_json::Value::String("C:/trusted/source".into());
        let runtime_json = serde_json::to_string(&runtime_room).unwrap();
        assert!(room_layout_message(&runtime_json, 0, false, None).is_ok());

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn desk_layout_runtime_failure_keeps_the_already_saved_source_layout() {
        let root = test_dir("desk-layout-runtime-failure");
        let room = root.join("room");
        write_valid_v2_room(&room);
        let icons = serde_json::json!([{
            "label":"Saved", "icon_png":"", "launch":{"target":"saved.exe","args":"","workdir":""}, "x":3, "y":1
        }]);

        let room_json = update_desk_layout_source(&room, 0, icons).unwrap();
        let runtime_file = root.join("not-a-runtime-directory");
        std::fs::write(&runtime_file, "file").unwrap();
        let error = write_runtime_desk_layout(&runtime_file, &room_json, &room).unwrap_err();

        assert!(error.contains("write active room.json"));
        let saved: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(room.join("room.json")).unwrap(),
        ).unwrap();
        assert_eq!(saved["desks"][0]["icons"][0]["label"], "Saved");

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
                    "icons": [],
                    "widgets": []
                })
            })
            .collect::<Vec<_>>();
        let room = serde_json::json!({
            "version": 2,
            "startDesk": 0,
            "switches": { "0>2": "fade" },
            "desks": desks
        });
        let error = validate_room_v2(&room).unwrap_err();
        assert!(error.contains("not adjacent"));
    }

    #[test]
    fn room_library_boundary_rejects_root_and_outside_paths() {
        let root = test_dir("room-boundary");
        let library = root.join("library");
        let inside = library.join("inside");
        let outside = root.join("outside");
        std::fs::create_dir_all(&library).unwrap();
        write_valid_room(&inside, false);
        write_valid_room(&outside, false);

        assert_eq!(
            direct_room_in_library(&library, &inside).unwrap(),
            inside.canonicalize().unwrap()
        );
        assert!(direct_room_in_library(&library, &library)
            .unwrap_err()
            .contains("direct child"));
        assert!(direct_room_in_library(&library, &outside)
            .unwrap_err()
            .contains("direct child"));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn deletion_target_accepts_unsupported_or_malformed_room_json() {
        let root = test_dir("delete-unsupported-room");
        let library = root.join("library");
        let unsupported = library.join("unsupported");
        let malformed = library.join("malformed");
        std::fs::create_dir_all(&unsupported).unwrap();
        std::fs::create_dir_all(&malformed).unwrap();
        std::fs::write(unsupported.join("room.json"), r#"{"version":1}"#).unwrap();
        std::fs::write(malformed.join("room.json"), "not json").unwrap();

        assert_eq!(
            direct_room_entry_in_library(&library, &unsupported).unwrap(),
            unsupported.canonicalize().unwrap()
        );
        assert_eq!(
            direct_room_entry_in_library(&library, &malformed).unwrap(),
            malformed.canonicalize().unwrap()
        );
        assert!(direct_room_in_library(&library, &unsupported)
            .unwrap_err()
            .contains("unsupported room.version 1"));
        assert!(direct_room_in_library(&library, &malformed)
            .unwrap_err()
            .contains("parse room.json failed"));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_room_builds_a_native_v2_skeleton() {
        let root = test_dir("create-room-v2");
        let room = create_room_dir(&root, "new-room").unwrap();
        let manifest: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(room.join("room.json")).unwrap())
                .unwrap();
        assert_eq!(manifest["version"], 2);
        assert_eq!(manifest["desks"][0]["widgets"], serde_json::json!([]));
        for directory in ROOM_ASSET_DIRS {
            assert!(room.join(directory).is_dir(), "missing {directory}");
        }
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn duplicate_and_rename_room_stay_inside_library_and_preserve_assets() {
        let root = test_dir("duplicate-rename-room");
        let library = root.join("library");
        let source = library.join("source");
        std::fs::create_dir_all(&library).unwrap();
        write_valid_room(&source, true);

        let duplicate = duplicate_room_dir(&library, &source, "copy").unwrap();
        assert_eq!(duplicate.parent(), Some(library.as_path()));
        assert!(duplicate.join("background/scene.png").is_file());
        assert_eq!(
            std::fs::read_to_string(duplicate.join("room.json")).unwrap(),
            std::fs::read_to_string(source.join("room.json")).unwrap()
        );

        let renamed = rename_room_dir(&library, &duplicate, "renamed").unwrap();
        assert!(!duplicate.exists());
        assert!(renamed.join("background/scene.png").is_file());
        assert!(rename_room_dir(&library, &renamed, "source").unwrap_err().contains("already exists"));
        assert!(duplicate_room_dir(&library, &source, "../escape").is_err());

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn room_zip_roundtrip_strips_source_and_keeps_assets() {
        let root = test_dir("room-zip-roundtrip");
        let source_library = root.join("source-library");
        let source = source_library.join("source-room");
        let target_library = root.join("target-library");
        let archive = root.join("source-room.zip");
        std::fs::create_dir_all(&source_library).unwrap();
        std::fs::create_dir_all(&target_library).unwrap();
        write_valid_room(&source, true);
        let mut stamped: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(source.join("room.json")).unwrap())
                .unwrap();
        stamped["__source"] = serde_json::Value::String("C:/must-not-leak".into());
        std::fs::write(
            source.join("room.json"),
            serde_json::to_vec_pretty(&stamped).unwrap(),
        )
        .unwrap();
        std::fs::write(source.join("room.js"), "legacy").unwrap();

        export_room_zip_file(&source, &archive).unwrap();
        let imported = import_room_zip_file(&target_library, &archive, Some("imported")).unwrap();
        let room: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(imported.join("room.json")).unwrap())
                .unwrap();
        assert!(room.get("__source").is_none());
        assert!(imported.join("background/scene.png").is_file());
        for directory in ROOM_ASSET_DIRS {
            assert!(
                imported.join(directory).is_dir(),
                "missing imported {directory} directory"
            );
        }
        assert!(!imported.join("room.js").exists());

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn room_library_validation_creates_and_write_checks_target() {
        let root = test_dir("room-library-validation");
        let library = root.join("new-library");

        let validated = validate_room_library_path(&library).unwrap();

        assert_eq!(validated, library.canonicalize().unwrap());
        assert!(library.is_dir());
        assert_eq!(std::fs::read_dir(&library).unwrap().count(), 0);

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn room_library_validation_rejects_file_target() {
        let root = test_dir("room-library-file");
        std::fs::create_dir_all(&root).unwrap();
        let file = root.join("not-a-directory");
        std::fs::write(&file, "fixture").unwrap();

        let error = validate_room_library_path(&file).unwrap_err();
        assert!(error.contains("create Room library failed") || error.contains("not a directory"));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn strips_windows_extended_prefix_from_display_paths() {
        #[cfg(windows)]
        {
            assert_eq!(
                display_path(std::path::Path::new(r"\\?\D:\rooms\demo")),
                r"D:\rooms\demo"
            );
            assert_eq!(
                display_path(std::path::Path::new(r"\\?\UNC\server\share\demo")),
                r"\\server\share\demo"
            );
        }
    }

    #[test]
    fn room_zip_rejects_path_traversal_without_residue() {
        use std::io::Write;
        let root = test_dir("room-zip-traversal");
        let library = root.join("library");
        let archive_path = root.join("bad.zip");
        std::fs::create_dir_all(&library).unwrap();
        let file = std::fs::File::create(&archive_path).unwrap();
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file("../escape.txt", zip::write::SimpleFileOptions::default())
            .unwrap();
        archive.write_all(b"escape").unwrap();
        archive.finish().unwrap();

        let error = import_room_zip_file(&library, &archive_path, None).unwrap_err();
        assert!(error.contains("unsafe zip entry"));
        assert!(!root.join("escape.txt").exists());
        assert_eq!(std::fs::read_dir(&library).unwrap().count(), 0);

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn room_zip_rejects_missing_assets_and_name_conflicts() {
        let root = test_dir("room-zip-validation");
        let source = root.join("source");
        let library = root.join("library");
        let archive = root.join("source.zip");
        std::fs::create_dir_all(&library).unwrap();
        write_valid_room(&source, true);
        export_room_zip_file(&source, &archive).unwrap();
        std::fs::remove_file(source.join("background/scene.png")).unwrap();
        assert!(export_room_zip_file(&source, &root.join("missing.zip"))
            .unwrap_err()
            .contains("missing asset"));

        write_valid_room(&library.join("taken"), false);
        let error = import_room_zip_file(&library, &archive, Some("taken")).unwrap_err();
        assert!(error.contains("already exists"));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn settings_patch_preserves_unedited_fields() {
        assert!(!DextSettingsPatch {
            startup: Some(true),
            ..Default::default()
        }
        .changes_desktop_icons());
        let mut settings = crate::proto::settings::SettingsDataModel {
            startup: false,
            app_version: "keep-me".into(),
            audio_volume_global: 35,
            app_fullscreen_pause: 1,
            ..Default::default()
        };
        apply_settings_patch(
            &mut settings,
            DextSettingsPatch {
                startup: Some(true),
                fullscreen_pause: Some(true),
                battery_pause: Some(true),
                power_save_pause: Some(true),
                audio_only_on_desktop: None,
                desktop_icon_feedback_style: Some("bare".into()),
                show_desktop_icon_labels: Some(false),
                desktop_icon_hit_target_size: Some("small".into()),
                desktop_icon_visual_size: Some("large".into()),
                desktop_icon_spacing: Some("compact".into()),
            },
        )
        .unwrap();
        assert!(settings.startup);
        assert_eq!(settings.app_fullscreen_pause, 0);
        assert_eq!(settings.battery_pause, 0);
        assert_eq!(settings.power_save_mode_pause, 0);
        assert_eq!(settings.audio_volume_global, 35);
        assert_eq!(settings.app_version, "keep-me");
        assert_eq!(settings.desktop_icon_feedback_style, 2);
        assert_eq!(settings.show_desktop_icon_labels, Some(false));
        assert_eq!(settings.desktop_icon_hit_target_size, 1);
        assert_eq!(settings.desktop_icon_visual_size, 2);
        assert_eq!(settings.desktop_icon_spacing, 1);
    }

    #[test]
    fn desktop_icon_settings_use_backward_compatible_defaults_and_message_contract() {
        let settings = crate::proto::settings::SettingsDataModel::default();
        let view = settings_view(&settings);
        assert_eq!(view.desktop_icon_feedback_style, "halo");
        assert!(view.show_desktop_icon_labels);
        assert_eq!(view.desktop_icon_hit_target_size, "standard");
        assert_eq!(view.desktop_icon_visual_size, "standard");
        assert_eq!(view.desktop_icon_spacing, "standard");

        let message: serde_json::Value =
            serde_json::from_str(&desktop_icon_preferences_message(&settings, 0).unwrap()).unwrap();
        assert_eq!(message["Type"], 27);
        assert_eq!(message["FeedbackStyle"], "halo");
        assert_eq!(message["ShowLabels"], true);
        assert_eq!(message["HitTargetSize"], "standard");
        assert_eq!(message["VisualSize"], "standard");
        assert_eq!(message["Spacing"], "standard");
        assert_eq!(message["Revision"], 0);
        assert!(super::next_desktop_icon_revision() < super::next_desktop_icon_revision());
    }
}
