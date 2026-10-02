//! Native, shareable Room v3 contract and content-verified installations.
//! Personal bindings, grants, placement overrides and component storage are
//! host-owned data; they never belong in this authored document.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

// Preserve decoded property uniqueness before converting raw author JSON to Value.
struct UniqueJson(Value);
impl<'de> Deserialize<'de> for UniqueJson {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct Visitor;
        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = UniqueJson;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("JSON with unique property names")
            }
            fn visit_bool<E: serde::de::Error>(self, v: bool) -> Result<UniqueJson, E> {
                Ok(UniqueJson(v.into()))
            }
            fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<UniqueJson, E> {
                Ok(UniqueJson(v.into()))
            }
            fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<UniqueJson, E> {
                Ok(UniqueJson(v.into()))
            }
            fn visit_f64<E: serde::de::Error>(self, v: f64) -> Result<UniqueJson, E> {
                serde_json::Number::from_f64(v)
                    .map(|n| UniqueJson(Value::Number(n)))
                    .ok_or_else(|| E::custom("invalid number"))
            }
            fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<UniqueJson, E> {
                Ok(UniqueJson(v.into()))
            }
            fn visit_string<E: serde::de::Error>(self, v: String) -> Result<UniqueJson, E> {
                Ok(UniqueJson(v.into()))
            }
            fn visit_unit<E: serde::de::Error>(self) -> Result<UniqueJson, E> {
                Ok(UniqueJson(Value::Null))
            }
            fn visit_seq<A: serde::de::SeqAccess<'de>>(
                self,
                mut seq: A,
            ) -> Result<UniqueJson, A::Error> {
                let mut values = Vec::new();
                while let Some(v) = seq.next_element::<UniqueJson>()? {
                    values.push(v.0);
                }
                Ok(UniqueJson(Value::Array(values)))
            }
            fn visit_map<A: serde::de::MapAccess<'de>>(
                self,
                mut map: A,
            ) -> Result<UniqueJson, A::Error> {
                let mut values = serde_json::Map::new();
                while let Some(key) = map.next_key::<String>()? {
                    if values.contains_key(&key) {
                        return Err(serde::de::Error::custom(format!(
                            "duplicate JSON field {key:?}"
                        )));
                    }
                    values.insert(key, map.next_value::<UniqueJson>()?.0);
                }
                Ok(UniqueJson(Value::Object(values)))
            }
        }
        deserializer.deserialize_any(Visitor)
    }
}

pub fn parse_document(bytes: &[u8]) -> Result<Value, String> {
    require(bytes.len() <= MAX_MANIFEST_BYTES, "manifest exceeds 1 MiB")?;
    serde_json::from_slice::<UniqueJson>(bytes)
        .map(|v| v.0)
        .map_err(|e| format!("parse Room: {e}"))
}

pub const MAX_MANIFEST_BYTES: usize = 1024 * 1024;
pub const MAX_RESOURCES: usize = 4096;
const MAX_RESOURCE_BYTES: u64 = 1024 * 1024 * 1024;
const MAX_INSTALL_BYTES: u64 = 2 * MAX_RESOURCE_BYTES;
const MAX_SNAPSHOT_BYTES: usize = 2 * 1024 * 1024;
static INSTALL_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
static TEMP_SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Installation {
    pub format_version: u32,
    pub room_id: String,
    pub manifest_sha256: String,
    pub resources: Vec<ResourceDigest>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResourceDigest {
    pub path: String,
    pub sha256: String,
    pub size: u64,
}

fn io_error(context: &str, error: std::io::Error) -> String {
    format!("{context}: {error}")
}

fn reject_link(path: &Path) -> Result<std::fs::Metadata, String> {
    let meta = fs::symlink_metadata(path).map_err(|e| io_error("inspect installation path", e))?;
    let mut link = meta.file_type().is_symlink();
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        link |= meta.file_attributes() & 0x400 != 0;
    }
    require(
        !link,
        format!(
            "installation path cannot be a link/reparse point: {}",
            path.display()
        ),
    )?;
    Ok(meta)
}

