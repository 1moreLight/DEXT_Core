// Host-owned installation maintenance. Never recursively delete a pathname.
use super::*;
use std::collections::HashMap;

const MAX_CANDIDATES: usize = 32;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryCandidate {
    pub name: String,
    pub kind: String,
    pub room_id: Option<String>,
    pub manifest_sha256: Option<String>,
    pub resource_bytes: u64,
    pub metadata_ready: bool,
    pub recorded: bool,
    pub problem: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryReport {
    pub current_present: bool,
    pub current_problem: Option<String>,
    pub candidates: Vec<RecoveryCandidate>,
    pub truncated: bool,
    pub next_offset: Option<usize>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Ownership {
    format_version: u32,
    directory: String,
    identity: String,
    snapshot: Installation,
    installation_sha256: String,
}
fn kind(name: &str) -> Option<&'static str> {
    for (prefix, kind) in [(".dext-previous-", "previous"), (".dext-install-", "staging"), (".dext-quarantine-", "quarantine")] {
        if let Some(suffix) = name.strip_prefix(prefix) {
            let parts: Vec<_> = suffix.split('-').collect();
            if parts.len() == 3 && parts.iter().all(|v| !v.is_empty() && v.bytes().all(|b| b.is_ascii_digit())) { return Some(kind); }
        }
    }
    None
}
fn suffix() -> Result<String, String> {
    Ok(format!("{}-{}-{}", std::process::id(), std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos(),
        TEMP_SEQUENCE.fetch_add(1,std::sync::atomic::Ordering::Relaxed)))
}
#[cfg(windows)]
fn file_identity(file: &File) -> Result<String, String> {
    use std::os::windows::io::AsRawHandle;
    #[repr(C)] struct Identity { volume: u64, id: [u8;16] }
    #[link(name="kernel32")]
    unsafe extern "system" { fn GetFileInformationByHandleEx(handle:*mut std::ffi::c_void,class:u32,data:*mut std::ffi::c_void,size:u32)->i32; }
    let mut value=Identity{volume:0,id:[0;16]};
    require(unsafe{GetFileInformationByHandleEx(file.as_raw_handle(),18,(&mut value as *mut Identity).cast(),std::mem::size_of::<Identity>() as u32)}!=0,
        format!("read retained directory identity: {}",std::io::Error::last_os_error()))?;
    Ok(format!("{:016x}-{}",value.volume,value.id.iter().map(|b|format!("{b:02x}")).collect::<String>()))
}
#[cfg(not(windows))]
fn file_identity(_: &File) -> Result<String,String> { Err("installation maintenance requires Windows".into()) }
fn owner_name(name:&str)->String {format!("{name}.owner.json")}
fn read_owner(parent:&Path,name:&str)->Result<Ownership,String> {
    require(kind(name).is_some(),"unrecognized recovery directory")?;
    let value:Ownership=serde_json::from_slice(&bounded_bytes_under(parent,&owner_name(name),MAX_SNAPSHOT_BYTES,None)?)
        .map_err(|e|format!("read recovery ownership: {e}"))?;
    require(value.format_version==1 && value.directory==name && value.snapshot.format_version==1,"recovery ownership identity")?;
    for resource in &value.snapshot.resources {validate_resource_path(&resource.path)?;}
    Ok(value)
}
pub(super) fn record_stage(parent:&Path,name:&str,handle:&File,snapshot:&Installation)->Result<(),String> {
    let document=serde_json::to_vec_pretty(snapshot).map_err(|e|e.to_string())?;
    let owner=Ownership{format_version:1,directory:name.into(),identity:file_identity(handle)?,
        snapshot:snapshot.clone(),installation_sha256:format!("{:x}",Sha256::digest(&document))};
    write_owner(parent,&owner)
}
fn write_owner(parent:&Path,owner:&Ownership)->Result<(),String> {
    let bytes=serde_json::to_vec_pretty(owner).map_err(|e|e.to_string())?;
    require(bytes.len()<=MAX_SNAPSHOT_BYTES,"recovery ownership too large")?;
    let (mut file,_guards)=create_checked(parent,&owner_name(&owner.directory))?;
    file.write_all(&bytes).and_then(|_|file.sync_all()).map_err(|e|io_error("record recovery ownership",e))
}
fn snapshot_header(root:&Path)->Result<Installation,String> {
    let value:Installation=serde_json::from_slice(&bounded_bytes_under(root,"installation.json",MAX_SNAPSHOT_BYTES,None)?)
        .map_err(|e|format!("read retained snapshot: {e}"))?;
    require(value.format_version==1 && value.resources.len()<=MAX_RESOURCES,"retained snapshot version/size")?;
    let document=read_document(root)?;
    let manifest=validate_manifest(&document)?;
    require(manifest.room_id==value.room_id,"retained Room identity")?;
    Ok(value)
}
pub fn inspect_recovery(host:&Path,offset:usize)->Result<RecoveryReport,String> {
    let parent=root_directory(host)?;let _guard=lock_directory(&parent)?;
    let mut names=Vec::new();let mut entries=0;
    for item in fs::read_dir(&parent).map_err(|e|io_error("scan recovery directories",e))? {
        entries+=1;require(entries<=1024,"host directory inventory exceeds maintenance limit")?;
        let item=item.map_err(|e|e.to_string())?;let name=item.file_name().to_string_lossy().into_owned();
        if kind(&name).is_some() {names.push(name);}
        else if let Some(directory)=name.strip_suffix(".owner.json") {
            if kind(directory).is_some() && !parent.join(directory).exists() {names.push(directory.into());}
        }
    }
    names.sort();names.dedup();
    require(offset<=1024,"recovery page offset exceeds inventory limit")?;
    let end=(offset+MAX_CANDIDATES).min(names.len());
    let truncated=end<names.len();let next_offset=if truncated{Some(end)}else{None};
    let names:Vec<_>=names.into_iter().skip(offset).take(MAX_CANDIDATES).collect();
    let mut candidates=Vec::new();
    for name in names {
        let path=parent.join(&name);let header=root_directory(&path).and_then(|root|snapshot_header(&root));
        let record=read_owner(&parent,&name);
        let (snapshot,metadata_ready,problem)=match header {
            Ok(snapshot)=>(Some(snapshot),true,None),
            Err(error)=>(record.as_ref().ok().map(|o|o.snapshot.clone()),false,Some(error)),
        };
        candidates.push(RecoveryCandidate{name:name.clone(),kind:if path.exists(){kind(&name).unwrap().into()}else{"orphanRecord".into()},
            room_id:snapshot.as_ref().map(|s|s.room_id.clone()),manifest_sha256:snapshot.as_ref().map(|s|s.manifest_sha256.clone()),
            resource_bytes:snapshot.as_ref().map(|s|s.resources.iter().map(|r|r.size).sum()).unwrap_or(0),
            metadata_ready,recorded:record.is_ok(),problem});
    }
    let current=parent.join("content");let current_present=current.exists();
    let current_problem=if current_present{root_directory(&current).and_then(|root|snapshot_header(&root)).err()}else{None};
    Ok(RecoveryReport{current_present,current_problem,candidates,truncated,next_offset})
}
pub fn restore_retained(host:&Path,name:&str,manifest_sha256:&str)->Result<Installation,String> {
    let _lock=INSTALL_LOCK.lock().map_err(|_|"installation lock poisoned")?;
    require(kind(name).is_some(),"unrecognized recovery directory")?;
    let parent=root_directory(host)?;let _guard=lock_directory(&parent)?;
    let source=root_directory(&parent.join(name))?;let retained=lock_directory_access(&source,true)?;
    let snapshot=verify_installation_under(&source,Some(&retained))?;
    require(snapshot.manifest_sha256==manifest_sha256,"retained installation changed; refresh maintenance list")?;
    let current=parent.join("content");
    let previous=if current.exists() {Some(lock_directory_access(&root_directory(&current)?,true)?)}else{None};
    let quarantine=parent.join(format!(".dext-quarantine-{}",suffix()?));
    if let Some(handle)=&previous {rename_directory(handle,&current,&quarantine)?;}
    if let Err(error)=rename_directory(&retained,&source,&current) {
        if let Some(handle)=&previous {
            rename_directory(handle,&quarantine,&current).map_err(|rollback|format!("restore failed ({error}); rollback failed ({rollback}); original retained"))?;
        }
        return Err(error);
    }
    // Current corrupt bytes are retained, and no authored/private Room data is touched.
    Ok(snapshot)
}
#[cfg(windows)]
fn delete_handle(file:&File)->Result<(),String> {
    use std::os::windows::io::AsRawHandle;
    #[link(name="kernel32")]
    unsafe extern "system" {fn SetFileInformationByHandle(handle:*mut std::ffi::c_void,class:u32,data:*mut std::ffi::c_void,size:u32)->i32;}
    let mut delete:u8=1;
    require(unsafe{SetFileInformationByHandle(file.as_raw_handle(),4,(&mut delete as *mut u8).cast(),1)}!=0,
        format!("delete authenticated handle: {}",std::io::Error::last_os_error()))
}
#[cfg(not(windows))]
fn delete_handle(_: &File)->Result<(),String>{Err("installation cleanup requires Windows".into())}
fn open_delete_file(root:&Path,path:&Path)->Result<File,String> {
    let mut options=fs::OpenOptions::new();options.read(true);
    #[cfg(windows)] {use std::os::windows::fs::OpenOptionsExt;options.access_mode(0x80010000).share_mode(1).custom_flags(0x00200000);}
    let file=options.open(path).map_err(|e|io_error("open retained cleanup file",e))?;
    require(file.metadata().map_err(|e|e.to_string())?.is_file(),"cleanup object is not a file")?;
    #[cfg(windows)] {
        use std::os::windows::fs::MetadataExt;
        require(file.metadata().map_err(|e|e.to_string())?.file_attributes()&0x400==0 && handle_path(&file)?.starts_with(root),"cleanup file redirected")?;
    }
    Ok(file)
}
fn collect_tree(root:&Path,depth:usize,dirs:&mut Vec<(PathBuf,File)>,files:&mut Vec<PathBuf>,count:&mut usize)->Result<(),String> {
    require(depth<=32,"cleanup nesting limit")?;
    for item in fs::read_dir(root).map_err(|e|io_error("enumerate cleanup directory",e))? {
        *count+=1;require(*count<=MAX_RESOURCES*4,"cleanup inventory limit")?;
        let path=item.map_err(|e|e.to_string())?.path();let meta=reject_link(&path)?;
        if meta.is_dir() {
            let handle=lock_directory_access(&path,true)?;
            collect_tree(&path,depth+1,dirs,files,count)?;
            dirs.push((path,handle)); // deepest first, ancestors stay retained until children are gone
        }else{require(meta.is_file(),"non-file cleanup object")?;files.push(path);}
    }
    Ok(())
}
pub fn cleanup_retained(host:&Path,name:&str,manifest_sha256:&str)->Result<u64,String> {
    let _lock=INSTALL_LOCK.lock().map_err(|_|"installation lock poisoned")?;
    require(kind(name).is_some(),"unrecognized recovery directory")?;
    let parent=root_directory(host)?;let _parent_guard=lock_directory(&parent)?;
    if !parent.join(name).exists() {
        let mut file=open_delete_file(&parent,&parent.join(owner_name(name)))?;
        let mut bytes=Vec::new();
        Read::by_ref(&mut file).take(MAX_SNAPSHOT_BYTES as u64+1).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
        require(bytes.len()<=MAX_SNAPSHOT_BYTES,"orphan ownership record size")?;
        let owner:Ownership=serde_json::from_slice(&bytes).map_err(|e|e.to_string())?;
        require(owner.format_version==1 && owner.directory==name && owner.snapshot.manifest_sha256==manifest_sha256,"orphan record changed; refresh list")?;
        require(!parent.join(name).exists(),"recovery directory reappeared; refresh list")?;
        delete_handle(&file)?;drop(file);return Ok(0);
    }
    let root=root_directory(&parent.join(name))?;let root_handle=lock_directory_access(&root,true)?;
    let identity=file_identity(&root_handle)?;
    let owner=match read_owner(&parent,name) {
        Ok(owner)=>{require(owner.identity==identity,"recovery directory identity changed")?;owner}
        Err(_)=>{
            let snapshot=verify_installation_under(&root,Some(&root_handle))?;
            let bytes=bounded_bytes_under(&root,"installation.json",MAX_SNAPSHOT_BYTES,Some(&root_handle))?;
            let owner=Ownership{format_version:1,directory:name.into(),identity,snapshot,installation_sha256:format!("{:x}",Sha256::digest(bytes))};
            write_owner(&parent,&owner)?;owner
        }
    };
    require(owner.snapshot.manifest_sha256==manifest_sha256,"retained identity changed; refresh maintenance list")?;
    let mut expected:HashMap<String,String>=owner.snapshot.resources.iter().map(|r|(r.path.clone(),r.sha256.clone())).collect();
    expected.insert("room.json".into(),owner.snapshot.manifest_sha256.clone());
    expected.insert("installation.json".into(),owner.installation_sha256.clone());
    let mut directories=Vec::new();let mut files=Vec::new();
    collect_tree(&root,0,&mut directories,&mut files,&mut 0)?;
    require(files.len()<=expected.len(),"unexpected cleanup files; original retained")?;
    let mut opened=Vec::new();let mut freed=0;
    for path in files {
        let relative=path.strip_prefix(&root).map_err(|_|"cleanup escaped root")?.to_str().ok_or("cleanup name not UTF8")?.replace('\\',"/");
        let hash=expected.get(&relative).ok_or("unexpected cleanup file; original retained")?;
        let mut file=open_delete_file(&root,&path)?;let mut digest=Sha256::new();let mut buffer=[0u8;65536];let mut size=0;
        loop {let count=file.read(&mut buffer).map_err(|e|e.to_string())?;if count==0{break;}size+=count as u64;require(size<=MAX_RESOURCE_BYTES,"cleanup resource too large")?;digest.update(&buffer[..count]);}
        require(format!("{:x}",digest.finalize())==*hash,"cleanup bytes changed; original retained")?;
        freed+=size;opened.push(file);
    }
    // Authenticate every remaining byte before the first deletion. The ownership
    // record permits safe retry if a later OS deletion fails halfway through.
    for file in opened {delete_handle(&file)?;drop(file);}
    for (_,directory) in directories {delete_handle(&directory)?;drop(directory);}
    delete_handle(&root_handle)?;drop(root_handle);
    let record=open_delete_file(&parent,&parent.join(owner_name(name)))?;
    delete_handle(&record)?;drop(record);
    Ok(freed)
}