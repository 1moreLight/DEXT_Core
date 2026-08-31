use prost::Message;
use serde::Deserialize;
use std::path::Path;
use std::sync::OnceLock;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::windows::named_pipe::ClientOptions;

use crate::proto::desktop::{
    CloseAllWallpapersRequest, GetCoreStatsResponse, GetWallpapersResponse,
};
use crate::proto::grpc_dotnet_named_pipes::generated::{
    transport_message::Data, Headers, PayloadInfo, RequestControl, RequestInit, TransportMessage,
};
use crate::proto::settings::SettingsDataModel;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeIdentityConfig {
    product_name: String,
    runtime_identity: String,
    grpc_pipe_prefix: String,
    local_app_data_directory: String,
}

fn runtime_identity() -> &'static RuntimeIdentityConfig {
    static IDENTITY: OnceLock<RuntimeIdentityConfig> = OnceLock::new();
    IDENTITY.get_or_init(|| {
        serde_json::from_str(include_str!("../../../dext-runtime-identity.json"))
            .expect("invalid dext-runtime-identity.json")
    })
}

fn grpc_pipe_server_name() -> String {
    let user = std::env::var("USERNAME").unwrap_or_default();
    let identity = runtime_identity();
    format!(
        "{}{}{}",
        identity.grpc_pipe_prefix, identity.runtime_identity, user
    )
}

pub fn pipe_name() -> String {
    format!(r"\\.\pipe\{}", grpc_pipe_server_name())
}

// ponytail: one pipe connection per call, same as the C# NamedPipeChannel does
async fn raw_call(method: &str, request: &[u8]) -> Result<Vec<Vec<u8>>, String> {
    let mut pipe = ClientOptions::new()
        .open(pipe_name())
        .map_err(|e| format!("pipe connect failed (is Dext Core running?): {e}"))?;

    // request packet: length-delimited TransportMessages, payload inline (all our requests are tiny)
    let mut packet = Vec::new();
    TransportMessage {
        data: Some(Data::RequestInit(RequestInit {
            method_full_name: method.to_string(),
            deadline: None,
            connection_id: 0,
        })),
    }
    .encode_length_delimited(&mut packet)
    .map_err(|e| e.to_string())?;
    TransportMessage {
        data: Some(Data::Headers(Headers { metadata: vec![] })),
    }
    .encode_length_delimited(&mut packet)
    .map_err(|e| e.to_string())?;
    TransportMessage {
        data: Some(Data::PayloadInfo(PayloadInfo {
            size: request.len() as i32,
            in_same_packet: true,
        })),
    }
    .encode_length_delimited(&mut packet)
    .map_err(|e| e.to_string())?;
    packet.extend_from_slice(request);
    TransportMessage {
        data: Some(Data::RequestControl(RequestControl::StreamEnd as i32)),
    }
    .encode_length_delimited(&mut packet)
    .map_err(|e| e.to_string())?;
    pipe.write_all(&packet).await.map_err(|e| e.to_string())?;
    pipe.flush().await.map_err(|e| e.to_string())?;

    // read responses until trailers; byte-mode read is fine because every payload is size-delimited
    let mut buf = Vec::new();
    let mut payloads = Vec::new();
    loop {
        let mut chunk = [0u8; 4096];
        let n = pipe.read(&mut chunk).await.map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("pipe closed before trailers".into());
        }
        buf.extend_from_slice(&chunk[0..n]);

        loop {
            match parse_next(&mut buf)? {
                ParseNext::Incomplete => break,
                ParseNext::Skip => {}
                ParseNext::Payload(payload) => payloads.push(payload),
                ParseNext::Done(status) => {
                    if status == 0 {
                        return Ok(payloads);
                    }
                    return Err(format!("rpc status {status}"));
                }
            }
        }
    }
}

