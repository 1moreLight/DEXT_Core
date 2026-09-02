use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde_json::{json, Value};

use super::{
    atomic_write, is_reparse_point, mime_of, validate_content, validate_room_asset_references,
    validate_room_contract, validate_widget, widget_id_is_valid, MAX_ARCHIVE_FILES,
    MAX_ARCHIVE_FILE_BYTES, MAX_ARCHIVE_TOTAL_BYTES, MAX_WIDGET_RESOURCES,
};

const CREATOR_ROOT: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../creator-kit");
const PROJECT_ROOT: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
const TEXT_EXTENSIONS: &[&str] = &["html", "htm", "css", "js", "mjs", "json", "svg"];
const RESOURCE_EXTENSIONS: &[&str] = &[
    "html", "htm", "css", "js", "mjs", "json", "png", "jpg", "jpeg", "webp", "gif", "svg", "woff",
    "woff2", "ttf", "otf", "mp4", "webm",
];

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreatorPackReport {
    token: String,
    preview_url: String,
    kind: String,
    id: String,
    name: String,
    entry: String,
    resources: Vec<String>,
    permissions: Vec<String>,
    hotspots: usize,
    total_bytes: u64,
    checks: Vec<String>,
}

struct CreatorStaging {
    directory: tempfile::TempDir,
    manifest: Value,
    report: CreatorPackReport,
}

#[derive(Default)]
pub(crate) struct CreatorImports(Mutex<HashMap<String, CreatorStaging>>);

fn reject_unknown_keys(
    object: &serde_json::Map<String, Value>,
    allowed: &[&str],
    label: &str,
) -> Result<(), String> {
    if let Some(key) = object.keys().find(|key| !allowed.contains(&key.as_str())) {
        return Err(format!("{label} contains unknown field {key:?}"));
    }
    Ok(())
}