#[cfg(windows)]
fn handle_path(file: &File) -> Result<PathBuf, String> {
    use std::os::windows::{ffi::OsStringExt, io::AsRawHandle};
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GetFinalPathNameByHandleW(
            handle: *mut std::ffi::c_void,
            path: *mut u16,
            size: u32,
            flags: u32,
        ) -> u32;
    }
    let mut path = vec![0u16; 32768];
    let length = unsafe {
        GetFinalPathNameByHandleW(
            file.as_raw_handle(),
            path.as_mut_ptr(),
            path.len() as u32,
            0,
        )
    } as usize;
    require(
        length > 0 && length < path.len(),
        "cannot resolve opened path identity",
    )?;
    Ok(PathBuf::from(std::ffi::OsString::from_wide(
        &path[..length],
    )))
}

fn open_local(path: &Path) -> Result<File, String> {
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        // Do not follow a final reparse point replaced after path inspection.
        options.custom_flags(0x00200000);
        options.share_mode(1);
    }
    let file = options
        .open(path)
        .map_err(|e| io_error("open declared resource", e))?;
    let meta = file
        .metadata()
        .map_err(|e| io_error("inspect opened resource", e))?;
    require(meta.is_file(), "opened resource is not a regular file")?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        require(
            meta.file_attributes() & 0x400 == 0,
            "opened resource is a reparse point",
        )?;
    }
    Ok(file)
}

pub struct ResourceReader {
    file: File,
    _directories: Vec<File>,
}
impl Read for ResourceReader {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        self.file.read(buffer)
    }
}

fn lock_directory(path: &Path) -> Result<File, String> {
    #[cfg(windows)]
    {
        use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
        let file = fs::OpenOptions::new()
            .read(true)
            .share_mode(3)
            .custom_flags(0x02200000)
            .open(path)
            .map_err(|e| io_error("lock local directory", e))?;
        let meta = file
            .metadata()
            .map_err(|e| io_error("inspect directory handle", e))?;
        require(
            meta.is_dir() && meta.file_attributes() & 0x400 == 0,
            "directory handle is a reparse point or not a directory",
        )?;
        require(
            handle_path(&file)?.to_string_lossy().to_lowercase()
                == path.to_string_lossy().to_lowercase(),
            "directory namespace redirected before open",
        )?;
        Ok(file)
    }
    #[cfg(not(windows))]
    {
        File::open(path).map_err(|e| io_error("open directory", e))
    }
}

fn open_checked(root: &Path, relative: &str) -> Result<ResourceReader, String> {
    let mut directories = vec![lock_directory(root)?];
    let parts: Vec<_> = relative.split('/').collect();
    let mut path = root.to_path_buf();
    for part in &parts[..parts.len() - 1] {
        path.push(part);
        directories.push(lock_directory(&path)?);
    }
    path.push(parts.last().ok_or("empty resource path")?);
    let file = open_local(&path)?;
    #[cfg(windows)]
    require(
        handle_path(&file)?.starts_with(root),
        "opened resource handle escaped root",
    )?;
    // The directory handles retain the inspected hierarchy until the reader closes.
    require(
        path.canonicalize()
            .map_err(|e| io_error("resolve opened resource", e))?
            .starts_with(root),
        "resource escaped root",
    )?;
    Ok(ResourceReader {
        file,
        _directories: directories,
    })
}

pub fn open_resource(root: &Path, relative: &str) -> Result<ResourceReader, String> {
    validate_resource_path(relative)?;
    open_checked(&root_directory(root)?, relative)
}

fn bounded_bytes(root: &Path, name: &str, limit: usize) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    open_checked(root, name)?
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| io_error("read installation document", e))?;
    require(
        !bytes.is_empty() && bytes.len() <= limit,
        format!("{name} exceeds size limit or is empty"),
    )?;
    Ok(bytes)
}

fn hash_resource(root: &Path, path: &str) -> Result<ResourceDigest, String> {
    let mut file = open_checked(root, path)?;
    let mut hash = Sha256::new();
    let mut size = 0u64;
    let mut buffer = [0u8; 65536];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|e| io_error("hash resource", e))?;
        if count == 0 {
            break;
        }
        size += count as u64;
        require(size <= MAX_RESOURCE_BYTES, "resource exceeds 1 GiB")?;
        hash.update(&buffer[..count]);
    }
    Ok(ResourceDigest {
        path: path.into(),
        sha256: format!("{:x}", hash.finalize()),
        size,
    })
}

