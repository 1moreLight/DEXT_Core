//! Read-only draft resources for the isolated author workbench. No Core IPC.
use crate::room_v3;
use serde_json::{json, Value};
use std::{collections::{HashMap, HashSet}, io::{Read, Seek, SeekFrom}, path::{Path, PathBuf}, sync::{Mutex, atomic::{AtomicU64, Ordering}}};
use tauri::http::{Request, Response};
struct Session { root: PathBuf, resources: HashSet<String> }
#[derive(Default)]
pub struct PreviewResources(Mutex<HashMap<String, Session>>);
static NEXT: AtomicU64 = AtomicU64::new(1);
#[tauri::command]
pub async fn prepare_v3_workbench(room_dir: String, room_json: String, state: tauri::State<'_, PreviewResources>) -> Result<Value,String> {
    let document=room_v3::parse_document(room_json.as_bytes())?;
    let manifest=room_v3::validate_manifest(&document)?;
    let root=std::fs::canonicalize(Path::new(&room_dir)).map_err(|e|format!("open preview source: {e}"))?;
    // Ensure this is a real Room source, not a caller-selected arbitrary directory.
    let saved=room_v3::read_document(&root)?;
    if saved["id"]!=document["id"] || saved["version"]!=3 {return Err("预览源与Room副本不一致".into());}
    let mut missing=Vec::new();
    for resource in &manifest.resource_paths {
        if let Err(error)=room_v3::open_resource(&root,resource) {missing.push(json!({"path":resource,"message":error}));}
    }
    let seed=format!("{}:{}:{}:{}", std::process::id(), NEXT.fetch_add(1,Ordering::Relaxed),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos(), room_json);
    let token=super::room_fingerprint(seed.as_bytes());
    let mut sessions=state.0.lock().map_err(|_|"preview resource state unavailable")?;
    if sessions.len()>=4 {return Err("请先关闭其他试验台".into());}
    sessions.insert(token.clone(),Session{root,resources:manifest.resource_paths.into_iter().collect()});
    Ok(json!({"token":token,"baseUrl":format!("http://v3preview.localhost/{token}/"),"missing":missing}))
}
#[tauri::command]
pub fn release_v3_workbench(token: String, state: tauri::State<'_, PreviewResources>) -> Result<(),String> {
    state.0.lock().map_err(|_|"preview resource state unavailable")?.remove(&token); Ok(())
}
fn failed(status:u16)->Response<Vec<u8>> {Response::builder().status(status).header("Access-Control-Allow-Origin","*").body(Vec::new()).unwrap()}
fn range(value:&str,total:u64)->Option<(u64,u64)> {
    let pair=value.strip_prefix("bytes=")?.split_once('-')?;
    if total==0 || pair.1.contains(',') {return None;}
    if pair.0.is_empty() {
        let count=pair.1.parse::<u64>().ok()?;
        return (count>0).then_some((total.saturating_sub(count),total-1));
    }
    let start=pair.0.parse::<u64>().ok()?;
    let end=if pair.1.is_empty(){total-1}else{pair.1.parse::<u64>().ok()?.min(total-1)};
    (start<=end&&start<total).then_some((start,end))
}
pub fn serve(request:&Request<Vec<u8>>,state:&PreviewResources)->Response<Vec<u8>> {
    if request.method()!="GET"&&request.method()!="HEAD" {return failed(405);}
    let decoded=match percent_encoding::percent_decode_str(request.uri().path().trim_start_matches('/')).decode_utf8(){Ok(v)=>v,Err(_)=>return failed(400)};
    let Some((token,path))=decoded.split_once('/') else{return failed(404)};
    let (root,declared)=match state.0.lock(){
        Ok(sessions)=>match sessions.get(token){Some(session)=>(session.root.clone(),session.resources.contains(path)),None=>return failed(410)},
        Err(_)=>return failed(503)
    };
    if !declared {return failed(404);}
    let mut file=match room_v3::open_resource(&root,path){Ok(v)=>v,Err(_)=>return failed(404)};
    let total=match file.length(){Ok(v)=>v,Err(_)=>return failed(500)};
    let partial=request.headers().get("Range");
    let (start,end)=if let Some(header)=partial {
        match header.to_str().ok().and_then(|value|range(value,total)){Some(v)=>v,None=>return failed(416)}
    }else{(0,total.saturating_sub(1))};
    let length=if total==0 {0}else{end-start+1};
    let mut bytes=Vec::new();
    if request.method()=="GET" {
        if file.seek(SeekFrom::Start(start)).is_err() || file.take(length).read_to_end(&mut bytes).is_err(){return failed(500);}
        if bytes.len() as u64!=length{return failed(500);}
    }
    let mut response=Response::builder().status(if partial.is_some(){206}else{200})
        .header("Content-Type",super::mime_of(Path::new(path))).header("Content-Length",length.to_string())
        .header("Access-Control-Allow-Origin","*").header("Access-Control-Expose-Headers","Content-Range").header("Accept-Ranges","bytes").header("Cache-Control","no-store")
        .header("Content-Security-Policy","default-src 'none'; script-src 'unsafe-inline' http://v3preview.localhost; style-src 'unsafe-inline' http://v3preview.localhost; img-src data: http://v3preview.localhost; media-src http://v3preview.localhost; font-src http://v3preview.localhost; connect-src 'none'; frame-src http://v3preview.localhost; base-uri 'none'; form-action 'none'");
    if partial.is_some(){response=response.header("Content-Range",format!("bytes {start}-{end}/{total}"));}
    response.body(bytes).unwrap()
}