fn safe_resource_path(value: &str, html_only: bool) -> bool {
    if value.is_empty()
        || value.len() > 512
        || value.starts_with('/')
        || value.contains('\\')
        || value.contains(':')
        || value.chars().any(char::is_control)
        || value.split('/').any(|part| {
            part.is_empty()
                || part == "."
                || part == ".."
                || part.ends_with('.')
                || part.ends_with(' ')
        })
    {
        return false;
    }
    let extension = Path::new(value)
        .extension()
        .and_then(|item| item.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if html_only {
        matches!(extension.as_str(), "html" | "htm")
    } else {
        RESOURCE_EXTENSIONS.contains(&extension.as_str())
    }
}

fn archive_entry_path(name: &str) -> Result<PathBuf, String> {
    if name.is_empty()
        || name.starts_with('/')
        || name.starts_with('\\')
        || name.contains('\\')
        || name.contains(':')
        || name.contains('\0')
    {
        return Err(format!("unsafe Creator Pack entry path: {name:?}"));
    }
    let path = Path::new(name);
    if path.components().any(|component| {
        matches!(
            component,
            std::path::Component::ParentDir
                | std::path::Component::RootDir
                | std::path::Component::Prefix(_)
        )
    }) {
        return Err(format!("unsafe Creator Pack entry path: {name:?}"));
    }
    let top = path
        .components()
        .next()
        .and_then(|item| item.as_os_str().to_str())
        .unwrap_or_default();
    if top != "creator.json" && top != "content" {
        return Err(format!("unsupported Creator Pack top-level entry: {top:?}"));
    }
    if top == "creator.json" && path.components().count() != 1 {
        return Err("creator.json must be at the archive root".into());
    }
    Ok(path.to_path_buf())
}

fn inspect_source_text(relative: &str, bytes: &[u8]) -> Result<(), String> {
    let extension = Path::new(relative)
        .extension()
        .and_then(|item| item.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !TEXT_EXTENSIONS.contains(&extension.as_str()) {
        return Ok(());
    }
    let text = std::str::from_utf8(bytes)
        .map_err(|_| format!("text resource must be UTF-8: {relative:?}"))?
        .to_ascii_lowercase();
    let forbidden = [
        ("http://", "remote URL"),
        ("https://", "remote URL"),
        ("src=\"//", "protocol-relative remote URL"),
        ("src='//", "protocol-relative remote URL"),
        ("href=\"//", "protocol-relative remote URL"),
        ("href='//", "protocol-relative remote URL"),
        ("url(//", "protocol-relative remote URL"),
        ("<iframe", "nested iframe"),
        ("<frame", "nested frame"),
        ("<object", "embedded object"),
        ("<embed", "embedded content"),
        ("<base", "base URL override"),
        ("<form", "form submission"),
        ("formaction", "form submission"),
        (" download", "download attribute"),
        ("window.open", "popup"),
        ("fetch(", "network API"),
        ("xmlhttprequest", "network API"),
        ("websocket", "network API"),
        ("eventsource", "network API"),
        ("sendbeacon", "network API"),
        ("location.href", "navigation API"),
        ("location.assign", "navigation API"),
        ("location.replace", "navigation API"),
    ];
    if let Some((_, label)) = forbidden.iter().find(|(needle, _)| text.contains(needle)) {
        return Err(format!(
            "Creator Pack resource {relative:?} contains forbidden {label}"
        ));
    }
    Ok(())
}

fn manifest_strings(
    object: &serde_json::Map<String, Value>,
    key: &str,
) -> Result<Vec<String>, String> {
    let values = object
        .get(key)
        .and_then(Value::as_array)
        .ok_or_else(|| format!("creator.{key} must be an array"))?;
    let mut unique = HashSet::new();
    let mut result = Vec::new();
    for (index, value) in values.iter().enumerate() {
        let item = value
            .as_str()
            .ok_or_else(|| format!("creator.{key}[{index}] must be a string"))?;
        if !unique.insert(item.to_ascii_lowercase()) {
            return Err(format!("creator.{key} contains duplicate {item:?}"));
        }
        result.push(item.to_string());
    }
    Ok(result)
}

fn validate_creator_manifest(
    manifest: &Value,
) -> Result<(String, String, String, String, Vec<String>, Vec<String>), String> {
    let object = manifest
        .as_object()
        .ok_or_else(|| "creator.json root must be an object".to_string())?;
    reject_unknown_keys(
        object,
        &[
            "version",
            "kind",
            "id",
            "name",
            "entry",
            "resources",
            "permissions",
            "hotspots",
            "placement",
        ],
        "creator.json",
    )?;
    if object.get("version").and_then(Value::as_u64) != Some(1) {
        return Err("creator.version must be 1".into());
    }
    let string = |key: &str| {
        object
            .get(key)
            .and_then(Value::as_str)
            .filter(|item| !item.trim().is_empty())
            .ok_or_else(|| format!("creator.{key} must be a non-empty string"))
    };
    let kind = string("kind")?.to_string();
    if !matches!(kind.as_str(), "scene" | "widget") {
        return Err("creator.kind must be scene or widget".into());
    }
    let id = string("id")?.to_string();
    if !widget_id_is_valid(&id) {
        return Err("creator.id must be a lowercase ASCII slug".into());
    }
    let name = string("name")?.trim().to_string();
    if name.chars().count() > 120 {
        return Err("creator.name is longer than 120 characters".into());
    }
    let entry = string("entry")?.to_string();
    if !safe_resource_path(&entry, true) {
        return Err("creator.entry must be a safe relative HTML path".into());
    }
    let resources = manifest_strings(object, "resources")?;
    if resources.is_empty() || resources.len() > MAX_WIDGET_RESOURCES {
        return Err(format!(
            "creator.resources must contain 1..={MAX_WIDGET_RESOURCES} paths"
        ));
    }
    if resources
        .iter()
        .any(|item| !safe_resource_path(item, false))
    {
        return Err("creator.resources contains an unsupported or unsafe path".into());
    }
    if !resources.iter().any(|item| item == &entry) {
        return Err("creator.entry must be listed in creator.resources".into());
    }
    let permissions = manifest_strings(object, "permissions")?;
    let hotspots = object
        .get("hotspots")
        .and_then(Value::as_array)
        .ok_or_else(|| "creator.hotspots must be an array".to_string())?
        .clone();

    if kind == "widget" {
        let prefix = format!("widgets/{id}/");
        let candidate = json!({
            "id": id,
            "name": name,
            "src": format!("{prefix}{entry}"),
            "resources": resources.iter().map(|item| format!("{prefix}{item}")).collect::<Vec<_>>(),
            "placement": object.get("placement").cloned().ok_or_else(|| "creator.placement is required for a Widget".to_string())?,
            "config": {},
            "permissions": permissions,
            "hotspots": hotspots,
        });
        validate_widget(&candidate, "creator")?;
    } else {
        if object.contains_key("placement") {
            return Err("creator.placement is only valid for a Widget".into());
        }
        let candidate = json!({
            "name": name,
            "type": "html",
            "src": format!("background/{id}/{entry}"),
            "permissions": permissions,
            "hotspots": hotspots,
        });
        validate_content(&candidate, "background", "creator")?;
    }
    Ok((kind, id, name, entry, resources, permissions))
}

fn inspect_creator_pack_file(archive_path: &Path) -> Result<CreatorStaging, String> {
    if !archive_path.is_file() || is_reparse_point(archive_path)? {
        return Err("selected Creator Pack is not a regular zip file".into());
    }
    let file = std::fs::File::open(archive_path)
        .map_err(|error| format!("open Creator Pack failed: {error}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|error| format!("open Creator Pack failed: {error}"))?;
    if archive.len() == 0 || archive.len() > MAX_ARCHIVE_FILES {
        return Err(format!(
            "Creator Pack must contain 1..={MAX_ARCHIVE_FILES} entries"
        ));
    }
    let staging = tempfile::Builder::new()
        .prefix("dext-creator-")
        .tempdir()
        .map_err(|error| format!("create Creator Pack staging failed: {error}"))?;
    let mut names = HashSet::new();
    let mut total_bytes = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("read Creator Pack entry failed: {error}"))?;
        let name = entry.name().to_string();
        let relative = archive_entry_path(&name)?;
        let normalized = name.trim_end_matches('/').to_ascii_lowercase();
        if normalized.is_empty() || !names.insert(normalized) {
            return Err(format!("duplicate Creator Pack entry: {name:?}"));
        }
        if entry
            .unix_mode()
            .is_some_and(|mode| mode & 0o170000 == 0o120000)
        {
            return Err(format!(
                "Creator Pack entry cannot be a symbolic link: {name:?}"
            ));
        }
        if entry.size() > MAX_ARCHIVE_FILE_BYTES {
            return Err(format!("Creator Pack entry is too large: {name:?}"));
        }
        total_bytes = total_bytes
            .checked_add(entry.size())
            .ok_or_else(|| "Creator Pack size overflow".to_string())?;
        if total_bytes > MAX_ARCHIVE_TOTAL_BYTES {
            return Err("Creator Pack expands beyond the 1 GiB limit".into());
        }
        if entry.size() > 10 * 1024 * 1024
            && (entry.compressed_size() == 0 || entry.size() / entry.compressed_size().max(1) > 500)
        {
            return Err(format!("suspicious compression ratio for {name:?}"));
        }
        let output = staging.path().join(relative);
        if entry.is_dir() {
            std::fs::create_dir_all(&output)
                .map_err(|error| format!("create Creator Pack directory failed: {error}"))?;
            continue;
        }
        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("create Creator Pack directory failed: {error}"))?;
        }
        let mut bytes = Vec::new();
        entry
            .by_ref()
            .take(MAX_ARCHIVE_FILE_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|error| format!("extract Creator Pack entry failed: {error}"))?;
        if bytes.len() as u64 > MAX_ARCHIVE_FILE_BYTES {
            return Err(format!("Creator Pack entry is too large: {name:?}"));
        }
        std::fs::write(&output, &bytes)
            .map_err(|error| format!("write Creator Pack entry failed: {error}"))?;
    }

    let manifest_path = staging.path().join("creator.json");
    let manifest: Value = serde_json::from_slice(
        &std::fs::read(&manifest_path)
            .map_err(|_| "Creator Pack is missing root creator.json".to_string())?,
    )
    .map_err(|error| format!("parse creator.json failed: {error}"))?;
    let (kind, id, name, entry, resources, permissions) = validate_creator_manifest(&manifest)?;
    let content_root = staging.path().join("content");
    if !content_root.is_dir() || is_reparse_point(&content_root)? {
        return Err("Creator Pack content/ must be a regular directory".into());
    }
    let declared: HashSet<String> = resources
        .iter()
        .map(|item| item.to_ascii_lowercase())
        .collect();
    let mut actual = HashSet::new();
    let mut pending = vec![content_root.clone()];
    while let Some(directory) = pending.pop() {
        for item in std::fs::read_dir(&directory)
            .map_err(|error| format!("read Creator Pack content failed: {error}"))?
        {
            let item =
                item.map_err(|error| format!("read Creator Pack content entry failed: {error}"))?;
            let path = item.path();
            if is_reparse_point(&path)? {
                return Err(format!(
                    "Creator Pack content cannot contain links: {}",
                    path.display()
                ));
            }
            if path.is_dir() {
                pending.push(path);
                continue;
            }
            if !path.is_file() {
                return Err(format!(
                    "Creator Pack content is not a regular file: {}",
                    path.display()
                ));
            }
            let relative = path
                .strip_prefix(&content_root)
                .map_err(|_| "Creator Pack content escaped its root".to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            let normalized = relative.to_ascii_lowercase();
            if !actual.insert(normalized.clone()) {
                return Err(format!("duplicate Creator Pack content path: {relative:?}"));
            }
            if !declared.contains(&normalized) {
                return Err(format!("undeclared Creator Pack resource: {relative:?}"));
            }
            inspect_source_text(
                &relative,
                &std::fs::read(&path)
                    .map_err(|error| format!("read Creator Pack resource failed: {error}"))?,
            )?;
        }
    }
    if let Some(missing) = declared.iter().find(|item| !actual.contains(*item)) {
        return Err(format!(
            "declared Creator Pack resource is missing: {missing:?}"
        ));
    }
    let token_seed = format!(
        "{}:{}:{}:{}",
        archive_path
            .canonicalize()
            .unwrap_or_else(|_| archive_path.to_path_buf())
            .display(),
        std::process::id(),
        total_bytes,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let token = super::room_fingerprint(token_seed.as_bytes());
    let report = CreatorPackReport {
        preview_url: format!("http://creator.localhost/{token}/{entry}"),
        token,
        kind,
        id,
        name,
        entry,
        resources,
        permissions,
        hotspots: manifest
            .get("hotspots")
            .and_then(Value::as_array)
            .map_or(0, Vec::len),
        total_bytes,
        checks: vec![
            "Schema 与字段白名单通过".into(),
            "路径、链接、重复项和解压体积检查通过".into(),
            "资源声明与实际文件完全一致".into(),
            "未发现远程脚本、iframe、下载、弹窗、表单或网络 API".into(),
            "预览保持离线且不授予系统能力".into(),
        ],
    };
    Ok(CreatorStaging {
        directory: staging,
        manifest,
        report,
    })
}

#[tauri::command]
pub(crate) async fn inspect_creator_pack(
    archive_path: String,
    imports: tauri::State<'_, CreatorImports>,
) -> Result<CreatorPackReport, String> {
    let staging = inspect_creator_pack_file(Path::new(&archive_path))?;
    let report = staging.report.clone();
    let mut values = imports
        .0
        .lock()
        .map_err(|_| "Creator Pack state is unavailable".to_string())?;
    if values.len() >= 8 {
        return Err("close or import an existing Creator Pack preview first".into());
    }
    values.insert(report.token.clone(), staging);
    Ok(report)
}

#[tauri::command]
pub(crate) async fn discard_creator_import(
    token: String,
    imports: tauri::State<'_, CreatorImports>,
) -> Result<(), String> {
    imports
        .0
        .lock()
        .map_err(|_| "Creator Pack state is unavailable".to_string())?
        .remove(&token)
        .ok_or_else(|| "Creator Pack preview token is unknown or expired".to_string())?;
    Ok(())
}

fn copy_content(source: &Path, current: &Path, target: &Path) -> Result<(), String> {
    for item in std::fs::read_dir(current)
        .map_err(|error| format!("read staged content failed: {error}"))?
    {
        let item = item.map_err(|error| format!("read staged content entry failed: {error}"))?;
        let path = item.path();
        if is_reparse_point(&path)? {
            return Err("staged content cannot contain links".into());
        }
        let relative = path
            .strip_prefix(source)
            .map_err(|_| "staged content escaped its root".to_string())?;
        let output = target.join(relative);
        if path.is_dir() {
            std::fs::create_dir_all(&output)
                .map_err(|error| format!("create imported content directory failed: {error}"))?;
            copy_content(source, &path, target)?;
        } else if path.is_file() {
            if let Some(parent) = output.parent() {
                std::fs::create_dir_all(parent).map_err(|error| {
                    format!("create imported content directory failed: {error}")
                })?;
            }
            std::fs::copy(&path, &output)
                .map_err(|error| format!("copy imported content failed: {error}"))?;
        } else {
            return Err("staged content contains a non-file entry".into());
        }
    }
    Ok(())
}

fn confirm_creator_import_file(
    staging: CreatorStaging,
    room_dir: &Path,
    room_json: &str,
    desk_index: usize,
    scene_target: Option<&str>,
) -> Result<Value, String> {
    let mut room: Value = serde_json::from_str(room_json)
        .map_err(|error| format!("parse Room draft failed: {error}"))?;
    validate_room_contract(&room)?;
    let room_root = room_dir
        .canonicalize()
        .map_err(|error| format!("resolve Room failed: {error}"))?;
    if !room_root.join("room.json").is_file() || is_reparse_point(&room_root)? {
        return Err("target must be a regular Room directory".into());
    }
    let (kind, id, name, entry, resources, permissions) =
        validate_creator_manifest(&staging.manifest)?;
    let hotspots = staging
        .manifest
        .get("hotspots")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let source = staging.directory.path().join("content");

    let (asset_directory, content) = if kind == "widget" {
        let desks = room
            .get("desks")
            .and_then(Value::as_array)
            .ok_or_else(|| "Room draft desks are missing".to_string())?;
        if desk_index >= desks.len() {
            return Err("target Desk is outside the Room".into());
        }
        if desks
            .iter()
            .flat_map(|desk| {
                desk.get("widgets")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
            })
            .any(|widget| widget.get("id").and_then(Value::as_str) == Some(&id))
        {
            return Err(format!("Widget id already exists: {id}"));
        }
        let prefix = format!("widgets/{id}/");
        let widget = json!({
            "id": id,
            "name": name,
            "src": format!("{prefix}{entry}"),
            "resources": resources.iter().map(|item| format!("{prefix}{item}")).collect::<Vec<_>>(),
            "placement": staging.manifest.get("placement").cloned().unwrap(),
            "config": {},
            "permissions": permissions,
            "hotspots": hotspots,
        });
        validate_widget(&widget, "creator")?;
        (room_root.join("widgets").join(&id), widget)
    } else {
        let target = scene_target.ok_or_else(|| "a Scene target is required".to_string())?;
        let directory = if target == "background" {
            "background"
        } else if target == "start" {
            "start"
        } else if target == "idle" {
            "idle"
        } else if target.starts_with("switch:") {
            "switch"
        } else {
            return Err("Scene target must be background, start, idle, or switch:<route>".into());
        };
        let content = json!({
            "name": name,
            "type": "html",
            "src": format!("{directory}/{id}/{entry}"),
            "permissions": permissions,
            "hotspots": hotspots,
        });
        validate_content(&content, directory, "creator")?;
        (room_root.join(directory).join(&id), content)
    };
    if asset_directory.exists() {
        return Err(format!("content directory already exists: {id}"));
    }
    let parent = asset_directory
        .parent()
        .ok_or_else(|| "content destination has no parent".to_string())?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("create content root failed: {error}"))?;
    let import_directory = parent.join(format!(".dext-creator-{id}-{}", std::process::id()));
    if import_directory.exists() {
        return Err("Creator import staging directory already exists".into());
    }
    std::fs::create_dir(&import_directory)
        .map_err(|error| format!("create Creator import staging failed: {error}"))?;
    let result = (|| {
        copy_content(&source, &source, &import_directory)?;
        std::fs::rename(&import_directory, &asset_directory)
            .map_err(|error| format!("commit Creator content failed: {error}"))?;
        if kind == "widget" {
            room["desks"][desk_index]["widgets"]
                .as_array_mut()
                .ok_or_else(|| "target Desk widgets are missing".to_string())?
                .push(content.clone());
        } else {
            let target = scene_target.unwrap();
            if target == "background" {
                room["desks"][desk_index]["background"] = content.clone();
            } else if target == "start" || target == "idle" {
                room[target] = content.clone();
            } else {
                let route = target.trim_start_matches("switch:");
                let allowed = super::allowed_switches(room["desks"].as_array().map_or(0, Vec::len));
                if !allowed.contains(route) {
                    return Err(format!(
                        "Scene switch route is not valid for this Room: {route}"
                    ));
                }
                room["switches"][route] = content.clone();
            }
        }
        validate_room_contract(&room)?;
        validate_room_asset_references(&room_root, &room)?;
        atomic_write(
            &room_root.join("room.json"),
            &serde_json::to_vec_pretty(&room)
                .map_err(|error| format!("serialize Room failed: {error}"))?,
        )?;
        Ok(content.clone())
    })();
    if result.is_err() {
        let _ = std::fs::remove_dir_all(&import_directory);
        let _ = std::fs::remove_dir_all(&asset_directory);
    }
    result
}

#[tauri::command]
pub(crate) async fn confirm_creator_import(
    token: String,
    room_dir: String,
    room_json: String,
    desk_index: usize,
    scene_target: Option<String>,
    imports: tauri::State<'_, CreatorImports>,
) -> Result<Value, String> {
    let staging = imports
        .0
        .lock()
        .map_err(|_| "Creator Pack state is unavailable".to_string())?
        .remove(&token)
        .ok_or_else(|| "Creator Pack preview token is unknown or expired".to_string())?;
    confirm_creator_import_file(
        staging,
        Path::new(&room_dir),
        &room_json,
        desk_index,
        scene_target.as_deref(),
    )
}

fn add_zip_file(
    writer: &mut zip::ZipWriter<&mut std::fs::File>,
    name: &str,
    bytes: &[u8],
) -> Result<(), String> {
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);
    writer
        .start_file(name, options)
        .map_err(|error| format!("write context entry failed: {error}"))?;
    writer
        .write_all(bytes)
        .map_err(|error| format!("write context entry failed: {error}"))
}