fn inventory(root: &Path) -> Result<HashSet<String>, String> {
    fn walk(
        root: &Path,
        path: &Path,
        found: &mut HashSet<String>,
        entries: &mut usize,
        depth: usize,
    ) -> Result<(), String> {
        require(depth <= 32, "resource directory nesting exceeds 32")?;
        let _guard = lock_directory(path)?;
        for item in fs::read_dir(path).map_err(|e| io_error("read resource directory", e))? {
            let path = item.map_err(|e| io_error("read resource entry", e))?.path();
            *entries += 1;
            require(
                *entries <= MAX_RESOURCES * 4,
                "installation has too many entries",
            )?;
            let meta = reject_link(&path)?;
            if meta.is_dir() {
                walk(root, &path, found, entries, depth + 1)?;
            } else {
                require(meta.is_file(), "non-file resource")?;
                let relative = path
                    .strip_prefix(root)
                    .map_err(|_| "resource escaped root".to_string())?
                    .to_str()
                    .ok_or("resource name is not UTF-8")?
                    .replace('\\', "/");
                require(found.insert(relative), "duplicate installed resource")?;
            }
        }
        Ok(())
    }
    let mut found = HashSet::new();
    walk(root, root, &mut found, &mut 0, 0)?;
    Ok(found)
}

fn root_directory(directory: &Path) -> Result<PathBuf, String> {
    require(
        reject_link(directory)?.is_dir(),
        "installation root must be a directory",
    )?;
    directory
        .canonicalize()
        .map_err(|e| io_error("resolve installation root", e))
}

fn make_snapshot(directory: &Path, installed: bool) -> Result<Installation, String> {
    let root = root_directory(directory)?;
    let bytes = bounded_bytes(&root, "room.json", MAX_MANIFEST_BYTES)?;
    let value = parse_document(&bytes)?;
    let manifest = validate_manifest(&value)?;
    let mut expected: HashSet<String> = manifest.resource_paths.iter().cloned().collect();
    expected.insert("room.json".into());
    if installed {
        expected.insert("installation.json".into());
    }
    require(
        inventory(&root)? == expected,
        "resource inventory differs from declared Room resources",
    )?;
    let mut paths = manifest.resource_paths;
    paths.sort();
    let mut resources = Vec::new();
    let mut total = 0u64;
    for path in paths {
        let digest = hash_resource(&root, &path)?;
        total += digest.size;
        require(total <= MAX_INSTALL_BYTES, "Room resources exceed 2 GiB")?;
        resources.push(digest);
    }
    Ok(Installation {
        format_version: 1,
        room_id: manifest.room_id,
        manifest_sha256: format!("{:x}", Sha256::digest(&bytes)),
        resources,
    })
}

pub fn verify_installation(directory: &Path) -> Result<Installation, String> {
    let root = root_directory(directory)?;
    let expected: Installation = serde_json::from_slice(&bounded_bytes(
        &root,
        "installation.json",
        MAX_SNAPSHOT_BYTES,
    )?)
    .map_err(|e| format!("parse installed snapshot: {e}"))?;
    require(
        expected.format_version == 1,
        "unsupported installation format",
    )?;
    let actual = make_snapshot(&root, true)?;
    require(
        expected == actual,
        "installed Room manifest or resource content changed",
    )?;
    Ok(actual)
}

