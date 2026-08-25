use prost::Message;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::windows::named_pipe::ClientOptions;

use crate::proto::desktop::{GetCoreStatsResponse, GetWallpapersResponse};
use crate::proto::grpc_dotnet_named_pipes::generated::{
    transport_message::Data, Headers, PayloadInfo, RequestInit, RequestControl, TransportMessage,
};

pub fn pipe_name() -> String {
    let user = std::env::var("USERNAME").unwrap_or_default();
    format!(r"\\.\pipe\Grpc_LIVELY:DESKTOPWALLPAPERSYSTEM{}", user)
}

// ponytail: one pipe connection per call, same as the C# NamedPipeChannel does
async fn call(method: &str, request: &[u8]) -> Result<Vec<Vec<u8>>, String> {
    let mut pipe = ClientOptions::new()
        .open(pipe_name())
        .map_err(|e| format!("pipe connect failed (is Lively core running?): {e}"))?;

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

pub async fn get_wallpapers() -> Result<Vec<WallpaperInfo>, String> {
    let payloads = call(
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

pub async fn core_stats() -> Result<String, String> {
    let payloads = call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/GetCoreStats",
        &[],
    )
    .await?;
    let resp = payloads
        .iter()
        .find_map(|p| GetCoreStatsResponse::decode(&p[..]).ok())
        .ok_or("no response payload")?;
    Ok(format!(
        "core v{} initialized={} ({})",
        resp.assembly_version, resp.is_core_initialized, resp.base_directory
    ))
}

pub async fn set_wallpaper(folder: &str) -> Result<(), String> {
    // empty monitor_id -> core falls back to primary display
    let req = crate::proto::desktop::SetWallpaperRequest {
        lively_info_path: folder.to_string(),
        monitor_id: String::new(),
        ..Default::default()
    };
    call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/SetWallpaper",
        &req.encode_to_vec(),
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
    let payloads = call(
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

pub async fn launch_app(target: String, arguments: String, working_dir: String) -> Result<(), String> {
    let req = crate::proto::desktop::LaunchAppRequest {
        target,
        arguments,
        working_dir,
    };
    call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/LaunchApp",
        &req.encode_to_vec(),
    )
    .await
    .map(|_| ())
}

pub async fn resolve_app(path: String) -> Result<AppInfoDto, String> {
    use base64::Engine;
    let req = crate::proto::desktop::ResolveAppRequest { path };
    let payloads = call(
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
    #[tokio::test]
    async fn applies_room_wallpaper() {
        super::set_wallpaper(r"D:\midDOW\lively-core-separation\wallpapers\dext-room")
            .await
            .expect("set_wallpaper failed");
    }

    #[tokio::test]
    async fn apps_and_launch() {
        let apps = super::get_installed_apps().await.expect("get_installed_apps failed");
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