fn add_directory(
    writer: &mut zip::ZipWriter<&mut std::fs::File>,
    root: &Path,
    prefix: &str,
) -> Result<(), String> {
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        let mut entries = std::fs::read_dir(&directory)
            .map_err(|error| format!("read Creator Kit failed: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("read Creator Kit entry failed: {error}"))?;
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let path = entry.path();
            if is_reparse_point(&path)? {
                return Err(format!(
                    "Creator Kit cannot contain links: {}",
                    path.display()
                ));
            }
            if path.is_dir() {
                pending.push(path);
            } else if path.is_file() {
                let relative = path
                    .strip_prefix(root)
                    .map_err(|_| "Creator Kit path escaped root".to_string())?
                    .to_string_lossy()
                    .replace('\\', "/");
                add_zip_file(
                    writer,
                    &format!("{prefix}/{relative}"),
                    &std::fs::read(&path)
                        .map_err(|error| format!("read Creator Kit file failed: {error}"))?,
                )?;
            }
        }
    }
    Ok(())
}

fn sanitize_room_for_ai(room: &Value) -> Value {
    let mut sanitized = room.clone();
    if let Some(object) = sanitized.as_object_mut() {
        object.remove("__source");
    }
    let sanitize_icons = |value: &mut Value| {
        if let Some(icons) = value.as_array_mut() {
            for icon in icons {
                if let Some(object) = icon.as_object_mut() {
                    for key in ["icon_png", "launch", "action"] {
                        object.remove(key);
                    }
                }
            }
        }
    };
    if let Some(dock) = sanitized.get_mut("dock").and_then(Value::as_object_mut) {
        if let Some(icons) = dock.get_mut("icons") {
            sanitize_icons(icons);
        }
    }
    if let Some(desks) = sanitized.get_mut("desks").and_then(Value::as_array_mut) {
        for desk in desks {
            if let Some(icons) = desk.get_mut("icons") {
                sanitize_icons(icons);
            }
            if let Some(dock) = desk.get_mut("dock").and_then(Value::as_object_mut) {
                if let Some(icons) = dock.get_mut("icons") {
                    sanitize_icons(icons);
                }
            }
        }
    }
    sanitized
}

