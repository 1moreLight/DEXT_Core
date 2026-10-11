//! Source Room copies and local sharing. Only declared author resources leave
//! the source directory; installation/source records and Core personal data do not.
use crate::room_v3;
use serde_json::Value;
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};
const MAX_FILE_BYTES: u64 = 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 2 * MAX_FILE_BYTES;

#[cfg(windows)]
fn fresh_room_id() -> Result<String, String> {
    #[repr(C)]
    #[derive(Default)]
    struct NativeGuid { a: u32, b: u16, c: u16, d: [u8; 8] }
    #[link(name = "ole32")]
    extern "system" { fn CoCreateGuid(value: *mut NativeGuid) -> i32; }
    let mut id = NativeGuid::default();
    let result = unsafe { CoCreateGuid(&mut id) };
    if result < 0 { return Err(format!("create Room identity: HRESULT {result:#x}")); }
    Ok(format!("{:08x}-{:04x}-{:04x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        id.a, id.b, id.c, id.d[0], id.d[1], id.d[2], id.d[3], id.d[4], id.d[5], id.d[6], id.d[7]))
}
#[cfg(not(windows))]
fn fresh_room_id() -> Result<String, String> { Err("Room copies require the Windows configurator".into()) }

fn library_destination(library: &Path, name: &str) -> Result<PathBuf, String> {
    crate::validate_room_name(name)?;
    fs::create_dir_all(library).map_err(|e| format!("prepare Room library: {e}"))?;
    let library = library.canonicalize().map_err(|e| format!("open Room library: {e}"))?;
    if crate::is_reparse_point(&library)? { return Err("Room library cannot be a reparse point".into()); }
    let destination = library.join(name);
    if destination.exists() { return Err(format!("room already exists: {name}; choose a different name")); }
    Ok(destination)
}
fn author_document(document: &Value) -> Result<room_v3::Manifest, String> {
    let manifest = room_v3::validate_manifest(document)?;
    for resource in &manifest.resource_paths {
        // These names belong to the host, even if a source directory happens
        // to contain them. Reject instead of silently changing an author bundle.
        if ["source.v3.json", "session.v3.json", "personal.json", "dock-preferences.json"]
            .contains(&resource.to_ascii_lowercase().as_str()) {
            return Err(format!("host/private record cannot be shared: {resource}"));
        }
    }
    Ok(manifest)
}
fn write_document(dir: &Path, document: &Value) -> Result<(), String> {
    author_document(document)?;
    let bytes = serde_json::to_vec_pretty(document).map_err(|e| e.to_string())?;
    if bytes.len() > room_v3::MAX_MANIFEST_BYTES { return Err("manifest exceeds 1 MiB".into()); }
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(dir.join("room.json"))
        .map_err(|e| format!("create copied room.json: {e}"))?;
    file.write_all(&bytes).and_then(|_| file.sync_all()).map_err(|e| format!("write copied Room: {e}"))
}
fn copy_resources(source: &Path, destination: &Path, manifest: &room_v3::Manifest) -> Result<(), String> {
    let mut total = 0u64;
    for resource in &manifest.resource_paths {
        let mut reader = room_v3::open_resource(source, resource)?;
        let expected = reader.length().map_err(|e| e.to_string())?;
        if expected > MAX_FILE_BYTES { return Err(format!("resource exceeds 1 GiB: {resource}")); }
        let path = destination.join(resource);
        fs::create_dir_all(path.parent().ok_or("resource has no parent")?)
            .map_err(|e| format!("create copied resource directory: {e}"))?;
        let mut file = fs::OpenOptions::new().create_new(true).write(true).open(&path)
            .map_err(|e| format!("create copied resource {resource}: {e}"))?;
        let copied = std::io::copy(&mut reader.by_ref().take(MAX_FILE_BYTES + 1), &mut file)
            .map_err(|e| format!("copy resource {resource}: {e}"))?;
        if copied != expected || copied > MAX_FILE_BYTES { return Err(format!("resource changed during copy: {resource}")); }
        total = total.checked_add(copied).ok_or("Room size overflow")?;
        if total > MAX_TOTAL_BYTES { return Err("Room resources exceed 2 GiB".into()); }
        file.sync_all().map_err(|e| format!("flush copied resource {resource}: {e}"))?;
    }
    Ok(())
}

/// Held privately until Core confirms the new copy's local button overrides.
/// Drop cleans only this operation's temporary directory, never a published Room.
pub struct PreparedCopy {
    _staging: tempfile::TempDir,
    contents: PathBuf,
    destination: PathBuf,
    pub source_id: String,
    pub room_id: String,
}
impl PreparedCopy {
    pub fn publish(self) -> Result<PathBuf, String> {
        if self.destination.exists() { return Err("room already exists; copied Room was not published".into()); }
        fs::rename(&self.contents, &self.destination).map_err(|e| format!("publish copied Room: {e}"))?;
        Ok(self.destination.clone())
    }
}
pub fn prepare_copy(source: &Path, library: &Path, name: &str, json: &str) -> Result<PreparedCopy, String> {
    let destination = library_destination(library, name)?;
    let current = room_v3::read_document(source)?;
    let current_manifest = author_document(&current)?;
    let mut document = room_v3::parse_document(json.as_bytes())?;
    let manifest = author_document(&document)?;
    if manifest.room_id != current_manifest.room_id { return Err("copy draft does not belong to the selected Room".into()); }
    let room_id = fresh_room_id()?;
    document["id"] = Value::String(room_id.clone());
    document["name"] = Value::String(name.to_string());
    author_document(&document)?;
    let staging = tempfile::Builder::new().prefix(".dext-copy-")
        .tempdir_in(destination.parent().ok_or("Room destination has no parent")?)
        .map_err(|e| format!("create Room copy staging: {e}"))?;
    let contents = staging.path().join("room");
    fs::create_dir(&contents).map_err(|e| e.to_string())?;
    copy_resources(source, &contents, &manifest)?;
    write_document(&contents, &document)?;
    Ok(PreparedCopy { _staging: staging, contents, destination, source_id: manifest.room_id, room_id })
}

/// Probe just the bounded root manifest; the selected format's importer still
/// performs its full checks before publishing anything.
pub fn is_native_archive(path: &Path) -> Result<bool, String> {
    let file = fs::File::open(path).map_err(|e| format!("open Room zip: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("open Room zip: {e}"))?;
    let mut entry = archive.by_name("room.json").map_err(|e| format!("root room.json missing: {e}"))?;
    let mut bytes = Vec::new();
    entry.by_ref().take(room_v3::MAX_MANIFEST_BYTES as u64 + 1).read_to_end(&mut bytes)
        .map_err(|e| format!("read zip manifest: {e}"))?;
    if bytes.len() > room_v3::MAX_MANIFEST_BYTES { return Ok(false); }
    let document = room_v3::parse_document(&bytes)?;
    if document.get("version").and_then(Value::as_u64).is_some_and(|v| v >= 3) {
        room_v3::require_compatibility(&document)?;
        return Ok(true);
    }
    Ok(false)
}
pub fn export(source: &Path, destination: &Path) -> Result<(), String> {
    let document = room_v3::read_document(source)?;
    let manifest = author_document(&document)?;
    let bytes = serde_json::to_vec_pretty(&document).map_err(|e| e.to_string())?;
    if bytes.len() > room_v3::MAX_MANIFEST_BYTES { return Err("manifest exceeds 1 MiB".into()); }
    if destination.exists() { return Err("destination already exists; choose another zip name".into()); }
    let parent = destination.parent().ok_or("zip destination has no parent")?;
    fs::create_dir_all(parent).map_err(|e| format!("prepare zip destination: {e}"))?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| format!("create temporary zip: {e}"))?;
    {
        let mut writer = zip::ZipWriter::new(temp.as_file_mut());
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated).unix_permissions(0o644);
        writer.start_file("room.json", options).map_err(|e| e.to_string())?;
        writer.write_all(&bytes).map_err(|e| e.to_string())?;
        let mut total = 0u64;
        for resource in &manifest.resource_paths {
            let mut reader = room_v3::open_resource(source, resource)?;
            let expected = reader.length().map_err(|e| e.to_string())?;
            if expected > MAX_FILE_BYTES { return Err(format!("resource exceeds 1 GiB: {resource}")); }
            writer.start_file(resource, options).map_err(|e| format!("write zip resource {resource}: {e}"))?;
            let copied = std::io::copy(&mut reader.by_ref().take(MAX_FILE_BYTES + 1), &mut writer)
                .map_err(|e| format!("export resource {resource}: {e}"))?;
            total = total.checked_add(copied).ok_or("Room size overflow")?;
            if copied != expected || copied > MAX_FILE_BYTES || total > MAX_TOTAL_BYTES {
                return Err(format!("resource changed or exceeds Room limit: {resource}"));
            }
        }
        writer.finish().map_err(|e| format!("finish Room zip: {e}"))?;
    }
    temp.as_file_mut().sync_all().map_err(|e| format!("flush Room zip: {e}"))?;
    temp.persist_noclobber(destination).map(|_| ())
        .map_err(|e| format!("publish Room zip without replacing existing file: {}", e.error))
}
pub fn import(library: &Path, archive_path: &Path, requested_name: Option<&str>) -> Result<PathBuf, String> {
    let inferred = archive_path.file_stem().and_then(|s| s.to_str()).unwrap_or("imported-room");
    let name = requested_name.unwrap_or(inferred).trim();
    let destination = library_destination(library, name)?;
    if !archive_path.is_file() || crate::is_reparse_point(archive_path)? { return Err("selected archive must be a regular file".into()); }
    let file = fs::File::open(archive_path).map_err(|e| format!("open Room zip: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("open Room zip: {e}"))?;
    if archive.len() == 0 || archive.len() > room_v3::MAX_RESOURCES + 1 {
        return Err("Room zip exceeds the declared resource count".into());
    }
    let staging = tempfile::Builder::new().prefix(".dext-v3-import-")
        .tempdir_in(destination.parent().ok_or("Room destination has no parent")?)
        .map_err(|e| format!("create import staging: {e}"))?;
    let contents = staging.path().join("room");
    fs::create_dir(&contents).map_err(|e| e.to_string())?;
    let mut names = HashSet::new();
    let mut total = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|e| format!("read zip entry: {e}"))?;
        if entry.is_dir() {
            // Directories are not author resources. Files below create their
            // own checked parents, so no directory entry needs extraction.
            continue;
        }
        let name = entry.name().to_string();
        if name != "room.json" { room_v3::validate_resource_path(&name)?; }
        if !names.insert(name.to_ascii_lowercase()) { return Err(format!("duplicate zip entry: {name}")); }
        if entry.unix_mode().is_some_and(|mode| mode & 0o170000 == 0o120000) {
            return Err(format!("zip resource cannot be a symbolic link: {name}"));
        }
        let limit = if name == "room.json" { room_v3::MAX_MANIFEST_BYTES as u64 } else { MAX_FILE_BYTES };
        if entry.size() > limit { return Err(format!("zip resource exceeds size limit: {name}")); }
        let output = contents.join(&name);
        fs::create_dir_all(output.parent().ok_or("zip resource has no parent")?).map_err(|e| e.to_string())?;
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(output)
            .map_err(|e| format!("create extracted resource {name}: {e}"))?;
        let expected = entry.size();
        let copied = std::io::copy(&mut entry.by_ref().take(limit + 1), &mut file)
            .map_err(|e| format!("extract resource {name}: {e}"))?;
        total = total.checked_add(copied).ok_or("Room zip size overflow")?;
        if copied != expected || copied > limit || total > MAX_TOTAL_BYTES + room_v3::MAX_MANIFEST_BYTES as u64 {
            return Err(format!("zip resource changed or exceeds Room limit: {name}"));
        }
        file.sync_all().map_err(|e| format!("flush extracted resource {name}: {e}"))?;
    }
    let mut document = room_v3::read_document(&contents)?;
    let manifest = author_document(&document)?;
    let expected: HashSet<String> = std::iter::once("room.json".to_string())
        .chain(manifest.resource_paths.iter().map(|path| path.to_ascii_lowercase())).collect();
    if names != expected { return Err("Room zip files do not match the declared author resources".into()); }
    for resource in &manifest.resource_paths { room_v3::open_resource(&contents, resource)?; }
    document["id"] = Value::String(fresh_room_id()?);
    document["name"] = Value::String(name.to_string());
    author_document(&document)?;
    let bytes = serde_json::to_vec_pretty(&document).map_err(|e| e.to_string())?;
    if bytes.len() > room_v3::MAX_MANIFEST_BYTES { return Err("imported manifest exceeds 1 MiB".into()); }
    let mut manifest_file = fs::OpenOptions::new().write(true).truncate(true).open(contents.join("room.json"))
        .map_err(|e| format!("open imported manifest: {e}"))?;
    manifest_file.write_all(&bytes).and_then(|_| manifest_file.sync_all()).map_err(|e| e.to_string())?;
    drop(manifest_file);
    if destination.exists() { return Err("room already exists; choose another name".into()); }
    fs::rename(&contents, &destination).map_err(|e| format!("publish imported Room: {e}"))?;
    Ok(destination)
}
/// Outside every Room directory, so this recovery intent never enters a share.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PersonalCleanupIntent {
    format_version: u32,
    pub room_id: String,
    pub room_name: String,
}
const CLEANUP_PREFIX: &str = ".dext-personal-delete-";
fn cleanup_identity(id: &str) -> Result<(), String> {
    if id.len() != 36 || id.bytes().enumerate().any(|(index, byte)|
        if [8,13,18,23].contains(&index) { byte != b'-' }
        else { !byte.is_ascii_hexdigit() || byte.is_ascii_uppercase() }) ||
        id == "00000000-0000-0000-0000-000000000000" {
        return Err("personal cleanup requires a canonical Room UUID".into());
    }
    Ok(())
}
pub fn queue_personal_cleanup(library: &Path, room_id: &str, room_name: &str) -> Result<PathBuf, String> {
    cleanup_identity(room_id)?;
    crate::validate_room_name(room_name)?;
    let library = library.canonicalize().map_err(|e| e.to_string())?;
    let path = library.join(format!("{CLEANUP_PREFIX}{room_id}.json"));
    let intent = PersonalCleanupIntent { format_version: 1, room_id: room_id.into(), room_name: room_name.into() };
    let bytes = serde_json::to_vec(&intent).map_err(|e| e.to_string())?;
    if path.exists() {
        let existing = read_cleanup_intent(&path)?;
        if existing.room_id != room_id || existing.room_name != room_name { return Err("conflicting personal cleanup intent".into()); }
        return Ok(path);
    }
    let mut temp = tempfile::NamedTempFile::new_in(&library).map_err(|e| e.to_string())?;
    temp.write_all(&bytes).and_then(|_| temp.as_file_mut().sync_all()).map_err(|e| e.to_string())?;
    temp.persist_noclobber(&path).map_err(|e| format!("save personal cleanup intent: {}", e.error))?;
    Ok(path)
}
fn read_cleanup_intent(path: &Path) -> Result<PersonalCleanupIntent, String> {
    if crate::is_reparse_point(path)? { return Err("cleanup intent cannot be a reparse point".into()); }
    let mut bytes = Vec::new();
    let file = fs::File::open(path).map_err(|e| if e.raw_os_error() == Some(32) {
        "personal cleanup intent busy".to_string()
    } else { e.to_string() })?;
    file.take(4097).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    parse_cleanup_intent(path, &bytes)
}
fn parse_cleanup_intent(path: &Path, bytes: &[u8]) -> Result<PersonalCleanupIntent, String> {
    if bytes.len() > 4096 { return Err("personal cleanup intent exceeds limit".into()); }
    let intent: PersonalCleanupIntent = serde_json::from_slice(bytes).map_err(|e| format!("read personal cleanup intent: {e}"))?;
    cleanup_identity(&intent.room_id)?;
    crate::validate_room_name(&intent.room_name)?;
    let expected_name = format!("{CLEANUP_PREFIX}{}.json",intent.room_id);
    if intent.format_version != 1 || path.file_name().and_then(|s| s.to_str()) != Some(expected_name.as_str()) {
        return Err("invalid personal cleanup intent identity".into());
    }
    Ok(intent)
}
/// Hold the actual recovery record through copy/trash/cleanup. Another
/// configurator must acquire this lease before calling Core cleanup.
pub fn lease_personal_cleanup(path: &Path) -> Result<(fs::File, PersonalCleanupIntent), String> {
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)] {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(0).custom_flags(0x00200000);
    }
    let mut file = options.open(path).map_err(|e| if e.raw_os_error() == Some(32) {
        "personal cleanup intent busy".to_string()
    } else {format!("hold personal cleanup intent: {e}")})?;
    let meta = file.metadata().map_err(|e|e.to_string())?;
    if !meta.is_file() { return Err("personal cleanup intent is not a file".into()); }
    #[cfg(windows)] {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {return Err("personal cleanup intent is a reparse point".into());}
    }
    let mut bytes = Vec::new();
    Read::by_ref(&mut file).take(4097).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
    let intent = parse_cleanup_intent(path,&bytes)?;
    Ok((file,intent))
}
pub fn pending_personal_cleanup(library: &Path) -> Result<Vec<(PathBuf, PersonalCleanupIntent)>, String> {
    if !library.exists() { return Ok(Vec::new()); }
    let mut entries = Vec::new();
    for entry in fs::read_dir(library).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with(CLEANUP_PREFIX) && name.ends_with(".json") {
            let path = entry.path();
            match read_cleanup_intent(&path) {
                Ok(intent) => entries.push((path, intent)),
                Err(error) if error == "personal cleanup intent busy" => continue,
                Err(error) => return Err(error),
            }
        }
    }
    Ok(entries)
}
pub fn cleanup_source_restored(library: &Path, intent: &PersonalCleanupIntent) -> Result<bool, String> {
    let source = library.join(&intent.room_name);
    if source.try_exists().map_err(|e| format!("inspect restored Room: {e}"))? {
        let document = room_v3::read_document(&source)?;
        if document["id"].as_str() == Some(intent.room_id.as_str()) { return Ok(true); }
    }
    // Room identity survives a directory rename. Check published library roots,
    // never the nested contents of copy/import staging directories.
    for (index, entry) in fs::read_dir(library).map_err(|e| format!("inspect Room library: {e}"))?.enumerate() {
        if index >= 4096 { return Err("Room library recovery scan exceeds 4096 entries; cleanup retained".into()); }
        let entry = entry.map_err(|e| format!("inspect Room library entry: {e}"))?;
        if !entry.file_type().map_err(|e| format!("inspect Room directory: {e}"))?.is_dir() { continue; }
        let candidate = entry.path();
        if candidate == source { continue; }
        if !candidate.join("room.json").try_exists().map_err(|e| format!("inspect Room manifest: {e}"))? { continue; }
        let document = room_v3::read_document(&candidate)
            .map_err(|e| format!("cannot confirm Room absence; cleanup retained: {e}"))?;
        if document["id"].as_str() == Some(intent.room_id.as_str()) { return Ok(true); }
    }
    Ok(false)
}
#[cfg(all(test, windows))]
#[path = "room_v3_sharing_tests.rs"]
mod tests;
