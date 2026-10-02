use prost::Message;
use serde::Deserialize;
use std::path::Path;
use std::sync::OnceLock;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::windows::named_pipe::ClientOptions;

use crate::proto::desktop::{
    CloseAllWallpapersRequest, GetCoreStatsResponse, GetWallpapersResponse, RoomSessionStatusResponse,
    SetSystemVolumeRequest,
    SystemMediaAction, SystemMediaControlRequest, SystemMediaControlResponse, SystemMediaSnapshot,
    SystemVolumeSnapshot, WallpaperMessageRequest,
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

pub(crate) fn runtime_identity_name() -> &'static str {
    &runtime_identity().runtime_identity
}

pub fn local_app_data_path() -> std::path::PathBuf {
    std::env::var("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir())
        .join(&runtime_identity().local_app_data_directory)
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

pub(crate) fn pipe_is_absent() -> Result<bool, String> {
    match ClientOptions::new().open(pipe_name()) {
        Ok(pipe) => {
            drop(pipe);
            Ok(false)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(true),
        Err(error) => Err(format!("cannot inspect Dext Core pipe: {error}")),
    }
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

pub(crate) fn verify_core_identity_response(response: &GetCoreStatsResponse) -> Result<(), String> {
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

pub(crate) async fn raw_core_identity() -> Result<GetCoreStatsResponse, String> {
    let payloads = tokio::time::timeout(
        std::time::Duration::from_secs(3),
        raw_call(
            "/Lively.Grpc.Common.Proto.Desktop.DesktopService/GetCoreStats",
            &[],
        ),
    )
    .await
    .map_err(|_| "Dext Core identity request timed out".to_string())??;
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
    tokio::time::timeout(
        std::time::Duration::from_secs(10),
        raw_call(method, request),
    )
    .await
    .map_err(|_| format!("Dext Core RPC timed out: {method}"))?
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

#[derive(Clone, serde::Serialize)]
pub struct RoomLifecycleStatus {
    pub stage: String,
    pub playback_paused: bool,
    pub locked: bool,
    pub revision: i64,
}

#[derive(Clone, serde::Serialize)]
pub struct RoomSessionStatus {
    pub active: bool,
    pub protocol_version: i32,
    pub room_id: String,
    pub session_id: String,
    pub revision: i64,
    pub current_desk_id: String,
    pub target_desk_id: String,
    pub queued_desk_id: String,
    pub transition_id: String,
    pub operable: bool,
    pub player_pid: i32,
    pub deadline_utc: String,
    pub installation_stamp: String,
    pub lifecycle: Option<RoomLifecycleStatus>,
}

pub async fn room_session_status() -> Result<RoomSessionStatus, String> {
    let payloads = verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/GetRoomSession",
        &[],
    )
    .await?;
    let response = payloads
        .iter()
        .find_map(|payload| RoomSessionStatusResponse::decode(&payload[..]).ok())
        .ok_or_else(|| "Dext Core returned no v3 session status".to_string())?;
    Ok(RoomSessionStatus {
        active: response.active,
        protocol_version: response.protocol_version,
        room_id: response.room_id,
        session_id: response.session_id,
        revision: response.revision,
        current_desk_id: response.current_desk_id,
        target_desk_id: response.target_desk_id,
        queued_desk_id: response.queued_desk_id,
        transition_id: response.transition_id,
        operable: response.operable,
        player_pid: response.player_pid,
        deadline_utc: response.deadline_utc,
        installation_stamp: response.installation_stamp,
        lifecycle: response.lifecycle.map(|value| RoomLifecycleStatus {
            stage: value.stage,
            playback_paused: value.playback_paused,
            locked: value.locked,
            revision: value.revision,
        }),
    })
}

pub(crate) async fn shutdown_core() -> Result<(), String> {
    raw_call(
        "/Lively.Grpc.Common.Proto.Commands.CommandsService/ShutDown",
        &[],
    )
    .await
    .map(|_| ())
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

pub async fn send_message_wallpaper(lively_info_path: &str, msg: &str) -> Result<(), String> {
    let request = WallpaperMessageRequest {
        monitor_id: String::new(),
        lively_info_path: lively_info_path.to_string(),
        msg: msg.to_string(),
    };
    verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/SendMessageWallpaper",
        &request.encode_to_vec(),
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

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemMediaDto {
    pub has_session: bool,
    pub source_app_id: String,
    pub title: String,
    pub artist: String,
    pub album_title: String,
    pub album_artist: String,
    pub thumbnail_base64: String,
    pub thumbnail_content_type: String,
    pub playback_status: String,
    pub position_ms: i64,
    pub duration_ms: i64,
    pub can_play: bool,
    pub can_pause: bool,
    pub can_toggle_play_pause: bool,
    pub can_next: bool,
    pub can_previous: bool,
}

impl From<SystemMediaSnapshot> for SystemMediaDto {
    fn from(snapshot: SystemMediaSnapshot) -> Self {
        use base64::Engine;
        Self {
            has_session: snapshot.has_session,
            source_app_id: snapshot.source_app_id,
            title: snapshot.title,
            artist: snapshot.artist,
            album_title: snapshot.album_title,
            album_artist: snapshot.album_artist,
            thumbnail_base64: base64::engine::general_purpose::STANDARD.encode(snapshot.thumbnail),
            thumbnail_content_type: snapshot.thumbnail_content_type,
            playback_status: snapshot.playback_status,
            position_ms: snapshot.position_ms,
            duration_ms: snapshot.duration_ms,
            can_play: snapshot.can_play,
            can_pause: snapshot.can_pause,
            can_toggle_play_pause: snapshot.can_toggle_play_pause,
            can_next: snapshot.can_next,
            can_previous: snapshot.can_previous,
        }
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemVolumeDto {
    pub level: f64,
    pub muted: bool,
    pub device_id: String,
    pub device_name: String,
}

impl From<SystemVolumeSnapshot> for SystemVolumeDto {
    fn from(snapshot: SystemVolumeSnapshot) -> Self {
        Self {
            level: snapshot.level,
            muted: snapshot.muted,
            device_id: snapshot.device_id,
            device_name: snapshot.device_name,
        }
    }
}

fn system_media_action(value: &str) -> Result<SystemMediaAction, String> {
    match value {
        "play" => Ok(SystemMediaAction::Play),
        "pause" => Ok(SystemMediaAction::Pause),
        "toggle-play-pause" => Ok(SystemMediaAction::TogglePlayPause),
        "next" => Ok(SystemMediaAction::Next),
        "previous" => Ok(SystemMediaAction::Previous),
        _ => Err(format!("unsupported system media action {value:?}")),
    }
}

pub async fn get_system_media() -> Result<SystemMediaDto, String> {
    let payloads = verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/GetSystemMedia",
        &[],
    )
    .await?;
    payloads
        .first()
        .ok_or_else(|| "Dext Core returned no system media payload".to_string())
        .and_then(|payload| {
            SystemMediaSnapshot::decode(&payload[..])
                .map(Into::into)
                .map_err(|error| error.to_string())
        })
}

pub async fn control_system_media(action: &str) -> Result<(), String> {
    let request = SystemMediaControlRequest {
        action: system_media_action(action)? as i32,
    };
    let payloads = verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/ControlSystemMedia",
        &request.encode_to_vec(),
    )
    .await?;
    let response = payloads
        .first()
        .ok_or_else(|| "Dext Core returned no media control payload".to_string())
        .and_then(|payload| {
            SystemMediaControlResponse::decode(&payload[..]).map_err(|error| error.to_string())
        })?;
    if response.accepted {
        Ok(())
    } else {
        Err("Windows has no controllable current media session".into())
    }
}

pub async fn get_system_volume() -> Result<SystemVolumeDto, String> {
    let payloads = verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/GetSystemVolume",
        &[],
    )
    .await?;
    payloads
        .first()
        .ok_or_else(|| "Dext Core returned no system volume payload".to_string())
        .and_then(|payload| {
            SystemVolumeSnapshot::decode(&payload[..])
                .map(Into::into)
                .map_err(|error| error.to_string())
        })
}

fn validate_system_volume_patch(level: Option<f64>, muted: Option<bool>) -> Result<(), String> {
    if level.is_some_and(|value| !value.is_finite() || !(0.0..=1.0).contains(&value)) {
        return Err("system volume must be a finite number between 0.0 and 1.0".into());
    }
    if level.is_none() && muted.is_none() {
        return Err("at least one system volume field must be provided".into());
    }
    Ok(())
}

pub async fn set_system_volume(
    level: Option<f64>,
    muted: Option<bool>,
) -> Result<SystemVolumeDto, String> {
    validate_system_volume_patch(level, muted)?;
    let request = SetSystemVolumeRequest {
        level: level.unwrap_or_default(),
        set_level: level.is_some(),
        muted: muted.unwrap_or_default(),
        set_muted: muted.is_some(),
    };
    let payloads = verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/SetSystemVolume",
        &request.encode_to_vec(),
    )
    .await?;
    payloads
        .first()
        .ok_or_else(|| "Dext Core returned no system volume payload".to_string())
        .and_then(|payload| {
            SystemVolumeSnapshot::decode(&payload[..])
                .map(Into::into)
                .map_err(|error| error.to_string())
        })
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
    use super::{
        grpc_pipe_server_name, runtime_identity, system_media_action, validate_system_volume_patch,
        verify_core_identity_response,
    };
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
    fn system_controls_reject_open_ended_actions_and_invalid_volume() {
        assert!(system_media_action("play").is_ok());
        assert!(system_media_action("next").is_ok());
        assert!(system_media_action("shell:calc.exe").is_err());
        assert!(validate_system_volume_patch(Some(0.5), None).is_ok());
        assert!(validate_system_volume_patch(None, Some(true)).is_ok());
        assert!(validate_system_volume_patch(None, None).is_err());
        assert!(validate_system_volume_patch(Some(-0.01), None).is_err());
        assert!(validate_system_volume_patch(Some(1.01), None).is_err());
        assert!(validate_system_volume_patch(Some(f64::NAN), None).is_err());
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

    #[tokio::test]
    #[ignore = "live test: reads system media and briefly changes then restores Windows master volume"]
    async fn system_media_and_volume_against_current_core() {
        let original = super::get_system_volume()
            .await
            .expect("get_system_volume failed");
        println!(
            "volume: level={} muted={} device={:?}",
            original.level, original.muted, original.device_name
        );
        let probe = if original.level >= 0.01 {
            original.level - 0.01
        } else {
            original.level + 0.01
        };
        let changed = super::set_system_volume(Some(probe), Some(original.muted))
            .await
            .expect("set_system_volume probe failed");
        assert!((changed.level - probe).abs() < 0.01);
        let restored = super::set_system_volume(Some(original.level), Some(original.muted))
            .await
            .expect("restore system volume failed");
        assert!((restored.level - original.level).abs() < 0.01);
        assert_eq!(restored.muted, original.muted);

        let media = super::get_system_media()
            .await
            .expect("get_system_media failed");
        println!(
            "media: has_session={} source={:?} title={:?} artist={:?} status={:?} artwork_bytes={}",
            media.has_session,
            media.source_app_id,
            media.title,
            media.artist,
            media.playback_status,
            media.thumbnail_base64.len()
        );
        let probe = match media.playback_status.as_str() {
            "playing" => Some(("pause", "play")),
            "paused" => Some(("play", "pause")),
            _ => None,
        };
        if let Some((probe_action, restore_action)) = probe {
            super::control_system_media(probe_action)
                .await
                .expect("system media probe action failed");
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            super::control_system_media(restore_action)
                .await
                .expect("restore system media state failed");
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            let restored_media = super::get_system_media()
                .await
                .expect("read restored system media state failed");
            assert_eq!(restored_media.playback_status, media.playback_status);
        }
    }
}