fn export_ai_context_file(destination: &Path, room_json: &str) -> Result<(), String> {
    let room: Value = serde_json::from_str(room_json)
        .map_err(|error| format!("parse Room draft failed: {error}"))?;
    validate_room_contract(&room)?;
    if room.get("__source").is_some() {
        return Err("AI context must not contain runtime __source".into());
    }
    let sanitized_room = sanitize_room_for_ai(&room);
    if destination.exists() {
        return Err(format!(
            "destination already exists: {}",
            destination.display()
        ));
    }
    let parent = destination
        .parent()
        .ok_or_else(|| "AI context destination has no parent".to_string())?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("create AI context destination failed: {error}"))?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)
        .map_err(|error| format!("create temporary AI context failed: {error}"))?;
    {
        let mut writer = zip::ZipWriter::new(temporary.as_file_mut());
        add_zip_file(
            &mut writer,
            "current-room.json",
            &serde_json::to_vec_pretty(&sanitized_room)
                .map_err(|error| format!("serialize Room context failed: {error}"))?,
        )?;
        add_zip_file(
            &mut writer,
            "AI-CONTEXT-README.md",
            "# Dext AI 创作上下文\n\n`current-room.json` 保留 Room 结构、布局和分享数据，但已剥离本机应用路径、启动参数、图标 base64、旧 action 和运行戳。AI 只应输出一个符合 `creator-kit/creator-pack.schema.json` 的离线 Creator Pack，不应改写或猜测本机应用绑定。\n".as_bytes(),
        )?;
        let project = Path::new(PROJECT_ROOT);
        for (source, target) in [
            ("room-v2.schema.json", "room-v2.schema.json"),
            ("dev_docs/ROOM_V2_AI_PROMPT.md", "ROOM_V2_AI_PROMPT.md"),
            ("dev_docs/ROOM_V2_SYSTEM_API.md", "ROOM_V2_SYSTEM_API.md"),
            ("dev_docs/WIDGETS_V2.md", "WIDGETS_V2.md"),
        ] {
            add_zip_file(
                &mut writer,
                target,
                &std::fs::read(project.join(source))
                    .map_err(|error| format!("read AI context source {source} failed: {error}"))?,
            )?;
        }
        add_directory(&mut writer, Path::new(CREATOR_ROOT), "creator-kit")?;
        writer
            .finish()
            .map_err(|error| format!("finish AI context failed: {error}"))?;
    }
    temporary
        .as_file_mut()
        .sync_all()
        .map_err(|error| format!("flush AI context failed: {error}"))?;
    temporary
        .persist(destination)
        .map(|_| ())
        .map_err(|error| format!("commit AI context failed: {}", error.error))
}

