//! Local author document operations, shared by Tauri and focused functional tests.
use crate::room_v3;
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
static AUTHOR_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn write(dir: &Path, document: &Value) -> Result<(), String> {
    let manifest = room_v3::validate_manifest(document)?;
    for resource in &manifest.resource_paths {
        room_v3::open_resource(dir, resource)?;
    }
    let bytes = serde_json::to_vec_pretty(document).map_err(|e| e.to_string())?;
    if bytes.len() > room_v3::MAX_MANIFEST_BYTES {
        return Err("manifest exceeds 1 MiB".into());
    }
    let mut temp =
        tempfile::NamedTempFile::new_in(dir).map_err(|e| format!("create save file: {e}"))?;
    temp.write_all(&bytes)
        .and_then(|_| temp.flush())
        .map_err(|e| format!("write Room: {e}"))?;
    temp.persist(dir.join("room.json"))
        .map_err(|e| format!("save Room: {}", e.error))?;
    Ok(())
}
pub fn create(dir: &Path, name: &str, json: &str) -> Result<PathBuf, String> {
    let _guard = AUTHOR_LOCK.lock().map_err(|_| "author lock unavailable")?;
    if name.is_empty()
        || name != name.trim()
        || name == "."
        || name == ".."
        || name.ends_with('.')
        || name
            .chars()
            .any(|c| c.is_control() || r#"\/:*?"<>|"#.contains(c))
    {
        return Err("invalid room name".into());
    }
    let document = room_v3::parse_document(json.as_bytes())?;
    room_v3::validate_manifest(&document)?;
    fs::create_dir_all(dir).map_err(|e| format!("create library: {e}"))?;
    let path = dir.join(name);
    fs::create_dir(&path).map_err(|e| format!("create Room {name}: {e}"))?;
    if let Err(error) = write(&path, &document) {
        let _ = fs::remove_dir(&path);
        return Err(error);
    }
    Ok(path)
}
pub fn save(dir: &Path, json: &str) -> Result<(), String> {
    let _guard = AUTHOR_LOCK.lock().map_err(|_| "author lock unavailable")?;
    let document = room_v3::parse_document(json.as_bytes())?;
    let current = room_v3::read_document(dir)?;
    if current["version"] != 3 || document["id"] != current["id"] {
        return Err("保存不能更换 Room 副本身份".into());
    }
    write(dir, &document)
}
fn collect(root: &Path, current: &Path, files: &mut Vec<String>) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(|e| format!("read HTML package: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let meta = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        let mut link = meta.file_type().is_symlink();
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            link |= meta.file_attributes() & 0x400 != 0;
        }
        if link {
            return Err("HTML package must contain local regular files".into());
        }
        if meta.is_dir() {
            collect(root, &path, files)?;
        } else if meta.is_file() {
            let relative = path
                .strip_prefix(root)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            room_v3::validate_resource_path(&relative)?;
            files.push(relative);
            if files.len() > room_v3::MAX_RESOURCES {
                return Err("HTML package exceeds resource limit".into());
            }
        }
    }
    Ok(())
}
pub fn import_content(dir: &Path, source: &Path, kind: &str) -> Result<Value, String> {
    let _guard = AUTHOR_LOCK.lock().map_err(|_| "author lock unavailable")?;
    room_v3::validate_manifest(&room_v3::read_document(dir)?)?;
    let extension = source
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let valid = match kind {
        "image" => ["png", "jpg", "jpeg", "webp", "svg", "avif"].contains(&extension.as_str()),
        "video" => ["mp4", "webm"].contains(&extension.as_str()),
        "gif" => extension == "gif",
        "html" => ["html", "htm"].contains(&extension.as_str()),
        _ => false,
    };
    if !valid {
        return Err("素材类型与文件扩展名不一致".into());
    }
    let root = source
        .parent()
        .ok_or("素材没有父目录")?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let filename = source
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or("素材文件名不可用")?;
    let mut files = if kind == "html" {
        let mut files = Vec::new();
        collect(&root, &root, &mut files)?;
        files
    } else {
        vec![filename.to_string()]
    };
    files.sort();
    let total = room_v3::read_document(dir)?["resources"]
        .as_array()
        .map_or(0, Vec::len)
        + files.len();
    if total > room_v3::MAX_RESOURCES {
        return Err("Room exceeds resource limit".into());
    }
    let mut readers = Vec::new();
    for file in &files {
        readers.push(room_v3::open_resource(&root, file)?);
    }
    let assets = dir.join("assets");
    fs::create_dir_all(&assets).map_err(|e| e.to_string())?;
    let staging = tempfile::Builder::new()
        .prefix("import-")
        .tempdir_in(&assets)
        .map_err(|e| e.to_string())?;
    for (file, reader) in files.iter().zip(readers.iter_mut()) {
        let target = staging.path().join(file);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut output = fs::File::create(&target).map_err(|e| e.to_string())?;
        std::io::copy(reader, &mut output).map_err(|e| format!("copy content: {e}"))?;
    }
    let prefix = "assets/".to_string() + &staging.path().file_name().unwrap().to_string_lossy();
    let resources: Vec<_> = files
        .into_iter()
        .map(|file| format!("{prefix}/{file}"))
        .collect();
    let content = json!({"type":kind,"src":format!("{prefix}/{filename}")});
    let _ = staging.keep();
    Ok(json!({"content":content,"resources":resources}))
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AppliedSource {
    format_version: u32,
    source_path: String,
    installation: room_v3::Installation,
}
pub fn record_source(
    host: &Path,
    source: &Path,
    installation: &room_v3::Installation,
) -> Result<(), String> {
    let canonical = source
        .canonicalize()
        .map_err(|e| format!("resolve applied source: {e}"))?;
    let mut source_path = canonical.to_string_lossy().into_owned();
    #[cfg(windows)]
    {
        if let Some(unc) = source_path.strip_prefix(r"\\?\UNC\") {
            source_path = format!(r"\\{}", unc);
        } else if let Some(local) = source_path.strip_prefix(r"\\?\") {
            source_path = local.to_string();
        }
    }
    let value = AppliedSource {
        format_version: 1,
        source_path,
        installation: installation.clone(),
    };
    let bytes = serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?;
    let mut temporary = tempfile::NamedTempFile::new_in(host).map_err(|e| e.to_string())?;
    temporary
        .write_all(&bytes)
        .and_then(|_| temporary.flush())
        .map_err(|e| e.to_string())?;
    temporary
        .persist(host.join("source.v3.json"))
        .map_err(|e| e.error.to_string())?;
    Ok(())
}
pub fn active_source(host: &Path) -> Result<Option<String>, String> {
    let record = match fs::read(host.join("source.v3.json")) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("read native source: {error}")),
    };
    let record: AppliedSource =
        serde_json::from_slice(&record).map_err(|e| format!("read native source: {e}"))?;
    if record.format_version != 1 {
        return Err("unsupported applied source record".into());
    }
    let installed = match fs::read(host.join("content/installation.json")) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("read active installation: {error}")),
    };
    let installed: room_v3::Installation =
        serde_json::from_slice(&installed).map_err(|e| e.to_string())?;
    if record.installation != installed {
        return Ok(None);
    }
    let source = Path::new(&record.source_path);
    if !source.is_absolute() || !source.join("room.json").is_file() {
        return Ok(None);
    }
    let document = room_v3::read_document(source)?;
    if document["id"].as_str() != Some(installed.room_id.as_str()) {
        return Ok(None);
    }
    Ok(Some(record.source_path))
}
pub fn rename(room: &Path, name: &str) -> Result<PathBuf, String> {
    let _guard = AUTHOR_LOCK.lock().map_err(|_| "author lock unavailable")?;
    if name.is_empty()
        || name != name.trim()
        || name == "."
        || name == ".."
        || name.ends_with('.')
        || name
            .chars()
            .any(|c| c.is_control() || r#"\/:*?"<>|"#.contains(c))
    {
        return Err("invalid room name".into());
    }
    let target = room.parent().ok_or("Room has no parent")?.join(name);
    if target.exists() {
        return Err("room already exists".into());
    }
    let original = room_v3::read_document(room)?;
    room_v3::validate_manifest(&original)?;
    let mut document = original.clone();
    document["name"] = json!(name);
    write(room, &document)?;
    if let Err(error) = fs::rename(room, &target) {
        let restored = write(room, &original);
        return Err(format!(
            "rename Room: {error}; original name restore: {restored:?}"
        ));
    }
    Ok(target)
}