fn normalize_windows_path(value: &str) -> String {
    value
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn verify_core_identity_response(response: &GetCoreStatsResponse) -> Result<(), String> {
    let expected = runtime_identity();
    if response.product_name != expected.product_name {
        return Err(format!(
            "refusing Core product {:?}; expected {:?}",
            response.product_name, expected.product_name
        ));
    }
    if response.runtime_identity != expected.runtime_identity {
        return Err(format!(
            "refusing runtime identity {:?}; expected {:?}",
            response.runtime_identity, expected.runtime_identity
        ));
    }
    let expected_pipe = grpc_pipe_server_name();
    if response.grpc_pipe_name != expected_pipe {
        return Err(format!(
            "refusing gRPC pipe {:?}; expected {:?}",
            response.grpc_pipe_name, expected_pipe
        ));
    }
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let expected_app_data = Path::new(&local_app_data).join(&expected.local_app_data_directory);
        if normalize_windows_path(&response.app_data_directory)
            != normalize_windows_path(&expected_app_data.to_string_lossy())
        {
            return Err(format!(
                "refusing app-data directory {:?}; expected {:?}",
                response.app_data_directory,
                expected_app_data.display()
            ));
        }
    }
    if response.process_id <= 0 {
        return Err("refusing Core with an invalid process id".into());
    }

    #[cfg(debug_assertions)]
    {
        let worktree_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let worktree_root = std::fs::canonicalize(&worktree_root).unwrap_or(worktree_root);
        let core_directory = Path::new(&response.base_directory);
        let core_directory =
            std::fs::canonicalize(core_directory).unwrap_or_else(|_| core_directory.to_path_buf());
        let root = normalize_windows_path(&worktree_root.to_string_lossy());
        let core = normalize_windows_path(&core_directory.to_string_lossy());
        if !core.starts_with(&(root + "\\")) {
            return Err(format!(
                "refusing Core outside this worktree: {:?}",
                response.base_directory
            ));
        }
    }
    Ok(())
}

async fn raw_core_identity() -> Result<GetCoreStatsResponse, String> {
    let payloads = raw_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/GetCoreStats",
        &[],
    )
    .await?;
    payloads
        .iter()
        .find_map(|payload| GetCoreStatsResponse::decode(&payload[..]).ok())
        .ok_or_else(|| "Dext Core returned no identity payload".into())
}

async fn verified_core_identity() -> Result<GetCoreStatsResponse, String> {
    let response = raw_core_identity().await?;
    verify_core_identity_response(&response)?;
    Ok(response)
}

async fn verified_call(method: &str, request: &[u8]) -> Result<Vec<Vec<u8>>, String> {
    verified_core_identity().await?;
    raw_call(method, request).await
}

enum ParseNext {
    Incomplete,
    Skip,
    Payload(Vec<u8>),
    Done(i32),
}

fn parse_next(buf: &mut Vec<u8>) -> Result<ParseNext, String> {
    // peek: don't consume anything unless the full message (+ payload) is available
    let msg_len = {
        let mut cursor = std::io::Cursor::new(&*buf);
        match prost::decode_length_delimiter(&mut cursor) {
            Ok(len) => len as usize,
            Err(_) => return Ok(ParseNext::Incomplete),
        }
    };
    let header_len = prost::length_delimiter_len(msg_len);
    let total = header_len + msg_len;
    if buf.len() < total {
        return Ok(ParseNext::Incomplete);
    }
    let msg = TransportMessage::decode(&buf[header_len..total])
        .map_err(|e| format!("bad transport message: {e}"))?;

    match msg.data {
        Some(Data::Headers(_)) | Some(Data::RequestInit(_)) | Some(Data::RequestControl(_)) => {
            buf.drain(0..total);
            Ok(ParseNext::Skip)
        }
        Some(Data::PayloadInfo(info)) => {
            let size = info.size as usize;
            if buf.len() < total + size {
                return Ok(ParseNext::Incomplete);
            }
            buf.drain(0..total);
            let payload: Vec<u8> = buf.drain(0..size).collect();
            Ok(ParseNext::Payload(payload))
        }
        Some(Data::Trailers(t)) => {
            buf.drain(0..total);
            Ok(ParseNext::Done(t.status_code))
        }
        None => Err("empty transport message".into()),
    }
}

#[derive(serde::Serialize)]
pub struct WallpaperInfo {
    pub path: String,
    pub category: i32,
    pub monitor: String,
    pub thumbnail: String,
}

#[derive(Clone, serde::Serialize)]
pub struct CoreIdentity {
    pub product_name: String,
    pub runtime_identity: String,
    pub process_id: i32,
    pub base_directory: String,
    pub app_data_directory: String,
    pub grpc_pipe_name: String,
    pub assembly_version: String,
    pub is_core_initialized: bool,
}