#[tauri::command]
pub(crate) async fn export_ai_context(
    destination: String,
    room_json: String,
) -> Result<String, String> {
    let destination = PathBuf::from(destination);
    export_ai_context_file(&destination, &room_json)?;
    Ok(destination.to_string_lossy().into_owned())
}

pub(crate) fn serve_creator_file(
    url_path: &str,
    imports: &CreatorImports,
) -> tauri::http::Response<Vec<u8>> {
    let decoded = percent_encoding::percent_decode_str(url_path.trim_start_matches('/'))
        .decode_utf8_lossy()
        .into_owned();
    let segments: Vec<&str> = decoded.split('/').filter(|item| !item.is_empty()).collect();
    if segments.len() < 2
        || segments
            .iter()
            .any(|item| *item == "." || *item == ".." || item.contains('\\'))
    {
        return tauri::http::Response::builder()
            .status(403)
            .body(Vec::new())
            .unwrap();
    }
    let values = match imports.0.lock() {
        Ok(values) => values,
        Err(_) => {
            return tauri::http::Response::builder()
                .status(500)
                .body(Vec::new())
                .unwrap()
        }
    };
    let Some(staging) = values.get(segments[0]) else {
        return tauri::http::Response::builder()
            .status(404)
            .body(Vec::new())
            .unwrap();
    };
    let mut path = staging.directory.path().join("content");
    for segment in &segments[1..] {
        path.push(segment);
    }
    let Ok(bytes) = std::fs::read(&path) else {
        return tauri::http::Response::builder()
            .status(404)
            .body(Vec::new())
            .unwrap();
    };
    tauri::http::Response::builder()
        .header("Content-Type", mime_of(&path))
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Referrer-Policy", "no-referrer")
        .header("Content-Security-Policy", "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'")
        .body(bytes).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn archive_directory(source: &Path, output: &Path) {
        let file = std::fs::File::create(output).unwrap();
        let mut writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();
        let mut pending = vec![source.to_path_buf()];
        while let Some(directory) = pending.pop() {
            for entry in std::fs::read_dir(&directory).unwrap() {
                let path = entry.unwrap().path();
                if path.is_dir() {
                    pending.push(path);
                    continue;
                }
                let name = path
                    .strip_prefix(source)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                writer.start_file(name, options).unwrap();
                writer.write_all(&std::fs::read(path).unwrap()).unwrap();
            }
        }
        writer.finish().unwrap();
    }

    #[test]
    fn valid_creator_fixture_is_inspected_without_modifying_a_room() {
        let temporary = tempfile::tempdir().unwrap();
        let archive = temporary.path().join("valid.dext-content.zip");
        archive_directory(
            &Path::new(CREATOR_ROOT).join("fixtures/valid/widget"),
            &archive,
        );
        let inspected = inspect_creator_pack_file(&archive).unwrap();
        assert_eq!(inspected.report.kind, "widget");
        assert_eq!(inspected.report.id, "fixture-clock");
        assert!(inspected
            .directory
            .path()
            .join("content/index.html")
            .is_file());
    }

    #[test]
    fn creator_fixture_with_unknown_permission_is_rejected() {
        let temporary = tempfile::tempdir().unwrap();
        let archive = temporary.path().join("invalid.zip");
        archive_directory(
            &Path::new(CREATOR_ROOT).join("fixtures/invalid/unknown-permission"),
            &archive,
        );
        let error = inspect_creator_pack_file(&archive).err().unwrap();
        assert!(error.contains("unknown permission"), "{error}");
    }

    #[test]
    fn creator_fixture_with_remote_script_is_rejected() {
        let temporary = tempfile::tempdir().unwrap();
        let archive = temporary.path().join("invalid.zip");
        archive_directory(
            &Path::new(CREATOR_ROOT).join("fixtures/invalid/remote-script"),
            &archive,
        );
        let error = inspect_creator_pack_file(&archive).err().unwrap();
        assert!(error.contains("remote URL"), "{error}");
    }

    #[test]
    fn unsafe_creator_archive_path_is_rejected() {
        assert!(archive_entry_path("../creator.json").is_err());
        assert!(archive_entry_path("other/file.js").is_err());
        assert!(archive_entry_path("content\\file.js").is_err());
    }

    #[test]
    fn inspected_widget_is_committed_only_after_confirmation() {
        let temporary = tempfile::tempdir().unwrap();
        let archive = temporary.path().join("valid.zip");
        archive_directory(
            &Path::new(CREATOR_ROOT).join("fixtures/valid/widget"),
            &archive,
        );
        let staging = inspect_creator_pack_file(&archive).unwrap();
        let room = temporary.path().join("room");
        std::fs::create_dir_all(&room).unwrap();
        for directory in ["background", "start", "switch", "idle", "widgets"] {
            std::fs::create_dir_all(room.join(directory)).unwrap();
        }
        let draft = json!({
            "version": 2,
            "startDesk": 0,
            "switches": {},
            "desks": [{
                "name": "Desk 1",
                "background": null,
                "iconSize": "medium",
                "icons": [],
                "widgets": []
            }]
        });
        std::fs::write(
            room.join("room.json"),
            serde_json::to_vec_pretty(&draft).unwrap(),
        )
        .unwrap();
        assert!(!room.join("widgets/fixture-clock").exists());
        let imported = confirm_creator_import_file(
            staging,
            &room,
            &serde_json::to_string_pretty(&draft).unwrap(),
            0,
            None,
        )
        .unwrap();
        assert_eq!(imported["id"], "fixture-clock");
        assert!(room.join("widgets/fixture-clock/index.html").is_file());
        let saved: Value =
            serde_json::from_slice(&std::fs::read(room.join("room.json")).unwrap()).unwrap();
        assert_eq!(saved["desks"][0]["widgets"][0]["id"], "fixture-clock");
    }

    #[test]
    fn ai_context_contains_contract_prompt_sdk_and_current_room() {
        let temporary = tempfile::tempdir().unwrap();
        let destination = temporary.path().join("context.zip");
        let room = json!({
            "version": 2,
            "startDesk": 0,
            "switches": {},
            "desks": [{
                "name": "Desk 1",
                "background": null,
                "iconSize": "medium",
                "icons": [{
                    "label": "Private app",
                    "x": 0,
                    "y": 0,
                    "icon_png": "data:image/png;base64,PRIVATE",
                    "launch": { "target": "C:/Users/private/app.exe", "args": "--secret", "workdir": "C:/Users/private" }
                }],
                "widgets": []
            }]
        });
        export_ai_context_file(&destination, &serde_json::to_string(&room).unwrap()).unwrap();
        let file = std::fs::File::open(destination).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        for name in [
            "current-room.json",
            "AI-CONTEXT-README.md",
            "room-v2.schema.json",
            "ROOM_V2_AI_PROMPT.md",
            "creator-kit/creator-pack.schema.json",
            "creator-kit/sdk/dext-sdk.js",
            "creator-kit/templates/scene/creator.json",
            "creator-kit/templates/widget/creator.json",
        ] {
            assert!(archive.by_name(name).is_ok(), "missing {name}");
        }
        let mut current = String::new();
        archive
            .by_name("current-room.json")
            .unwrap()
            .read_to_string(&mut current)
            .unwrap();
        assert!(!current.contains("PRIVATE"));
        assert!(!current.contains("C:/Users/private"));
        assert!(current.contains("Private app"));
    }
}
