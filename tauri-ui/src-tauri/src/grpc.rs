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
    let msg_len = {
        let mut cursor = std::io::Cursor::new(&*buf);
        match prost::decode_length_delimiter(&mut cursor) {
            Ok(len) => len as usize,
            Err(_) => return Ok(ParseNext::Incomplete),
        }
    };
    if buf.len() < msg_len + prost::length_delimiter_len(msg_len) {
        return Ok(ParseNext::Incomplete);
    }
    let header_len = prost::length_delimiter_len(msg_len);
    let msg_bytes: Vec<u8> = buf.drain(0..header_len + msg_len).collect();
    let msg = TransportMessage::decode(&msg_bytes[header_len..])
        .map_err(|e| format!("bad transport message: {e}"))?;

    match msg.data {
        Some(Data::Headers(_)) | Some(Data::RequestInit(_)) | Some(Data::RequestControl(_)) => {
            Ok(ParseNext::Skip)
        }
        Some(Data::PayloadInfo(info)) => {
            let size = info.size as usize;
            if buf.len() < size {
                return Ok(ParseNext::Incomplete);
            }
            let payload: Vec<u8> = buf.drain(0..size).collect();
            Ok(ParseNext::Payload(payload))
        }
        Some(Data::Trailers(t)) => Ok(ParseNext::Done(t.status_code)),
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

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn connects_to_core() {
        let stats = super::core_stats().await.expect("stats rpc failed");
        println!("{stats}");
        let wallpapers = super::get_wallpapers().await.expect("wallpapers rpc failed");
        println!("wallpapers: {}", wallpapers.len());
        for w in &wallpapers {
            println!("  {} [{}] {}", w.monitor, w.category, w.path);
        }
    }
}
