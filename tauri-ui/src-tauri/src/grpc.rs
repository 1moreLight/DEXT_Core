use http::Uri;
use hyper::rt::Read;
use hyper::rt::ReadBufCursor;
use hyper::rt::Write;
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};
use tonic::transport::{Channel, Endpoint};
use tower::Service;

use crate::proto::desktop::desktop_service_client::DesktopServiceClient;
use crate::proto::desktop::GetWallpapersResponse;

pub fn pipe_name() -> String {
    let user = std::env::var("USERNAME").unwrap_or_default();
    format!(r"\\.\pipe\Grpc_LIVELY:DESKTOPWALLPAPERSYSTEM{}", user)
}

pub struct PipeClient(NamedPipeClient);

impl Read for PipeClient {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        mut buf: ReadBufCursor<'_>,
    ) -> Poll<std::io::Result<()>> {
        // adapter pattern from hyper docs: tokio ReadBuf over hyper's uninit cursor
        let n = unsafe {
            let mut tbuf = tokio::io::ReadBuf::uninit(buf.as_mut());
            match Pin::new(&mut self.0).poll_read(cx, &mut tbuf)? {
                Poll::Ready(()) => tbuf.filled().len(),
                Poll::Pending => return Poll::Pending,
            }
        };
        // safety: n bytes were initialized by tokio ReadBuf
        unsafe { buf.advance(n) };
        Poll::Ready(Ok(()))
    }
}

impl Write for PipeClient {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        Pin::new(&mut self.0).poll_write(cx, buf)
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.0).poll_flush(cx)
    }

    fn poll_shutdown(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.0).poll_shutdown(cx)
    }
}

#[derive(Clone)]
pub struct PipeConnector;

impl Service<Uri> for PipeConnector {
    type Response = PipeClient;
    type Error = std::io::Error;
    type Future =
        Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send + 'static>>;

    fn poll_ready(&mut self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, _req: Uri) -> Self::Future {
        let pipe = pipe_name();
        Box::pin(async move {
            let client = ClientOptions::new().open(pipe)?;
            Ok(PipeClient(client))
        })
    }
}

type DesktopClient = DesktopServiceClient<Channel>;

pub async fn connect() -> Result<DesktopClient, String> {
    let endpoint = Endpoint::from_shared("http://lively.core".to_string()).unwrap();
    let channel = endpoint
        .connect_with_connector(PipeConnector)
        .await
        .map_err(|e| format!("pipe connect failed (is Lively core running?): {e}"))?;
    Ok(DesktopServiceClient::new(channel))
}

#[derive(serde::Serialize)]
pub struct WallpaperInfo {
    pub path: String,
    pub category: i32,
    pub monitor: String,
    pub thumbnail: String,
}

pub async fn get_wallpapers() -> Result<Vec<WallpaperInfo>, String> {
    let mut client = connect().await?;
    let mut stream = client
        .get_wallpapers(())
        .await
        .map_err(|e| e.to_string())?
        .into_inner();

    let mut out = Vec::new();
    while let Some(item) = stream.message().await.map_err(|e| e.to_string())? {
        let GetWallpapersResponse {
            lively_info_path,
            category,
            screen,
            thumbnail_path,
            ..
        } = item;
        out.push(WallpaperInfo {
            path: lively_info_path,
            category,
            monitor: screen.map(|s| s.display_name).unwrap_or_default(),
            thumbnail: thumbnail_path,
        });
    }
    Ok(out)
}

pub async fn core_stats() -> Result<String, String> {
    let mut client = connect().await?;
    let resp = client
        .get_core_stats(())
        .await
        .map_err(|e| e.to_string())?
        .into_inner();
    Ok(format!(
        "core v{} initialized={} ({})",
        resp.assembly_version, resp.is_core_initialized, resp.base_directory
    ))
}
