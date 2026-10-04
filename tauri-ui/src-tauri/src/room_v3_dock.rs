//! Official, self-contained native Dock author files.
//! Import publishes a new asset directory; the caller separately saves the Room.
use crate::room_v3;
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::Path,
};
struct Template {
    id: &'static str,
    files: [(&'static str, &'static [u8]); 4],
}
const CATALOG: [Template; 2] = [
    Template {
        id: "three-panels",
        files: [
            (
                "template.json",
                include_bytes!("../../../creator-kit/v3/dock-templates/three-panels/template.json"),
            ),
            (
                "index.html",
                include_bytes!("../../../creator-kit/v3/dock-templates/three-panels/index.html"),
            ),
            (
                "style.css",
                include_bytes!("../../../creator-kit/v3/dock-templates/three-panels/style.css"),
            ),
            (
                "main.js",
                include_bytes!("../../../creator-kit/v3/dock-templates/three-panels/main.js"),
            ),
        ],
    },
    Template {
        id: "navigation-bar",
        files: [
            (
                "template.json",
                include_bytes!(
                    "../../../creator-kit/v3/dock-templates/navigation-bar/template.json"
                ),
            ),
            (
                "index.html",
                include_bytes!("../../../creator-kit/v3/dock-templates/navigation-bar/index.html"),
            ),
            (
                "style.css",
                include_bytes!("../../../creator-kit/v3/dock-templates/navigation-bar/style.css"),
            ),
            (
                "main.js",
                include_bytes!("../../../creator-kit/v3/dock-templates/navigation-bar/main.js"),
            ),
        ],
    },
];
const SDK: &[u8] = include_bytes!("../../../creator-kit/v3/sdk/dext-sdk.v1.js");
const MAX_DESCRIPTOR_BYTES: usize = 65536;
fn required(value: bool, message: &str) -> Result<(), String> {
    if value {
        Ok(())
    } else {
        Err(message.into())
    }
}
fn name(value: &Value) -> bool {
    value
        .as_str()
        .is_some_and(|s| !s.trim().is_empty() && s.chars().count() <= 160)
}
fn identity(value: &Value) -> bool {
    value.as_str().is_some_and(|s| {
        !s.is_empty()
            && s.len() <= 96
            && s.chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    })
}
fn descriptor(bytes: &[u8]) -> Result<Value, String> {
    required(
        bytes.len() <= MAX_DESCRIPTOR_BYTES,
        "Dock template descriptor exceeds 64 KiB",
    )?;
    let value = room_v3::parse_document(bytes)?;
    required(
        value.is_object()
            && value["formatVersion"] == 1
            && identity(&value["id"])
            && name(&value["name"]),
        "Unsupported Dock template descriptor",
    )?;
    required(
        value["entry"] == "index.html",
        "Dock template entry must be index.html",
    )?;
    let placement = &value["placement"];
    let x = placement["x"]
        .as_f64()
        .ok_or("Dock template placement x missing")?;
    let y = placement["y"]
        .as_f64()
        .ok_or("Dock template placement y missing")?;
    let width = placement["width"]
        .as_f64()
        .ok_or("Dock template width missing")?;
    let height = placement["height"]
        .as_f64()
        .ok_or("Dock template height missing")?;
    required(
        x >= 0.0
            && y >= 0.0
            && width > 0.0
            && height > 0.0
            && x + width <= 1920.0
            && y + height <= 1080.0,
        "Dock template placement outside canvas",
    )?;
    let parameters = value["parameters"]
        .as_array()
        .ok_or("Dock parameters missing")?;
    let regions = value["regions"].as_array().ok_or("Dock regions missing")?;
    required(
        parameters.len() <= 32 && regions.len() <= 64,
        "Too many Dock parameters or regions",
    )?;
    let mut ids = HashSet::new();
    for parameter in parameters {
        required(
            identity(&parameter["id"])
                && name(&parameter["name"])
                && ids.insert(parameter["id"].as_str().unwrap()),
            "Invalid or duplicate Dock parameter",
        )?;
        match parameter["type"].as_str() {
            Some("number") => {
                let default = parameter["default"]
                    .as_f64()
                    .ok_or("Dock numeric default missing")?;
                required(
                    parameter["min"].as_f64().is_none_or(|min| default >= min)
                        && parameter["max"].as_f64().is_none_or(|max| default <= max),
                    "Dock default outside parameter range",
                )?;
            }
            Some("choice") => {
                let options = parameter["options"]
                    .as_array()
                    .ok_or("Dock choices missing")?;
                required(
                    parameter["default"].is_string()
                        && options
                            .iter()
                            .any(|option| option["value"] == parameter["default"]),
                    "Dock default choice missing",
                )?;
            }
            _ => return Err("Unsupported Dock parameter type".into()),
        }
    }
    ids.clear();
    for region in regions {
        required(
            identity(&region["id"])
                && name(&region["name"])
                && ids.insert(region["id"].as_str().unwrap()),
            "Invalid or duplicate Dock region",
        )?;
        required(
            ["data", "button"].contains(&region["kind"].as_str().unwrap_or("")),
            "Unsupported Dock region kind",
        )?;
        if let Some(source) = region.get("defaultSource") {
            validate_source(source)?;
        }
    }
    for example in value["examples"]
        .as_array()
        .ok_or("Dock examples missing")?
    {
        required(
            identity(&example["id"]) && name(&example["name"]),
            "Invalid Dock example",
        )?;
        validate_source(&example["source"])?;
    }
    Ok(value)
}
fn validate_source(source: &Value) -> Result<(), String> {
    required(
        ["time.read", "hardware.read", "media.read", "audio.read"]
            .contains(&source["capability"].as_str().unwrap_or("")),
        "Unsupported Dock data source",
    )?;
    required(
        source["path"]
            .as_array()
            .is_some_and(|path| path.len() <= 12 && path.iter().all(Value::is_string)),
        "Dock data path must be an array of keys",
    )?;
    required(
        ["text", "number", "clock", "countdown"].contains(&source["format"].as_str().unwrap_or("")),
        "Unsupported Dock data format",
    )
}
pub fn list() -> Result<Vec<Value>, String> {
    CATALOG
        .iter()
        .map(|template| {
            let value = descriptor(template.files[0].1)?;
            required(value["id"] == template.id, "Dock catalog identity mismatch")?;
            Ok(value)
        })
        .collect()
}
pub fn import(dir: &Path, template_id: &str) -> Result<Value, String> {
    let template = CATALOG
        .iter()
        .find(|template| template.id == template_id)
        .ok_or("Dock 模板不存在")?;
    let descriptor = descriptor(template.files[0].1)?;
    let current = room_v3::read_document(dir)?;
    let manifest = room_v3::validate_manifest(&current)?;
    required(
        manifest.resource_paths.len() + 5 <= room_v3::MAX_RESOURCES,
        "Room exceeds resource limit",
    )?;
    let assets = dir.join("assets");
    fs::create_dir_all(&assets).map_err(|e| format!("Create Dock assets: {e}"))?;
    let staging = tempfile::Builder::new()
        .prefix(&format!("dock-{template_id}-"))
        .tempdir_in(&assets)
        .map_err(|e| format!("Create Dock import: {e}"))?;
    let mut resources = Vec::new();
    let prefix = format!(
        "assets/{}",
        staging.path().file_name().unwrap().to_string_lossy()
    );
    for (name, bytes) in template
        .files
        .iter()
        .copied()
        .chain(std::iter::once(("dext-sdk.v1.js", SDK)))
    {
        let mut file = fs::File::create(staging.path().join(name))
            .map_err(|e| format!("Create Dock file: {e}"))?;
        file.write_all(bytes)
            .and_then(|_| file.sync_all())
            .map_err(|e| format!("Write Dock file: {e}"))?;
        resources.push(format!("{prefix}/{name}"));
    }
    resources.sort();
    let _ = staging.keep();
    Ok(
        json!({"entry":format!("{prefix}/index.html"),"resources":resources,"descriptor":descriptor}),
    )
}
pub fn inspect(dir: &Path, component_id: &str) -> Result<Value, String> {
    let current = room_v3::read_document(dir)?;
    let manifest = room_v3::validate_manifest(&current)?;
    let component = current["components"]
        .as_array()
        .and_then(|components| {
            components
                .iter()
                .find(|c| c["id"] == component_id && c["role"] == "dock")
        })
        .ok_or("Dock 组件已不存在")?;
    let entry = component["entry"].as_str().ok_or("Dock entry missing")?;
    let relative = Path::new(entry)
        .parent()
        .ok_or("Dock entry has no directory")?
        .join("template.json")
        .to_string_lossy()
        .replace('\\', "/");
    required(
        manifest.resource_paths.contains(&relative),
        "这个本地 Dock 没有模板区域描述",
    )?;
    let mut bytes = Vec::new();
    room_v3::open_resource(dir, &relative)?
        .take((MAX_DESCRIPTOR_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Read Dock template: {e}"))?;
    let descriptor = descriptor(&bytes)?;
    if let Some(id) = component["config"]["template"].get("id") {
        required(id == &descriptor["id"], "Dock 配置与模板资源不一致")?;
    }
    Ok(descriptor)
}