struct Staging(PathBuf);
impl Drop for Staging {
    fn drop(&mut self) {
        if self.0.exists() && reject_link(&self.0).is_ok() {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}

pub fn install(source: &Path, destination: &Path) -> Result<Installation, String> {
    install_inner(source, destination, || {})
}

#[cfg(test)]
pub fn install_with_publish_observer(
    source: &Path,
    destination: &Path,
    observer: impl FnOnce(),
) -> Result<Installation, String> {
    install_inner(source, destination, observer)
}

fn install_inner(
    source: &Path,
    destination: &Path,
    before_publish: impl FnOnce(),
) -> Result<Installation, String> {
    let _lock = INSTALL_LOCK
        .lock()
        .map_err(|_| "installation lock poisoned".to_string())?;
    let source = root_directory(source)?;
    let _source_guard = lock_directory(&source)?;
    let parent = root_directory(
        destination
            .parent()
            .ok_or("installation requires a parent directory")?,
    )?;
    let _parent_guard = lock_directory(&parent)?;
    let name = destination
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("invalid installation directory name")?;
    require(
        !name.is_empty()
            && !matches!(name, "." | "..")
            && !name
                .chars()
                .any(|c| c.is_control() || "\\/:*?\"<>|".contains(c)),
        "invalid installation directory name",
    )?;
    let destination = parent.join(name);
    require(
        !destination.starts_with(&source) && !source.starts_with(&destination),
        "source and installed directories must not overlap",
    )?;
    let previous = if destination.exists() {
        Some(
            verify_installation(&destination)
                .map_err(|e| format!("destination is not a verified owned installation: {e}"))?,
        )
    } else {
        None
    };
    let snapshot = make_snapshot(&source, false)?;
    let suffix = format!(
        "{}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos(),
        TEMP_SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    );
    let stage = Staging(parent.join(format!(".dext-install-{suffix}")));
    fs::create_dir(&stage.0).map_err(|e| io_error("create installation staging", e))?;
    let root = root_directory(&stage.0)?;
    let stage_guard = lock_directory(&root)?;
    for relative in
        std::iter::once("room.json").chain(snapshot.resources.iter().map(|r| r.path.as_str()))
    {
        let target = root.join(relative);
        fs::create_dir_all(target.parent().unwrap())
            .map_err(|e| io_error("create resource directory", e))?;
        let mut input = open_checked(&source, relative)?.take(MAX_RESOURCE_BYTES + 1);
        let mut output =
            File::create(&target).map_err(|e| io_error("create installed resource", e))?;
        let size =
            std::io::copy(&mut input, &mut output).map_err(|e| io_error("copy resource", e))?;
        require(
            size <= MAX_RESOURCE_BYTES,
            "resource grew beyond limit during copy",
        )?;
        output.flush().map_err(|e| io_error("flush resource", e))?;
        output
            .sync_all()
            .map_err(|e| io_error("sync resource", e))?;
    }
    require(
        make_snapshot(&root, false)? == snapshot,
        "source content changed during installation",
    )?;
    let record = serde_json::to_vec_pretty(&snapshot).map_err(|e| e.to_string())?;
    require(
        record.len() <= MAX_SNAPSHOT_BYTES,
        "installation snapshot exceeds 2 MiB",
    )?;
    let mut file = File::create(root.join("installation.json"))
        .map_err(|e| io_error("create installed snapshot", e))?;
    file.write_all(&record)
        .map_err(|e| io_error("write installed snapshot", e))?;
    file.sync_all()
        .map_err(|e| io_error("sync installed snapshot", e))?;
    drop(file);
    verify_installation(&root)?;
    let backup = parent.join(format!(".dext-previous-{suffix}"));
    before_publish();
    let replacing = destination.exists();
    // Ownership can change during a long copy; reject altered data before publication.
    require(
        replacing == previous.is_some(),
        "destination ownership changed during staging",
    )?;
    if replacing {
        require(
            Some(verify_installation(&destination)?) == previous,
            "destination content changed during staging",
        )?;
    }
    drop(stage_guard);
    if replacing {
        fs::rename(&destination, &backup)
            .map_err(|e| io_error("retain previous installation", e))?;
    }
    if let Err(error) = fs::rename(&root, &destination) {
        if replacing {
            fs::rename(&backup,&destination).map_err(|restore|format!("installation swap failed ({error}); rollback failed ({restore}); previous retained at {}",backup.display()))?;
        }
        return Err(io_error("publish installed Room", error));
    }
    if replacing {
        let _ = fs::remove_dir_all(&backup);
    }
    Ok(snapshot)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RoomDocument {
    pub version: u32,
    pub api_version: u32,
    pub id: String,
    pub name: String,
    pub start_desk: String,
    pub desks: Vec<Desk>,
    pub resources: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub room_scene: Option<Scene>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start: Option<Content>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub idle: Option<Content>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transition: Option<Transition>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub components: Vec<Component>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub buttons: Vec<Button>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dock_component_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Desk {
    pub id: String,
    pub name: String,
    pub icons: Vec<Icon>,
    pub components: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background: Option<Content>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub component_overrides: BTreeMap<String, Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Content {
    #[serde(rename = "type")]
    pub kind: String,
    pub src: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Scene {
    pub entry: String,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub config: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Transition {
    #[serde(rename = "type")]
    pub kind: String,
    pub duration_ms: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Component {
    pub id: String,
    pub role: String,
    pub entry: String,
    pub placement: Placement,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub button_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub config: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Placement {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Button {
    pub id: String,
    pub name: String,
    pub scope: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<Action>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Action {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub desk_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Icon {
    pub id: String,
    pub button_id: String,
    pub x: u32,
    pub y: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub glyph: Option<String>,
}

#[derive(Clone, Debug)]
pub struct Manifest {
    pub room_id: String,
    pub desk_ids: Vec<String>,
    pub start_desk_id: String,
    pub resource_paths: Vec<String>,
    pub document: RoomDocument,
}

fn require(condition: bool, message: impl Into<String>) -> Result<(), String> {
    if condition {
        Ok(())
    } else {
        Err(message.into())
    }
}

fn identity(id: &str) -> Result<(), String> {
    require(
        !id.is_empty()
            && id.len() <= 80
            && id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_' | b'.')),
        format!("invalid stable id {id:?}"),
    )
}

fn room_uuid(id: &str) -> bool {
    id.len() == 36
        && id.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
        && id.bytes().any(|c| c != b'0' && c != b'-')
}

pub fn validate_resource_path(path: &str) -> Result<(), String> {
    require(
        !path.is_empty() && path.len() <= 240,
        "resource path must contain 1..240 bytes",
    )?;
    for segment in path.split('/') {
        require(
            !segment.is_empty()
                && !matches!(segment, "." | "..")
                && !segment.ends_with(['.', ' '])
                && segment.len() <= 255
                && !segment
                    .chars()
                    .any(|c| c.is_control() || "\\:*?\"<>|%#".contains(c)),
            format!("unsafe resource path {path:?}"),
        )?;
        let stem = segment.split('.').next().unwrap().to_ascii_uppercase();
        require(
            ![
                "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
                "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8",
                "LPT9",
            ]
            .contains(&stem.as_str()),
            format!("reserved Windows resource path {path:?}"),
        )?;
    }
    let extension = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    require(
        [
            "html", "css", "js", "mjs", "json", "png", "jpg", "jpeg", "webp", "svg", "gif", "mp4",
            "webm", "ogg", "mp3", "wav", "woff", "woff2", "ttf", "otf", "avif",
        ]
        .contains(&extension.as_str()),
        format!("unsupported resource type {path:?}"),
    )?;
    require(
        !["room.json", "installation.json"].contains(&path.to_ascii_lowercase().as_str()),
        "host manifest names cannot be declared as resources",
    )
}

fn capabilities(values: &[String]) -> Result<(), String> {
    let allowed = [
        "desk.read",
        "desk.navigate",
        "time.read",
        "hardware.read",
        "media.read",
        "media.control",
        "audio.read",
        "audio.control",
        "storage.read",
        "storage.write",
        "binding.launch",
        "dext.exit",
    ];
    let mut seen = HashSet::new();
    for value in values {
        require(
            allowed.contains(&value.as_str()) && seen.insert(value),
            format!("unknown or duplicate capability {value:?}"),
        )?;
    }
    Ok(())
}

fn public_config(value: &Value, depth: usize) -> Result<(), String> {
    if depth == 0 {
        require(value.is_object(), "public config must be an object")?;
    }
    require(depth <= 12, "config nesting exceeds 12")?;
    match value {
        Value::Object(values) => {
            for (key, value) in values {
                require(
                    ![
                        "target", "args", "workdir", "password", "token", "secret", "bindings",
                        "grants", "__source",
                    ]
                    .contains(&key.to_ascii_lowercase().as_str()),
                    format!("private data field {key:?} cannot be shared"),
                )?;
                public_config(value, depth + 1)?;
            }
        }
        Value::Array(values) => {
            require(values.len() <= 256, "config array exceeds 256")?;
            for value in values {
                public_config(value, depth + 1)?;
            }
        }
        Value::String(text) => {
            require(text.len() <= 8192, "config text exceeds 8192 bytes")?;
            let private_path = text.starts_with("\\\\")
                || text
                    .get(..5)
                    .is_some_and(|prefix| prefix.eq_ignore_ascii_case("file:"))
                || (text.len() > 2
                    && text.as_bytes()[1] == b':'
                    && text.as_bytes()[0].is_ascii_alphabetic());
            require(!private_path, "personal absolute paths cannot be shared")?;
        }
        _ => {}
    }
    Ok(())
}

pub fn validate_manifest(value: &Value) -> Result<Manifest, String> {
    fn shape(value: &Value) -> Result<(), String> {
        match value {
            Value::Object(fields) => {
                for (key, value) in fields {
                    // Public config has its own recursive nullable value grammar.
                    if key == "config" {
                        require(value.is_object(), "public config must be an object")?;
                    } else if key == "componentOverrides" {
                        let values = value
                            .as_object()
                            .ok_or("componentOverrides must be an object")?;
                        for config in values.values() {
                            public_config(config, 0)?;
                        }
                    } else {
                        require(!value.is_null(), format!("{key} cannot be null"))?;
                        shape(value)?;
                    }
                }
            }
            Value::Array(values) => {
                for value in values {
                    shape(value)?;
                }
            }
            _ => {}
        }
        Ok(())
    }
    shape(value)?;
    require(
        serde_json::to_vec(value).map_err(|e| e.to_string())?.len() <= MAX_MANIFEST_BYTES,
        "manifest exceeds 1 MiB",
    )?;
    let room: RoomDocument =
        serde_json::from_value(value.clone()).map_err(|e| format!("invalid v3 manifest: {e}"))?;
    require(
        room.version == 3 && room.api_version == 1,
        "unsupported Room or author API version",
    )?;
    require(room_uuid(&room.id), "room.id must be a nonempty UUID")?;
    require(
        !room.name.trim().is_empty() && room.name.chars().count() <= 160,
        "invalid Room name",
    )?;
    require(
        !room.desks.is_empty() && room.desks.len() <= 64,
        "Room requires 1..64 Desks",
    )?;
    require(
        room.resources.len() <= MAX_RESOURCES,
        "too many declared resources",
    )?;
    let mut paths = HashSet::new();
    for path in &room.resources {
        validate_resource_path(path)?;
        require(
            paths.insert(path.to_lowercase()),
            "duplicate or case-colliding resource",
        )?;
    }
    let resources: HashSet<_> = room.resources.iter().map(String::as_str).collect();
    let entry = |path: &str| -> Result<(), String> {
        require(
            resources.contains(path),
            format!("entry {path:?} is not a declared resource"),
        )
    };
    let html = |path: &str| -> Result<(), String> {
        entry(path)?;
        require(path.ends_with(".html"), "HTML entry must end in .html")
    };
    let content = |value: &Content| -> Result<(), String> {
        require(
            ["image", "video", "gif", "html"].contains(&value.kind.as_str()),
            "unsupported content type",
        )?;
        entry(&value.src)?;
        let ext = value
            .src
            .rsplit('.')
            .next()
            .unwrap_or("")
            .to_ascii_lowercase();
        let valid = match value.kind.as_str() {
            "html" => ext == "html",
            "gif" => ext == "gif",
            "video" => ["mp4", "webm"].contains(&ext.as_str()),
            _ => ["png", "jpg", "jpeg", "webp", "svg", "avif", "gif"].contains(&ext.as_str()),
        };
        require(valid, "content type does not match resource extension")
    };
    let mut ids = HashSet::new();
    for desk in &room.desks {
        identity(&desk.id)?;
        require(ids.insert(desk.id.as_str()), "duplicate Desk id")?;
        require(
            !desk.name.trim().is_empty() && desk.name.chars().count() <= 160,
            "invalid Desk name",
        )?;
        if let Some(background) = &desk.background {
            content(background)?;
        }
    }
    require(
        ids.contains(room.start_desk.as_str()),
        "startDesk does not name an installed Desk",
    )?;
    if let Some(scene) = &room.room_scene {
        html(&scene.entry)?;
        capabilities(&scene.capabilities)?;
        if let Some(config) = &scene.config {
            public_config(config, 0)?;
        }
    }
    for value in [&room.start, &room.idle].into_iter().flatten() {
        content(value)?;
    }
    if let Some(transition) = &room.transition {
        require(
            ["slide", "fade", "none", "author"].contains(&transition.kind.as_str())
                && transition.duration_ms <= 10_000,
            "invalid transition",
        )?;
        require(
            transition.kind != "author" || room.room_scene.is_some(),
            "author transition requires Room scene",
        )?;
    }
    require(
        room.buttons.len() <= 1024 && room.components.len() <= 128,
        "too many buttons or components",
    )?;
    let mut buttons = BTreeMap::new();
    for button in &room.buttons {
        identity(&button.id)?;
        require(
            button.scope == "room" || ids.contains(button.scope.as_str()),
            "button scope is not a Desk or room",
        )?;
        require(
            !button.name.trim().is_empty() && button.name.chars().count() <= 160,
            "invalid button name",
        )?;
        require(
            buttons.insert(button.id.as_str(), button).is_none(),
            "duplicate button id",
        )?;
        if let Some(action) = &button.action {
            require(
                [
                    "desk.next",
                    "desk.previous",
                    "desk.go",
                    "binding.launch",
                    "dext.exit",
                ]
                .contains(&action.kind.as_str()),
                "unknown button action",
            )?;
            require(
                if action.kind == "desk.go" {
                    action.desk_id.as_deref().is_some_and(|id| ids.contains(id))
                } else {
                    action.desk_id.is_none()
                },
                "invalid action Desk reference",
            )?;
        }
    }
    let mut components = BTreeMap::new();
    for component in &room.components {
        identity(&component.id)?;
        require(
            components
                .insert(component.id.as_str(), component)
                .is_none(),
            "duplicate component id",
        )?;
        require(
            ["widget", "dock"].contains(&component.role.as_str()),
            "invalid component role",
        )?;
        html(&component.entry)?;
        capabilities(&component.capabilities)?;
        let p = &component.placement;
        require(
            [p.x, p.y, p.width, p.height].iter().all(|n| n.is_finite())
                && p.x >= 0.0
                && p.y >= 0.0
                && p.width > 0.0
                && p.height > 0.0
                && p.x + p.width <= 1920.0
                && p.y + p.height <= 1080.0,
            "component placement is outside canvas",
        )?;
        let mut refs = HashSet::new();
        for id in &component.button_ids {
            require(
                buttons.contains_key(id.as_str()) && refs.insert(id),
                "component has duplicate or missing button reference",
            )?;
        }
        if let Some(config) = &component.config {
            public_config(config, 0)?;
        }
    }
    if let Some(dock) = &room.dock_component_id {
        require(
            components
                .get(dock.as_str())
                .is_some_and(|c| c.role == "dock"),
            "dockComponentId is not a Dock component",
        )?;
    }
    let mut icons = HashSet::new();
    for desk in &room.desks {
        require(
            desk.icons.len() <= 512 && desk.components.len() <= 32,
            "Desk exceeds icon/component limit",
        )?;
        let mut refs = HashSet::new();
        for id in &desk.components {
            require(
                components.contains_key(id.as_str()) && refs.insert(id),
                "Desk has duplicate or missing component reference",
            )?;
        }
        for (id, config) in &desk.component_overrides {
            require(
                refs.contains(id),
                "Desk override references an unassigned component",
            )?;
            public_config(config, 0)?;
        }
        for icon in &desk.icons {
            identity(&icon.id)?;
            require(icons.insert(icon.id.as_str()), "duplicate icon id")?;
            require(
                buttons
                    .get(icon.button_id.as_str())
                    .is_some_and(|b| b.scope == "room" || b.scope == desk.id),
                "icon references missing or out-of-scope button",
            )?;
            require(
                icon.x <= 63 && icon.y <= 63,
                "icon grid coordinate exceeds 63",
            )?;
            require(
                icon.label.as_ref().is_none_or(|s| s.chars().count() <= 160)
                    && icon.glyph.as_ref().is_none_or(|s| s.chars().count() <= 8),
                "invalid icon label or glyph",
            )?;
        }
    }
    Ok(Manifest {
        room_id: room.id.clone(),
        desk_ids: room.desks.iter().map(|d| d.id.clone()).collect(),
        start_desk_id: room.start_desk.clone(),
        resource_paths: room.resources.clone(),
        document: room,
    })
}