impl From<GetCoreStatsResponse> for CoreIdentity {
    fn from(response: GetCoreStatsResponse) -> Self {
        Self {
            product_name: response.product_name,
            runtime_identity: response.runtime_identity,
            process_id: response.process_id,
            base_directory: response.base_directory,
            app_data_directory: response.app_data_directory,
            grpc_pipe_name: response.grpc_pipe_name,
            assembly_version: response.assembly_version,
            is_core_initialized: response.is_core_initialized,
        }
    }
}

pub async fn get_wallpapers() -> Result<Vec<WallpaperInfo>, String> {
    let payloads = verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/GetWallpapers",
        &[],
    )
    .await?;
    let mut out = Vec::new();
    for p in payloads {
        if p.is_empty() {
            continue;
        }
        let item = GetWallpapersResponse::decode(&p[..]).map_err(|e| e.to_string())?;
        out.push(WallpaperInfo {
            path: item.lively_info_path.clone(),
            category: item.category,
            monitor: item.screen.map(|s| s.display_name).unwrap_or_default(),
            thumbnail: item.thumbnail_path,
        });
    }
    Ok(out)
}

pub async fn core_identity() -> Result<CoreIdentity, String> {
    verified_core_identity().await.map(Into::into)
}

pub async fn core_stats() -> Result<String, String> {
    let resp = verified_core_identity().await?;
    Ok(format!(
        "Dext Core v{} initialized={} pid={} ({})",
        resp.assembly_version, resp.is_core_initialized, resp.process_id, resp.base_directory
    ))
}

pub async fn set_wallpaper(folder: &str) -> Result<(), String> {
    // empty monitor_id -> core falls back to primary display
    let req = crate::proto::desktop::SetWallpaperRequest {
        lively_info_path: folder.to_string(),
        monitor_id: String::new(),
        ..Default::default()
    };
    verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/SetWallpaper",
        &req.encode_to_vec(),
    )
    .await
    .map(|_| ())
}

pub async fn close_all_wallpapers() -> Result<(), String> {
    let request = CloseAllWallpapersRequest::default();
    verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/CloseAllWallpapers",
        &request.encode_to_vec(),
    )
    .await
    .map(|_| ())
}

pub async fn get_settings() -> Result<SettingsDataModel, String> {
    let payloads = verified_call(
        "/Lively.Grpc.Common.Proto.Settings.SettingsService/GetSettings",
        &[],
    )
    .await?;
    payloads
        .first()
        .ok_or_else(|| "Dext Core returned no settings payload".to_string())
        .and_then(|payload| {
            SettingsDataModel::decode(&payload[..]).map_err(|error| error.to_string())
        })
}

pub async fn set_settings(settings: &SettingsDataModel) -> Result<(), String> {
    verified_call(
        "/Lively.Grpc.Common.Proto.Settings.SettingsService/SetSettings",
        &settings.encode_to_vec(),
    )
    .await
    .map(|_| ())
}

#[derive(serde::Serialize)]
pub struct AppInfoDto {
    pub name: String,
    pub target: String,
    pub arguments: String,
    pub working_dir: String,
    pub icon_png: String, // base64
    pub source: String,
}

pub async fn get_installed_apps() -> Result<Vec<AppInfoDto>, String> {
    use base64::Engine;
    let payloads = verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/GetInstalledApps",
        &[],
    )
    .await?;
    let mut out = Vec::new();
    for p in payloads {
        if p.is_empty() {
            continue;
        }
        let item = crate::proto::desktop::AppInfo::decode(&p[..]).map_err(|e| e.to_string())?;
        out.push(AppInfoDto {
            name: item.name,
            target: item.target,
            arguments: item.arguments,
            working_dir: item.working_dir,
            icon_png: base64::engine::general_purpose::STANDARD.encode(item.icon_png),
            source: item.source,
        });
    }
    Ok(out)
}

pub async fn launch_app(
    target: String,
    arguments: String,
    working_dir: String,
) -> Result<(), String> {
    let req = crate::proto::desktop::LaunchAppRequest {
        target,
        arguments,
        working_dir,
    };
    verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/LaunchApp",
        &req.encode_to_vec(),
    )
    .await
    .map(|_| ())
}

pub async fn resolve_app(path: String) -> Result<AppInfoDto, String> {
    use base64::Engine;
    let req = crate::proto::desktop::ResolveAppRequest { path };
    let payloads = verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/ResolveApp",
        &req.encode_to_vec(),
    )
    .await?;
    let item = payloads
        .first()
        .map(|p| crate::proto::desktop::AppInfo::decode(&p[..]))
        .ok_or("empty response")?
        .map_err(|e| e.to_string())?;
    if item.source == "unresolved" {
        return Err("无法解析该快捷方式".into());
    }
    Ok(AppInfoDto {
        name: item.name,
        target: item.target,
        arguments: item.arguments,
        working_dir: item.working_dir,
        icon_png: base64::engine::general_purpose::STANDARD.encode(item.icon_png),
        source: item.source,
    })
}

#[cfg(test)]
mod tests {
    use super::{grpc_pipe_server_name, runtime_identity, verify_core_identity_response};
    use crate::proto::desktop::GetCoreStatsResponse;

    fn valid_identity() -> GetCoreStatsResponse {
        let identity = runtime_identity();
        let app_data_directory = std::env::var("LOCALAPPDATA")
            .map(|root| {
                std::path::Path::new(&root)
                    .join(&identity.local_app_data_directory)
                    .to_string_lossy()
                    .into_owned()
            })
            .unwrap_or_else(|_| "C:\\Users\\test\\AppData\\Local\\Dext".into());
        let worktree_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let worktree_root = std::fs::canonicalize(&worktree_root).unwrap_or(worktree_root);
        GetCoreStatsResponse {
            base_directory: worktree_root
                .join("lively-core-separation/src/Lively/Lively/bin")
                .to_string_lossy()
                .into_owned(),
            assembly_version: "2.2.1.5".into(),
            is_core_initialized: true,
            product_name: identity.product_name.clone(),
            runtime_identity: identity.runtime_identity.clone(),
            process_id: 42,
            app_data_directory,
            grpc_pipe_name: grpc_pipe_server_name(),
        }
    }

    #[test]
    fn builds_pipe_name_from_shared_identity() {
        assert_eq!(runtime_identity().product_name, "Dext");
        assert_eq!(runtime_identity().runtime_identity, "DEXT:DESKTOPSHELL");
        assert_eq!(
            super::pipe_name(),
            format!(
                r"\\.\pipe\Grpc_DEXT:DESKTOPSHELL{}",
                std::env::var("USERNAME").unwrap_or_default()
            )
        );
    }

    #[test]
    fn accepts_matching_dext_core_identity() {
        verify_core_identity_response(&valid_identity()).unwrap();
    }

    #[test]
    fn rejects_wrong_product_and_runtime_identity() {
        let mut response = valid_identity();
        response.product_name = "Lively Wallpaper".into();
        assert!(verify_core_identity_response(&response)
            .unwrap_err()
            .contains("product"));

        let mut response = valid_identity();
        response.runtime_identity = "LIVELY:DESKTOPWALLPAPERSYSTEM".into();
        assert!(verify_core_identity_response(&response)
            .unwrap_err()
            .contains("runtime identity"));
    }

    #[cfg(debug_assertions)]
    #[test]
    fn rejects_core_outside_current_worktree_in_debug() {
        let mut response = valid_identity();
        response.base_directory = "C:\\Program Files\\Lively Wallpaper".into();
        assert!(verify_core_identity_response(&response)
            .unwrap_err()
            .contains("outside this worktree"));
    }

    #[tokio::test]
    #[ignore = "live test: changes the Windows desktop wallpaper and persisted restore layout"]
    async fn applies_room_wallpaper() {
        super::set_wallpaper(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../wallpapers/dext-room"
        ))
        .await
        .expect("set_wallpaper failed");
    }

    #[tokio::test]
    #[ignore = "live test: enumerates installed apps and launches Notepad"]
    async fn apps_and_launch() {
        let apps = super::get_installed_apps()
            .await
            .expect("get_installed_apps failed");
        println!("installed apps: {}", apps.len());
        assert!(!apps.is_empty(), "no apps enumerated");
        let obsidian = apps.iter().find(|a| a.target.contains("Obsidian"));
        if let Some(o) = obsidian {
            println!("obsidian: {} icon_bytes~{}", o.target, o.icon_png.len());
        }
        super::launch_app("notepad.exe".into(), String::new(), String::new())
            .await
            .expect("launch_app failed");
    }
}
