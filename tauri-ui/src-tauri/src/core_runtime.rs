use crate::grpc::CoreIdentity;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::time::{Duration, Instant};
use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
use windows_sys::Win32::Foundation::{CloseHandle, ERROR_FILE_NOT_FOUND, WAIT_OBJECT_0};
use windows_sys::Win32::Storage::FileSystem::{
    GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
};
use windows_sys::Win32::System::Threading::{
    OpenMutexW, OpenProcess, QueryFullProcessImageNameW, WaitForSingleObject,
    PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE, SYNCHRONIZATION_SYNCHRONIZE,
};

static LIFECYCLE_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static STARTED_CORE: tokio::sync::Mutex<Option<Child>> = tokio::sync::Mutex::const_new(None);

fn valid_core_binary_identity(product: &str, description: &str) -> bool {
    product.eq_ignore_ascii_case("Dext") && if cfg!(feature="v3-release") {
        description.to_ascii_lowercase().starts_with("dext v3")
    } else { description.to_ascii_lowercase().starts_with("dext") }
}

fn version_value(info: &[u8], sub_block: &str) -> Option<String> {
    let name: Vec<u16> = OsStr::new(sub_block).encode_wide().chain(Some(0)).collect();
    let mut value = std::ptr::null_mut();
    let mut length = 0;
    let success =
        unsafe { VerQueryValueW(info.as_ptr().cast(), name.as_ptr(), &mut value, &mut length) };
    if success == 0 || value.is_null() || length == 0 {
        return None;
    }
    let chars = unsafe { std::slice::from_raw_parts(value.cast::<u16>(), length as usize) };
    let end = chars.iter().position(|ch| *ch == 0).unwrap_or(chars.len());
    Some(String::from_utf16_lossy(&chars[..end]))
}

fn validate_core_binary_identity(path: &Path) -> Result<(), String> {
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let size = unsafe { GetFileVersionInfoSizeW(wide.as_ptr(), std::ptr::null_mut()) };
    if size == 0 {
        return Err(format!(
            "cannot read Dext Core product metadata: {}",
            path.display()
        ));
    }
    let mut info = vec![0u8; size as usize];
    if unsafe { GetFileVersionInfoW(wide.as_ptr(), 0, size, info.as_mut_ptr().cast()) } == 0 {
        return Err(format!(
            "cannot read Dext Core product metadata: {}",
            path.display()
        ));
    }
    let translation_name: Vec<u16> = OsStr::new(r"\VarFileInfo\Translation")
        .encode_wide()
        .chain(Some(0))
        .collect();
    let mut translation = std::ptr::null_mut();
    let mut translation_bytes = 0;
    let has_translation = unsafe {
        VerQueryValueW(
            info.as_ptr().cast(),
            translation_name.as_ptr(),
            &mut translation,
            &mut translation_bytes,
        )
    } != 0;
    let mut tables = Vec::new();
    if has_translation && !translation.is_null() && translation_bytes >= 4 {
        let codes = unsafe { std::slice::from_raw_parts(translation.cast::<u16>(), 2) };
        tables.push(format!("{:04x}{:04x}", codes[0], codes[1]));
    }
    tables.extend(["040904b0".to_string(), "040904e4".to_string()]);
    for table in tables {
        let product = version_value(&info, &format!(r"\StringFileInfo\{table}\ProductName"));
        let description =
            version_value(&info, &format!(r"\StringFileInfo\{table}\FileDescription"));
        if let (Some(product), Some(description)) = (product, description) {
            if valid_core_binary_identity(&product, &description) {
                return Ok(());
            }
        }
    }
    Err(format!(
        "refusing non-Dext or stale Core binary: {}",
        path.display()
    ))
}

fn core_path_for_configurator(configurator: &Path, manifest: &Path) -> Result<PathBuf, String> {
    core_path_for_configurator_with_target(
        configurator,
        manifest,
        option_env!("CARGO_TARGET_DIR").map(Path::new),
    )
}

fn core_path_for_configurator_with_target(
    configurator: &Path,
    manifest: &Path,
    external_target: Option<&Path>,
) -> Result<PathBuf, String> {
    let config_path = std::fs::canonicalize(configurator)
        .map_err(|error| format!("cannot locate configurator executable: {error}"))?;
    let manifest_path = std::fs::canonicalize(manifest).unwrap_or_else(|_| manifest.to_path_buf());
    let mut targets = vec![manifest_path.join("target")];
    if let Some(external) = external_target {
        targets.push(std::fs::canonicalize(external).unwrap_or_else(|_| external.to_path_buf()));
    }
    let development_binary = config_path
        .file_name()
        .is_some_and(|name| name == "dext-configurator.exe")
        && targets.iter().any(|target| {
            ["debug", "release"].iter().any(|configuration| {
                config_path.parent() == Some(target.join(configuration).as_path())
            })
        });

    let core = if cfg!(feature = "v3-release") {
        config_path.parent().ok_or("cannot resolve product directory")?.join("Lively.exe")
    } else if development_binary {
        manifest
            .parent()
            .and_then(Path::parent)
            .ok_or_else(|| "cannot resolve Dext worktree root".to_string())?
            .join("lively-core-separation/src/Lively/Lively/bin/x64/Debug/net9.0-windows10.0.18362.0/Lively.exe")
    } else if cfg!(debug_assertions) {
        return Err("refusing configurator outside its build worktree".into());
    } else {
        configurator
            .parent()
            .ok_or_else(|| "cannot resolve installed configurator directory".to_string())?
            .join("Lively.exe")
    };
    if !core.is_file() {
        return Err(format!(
            "缺少 Dext Core 启动文件，请重新构建或修复安装：{}",
            core.display()
        ));
    }
    Ok(core)
}

fn normalize_path(value: &Path) -> String {
    value
        .to_string_lossy()
        .replace('/', "\\")
        .trim_start_matches(r"\\?\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn identity_matches_expected_core(
    identity: &CoreIdentity,
    core_exe: &Path,
    pid: Option<u32>,
) -> bool {
    identity.is_core_initialized && identity_is_expected_process(identity, core_exe, pid)
}

fn identity_is_expected_process(
    identity: &CoreIdentity,
    core_exe: &Path,
    pid: Option<u32>,
) -> bool {
    pid.is_none_or(|expected| identity.process_id == expected as i32)
        && core_exe.parent().is_some_and(|parent| {
            normalize_path(parent) == normalize_path(Path::new(&identity.base_directory))
        })
}

fn expected_core_path() -> Result<PathBuf, String> {
    let configurator = std::env::current_exe()
        .map_err(|error| format!("cannot locate configurator executable: {error}"))?;
    core_path_for_configurator(&configurator, Path::new(env!("CARGO_MANIFEST_DIR")))
}

pub fn native_assets_directory() -> Result<PathBuf,String> {
    let directory = if cfg!(feature="v3-release") {
        expected_core_path()?.parent().ok_or("Dext product has no parent directory")?.join("wallpapers/dext-room-v3")
    } else {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../wallpapers/dext-room-v3")
    };
    let directory=directory.canonicalize().map_err(|e|format!("缺少原生桌面资源，请修复 Dext 安装：{e}"))?;
    if !directory.join("index.html").is_file() || !directory.join("LivelyInfo.json").is_file() {
        return Err("缺少 Dext 原生宿主入口，请修复安装".into());
    }
    Ok(directory)
}
pub fn require_core_stopped_for_maintenance() -> Result<(), String> {
    if mutex_exists()? { Err("请先退出 Dext Core，再恢复或清理旧安装；源 Room 和个人配置保持".into()) }
    else { Ok(()) }
}

fn mutex_exists() -> Result<bool, String> {
    let name: Vec<u16> = OsStr::new(crate::grpc::runtime_identity_name())
        .encode_wide()
        .chain(Some(0))
        .collect();
    let handle = unsafe { OpenMutexW(SYNCHRONIZATION_SYNCHRONIZE, 0, name.as_ptr()) };
    if !handle.is_null() {
        unsafe { CloseHandle(handle) };
        return Ok(true);
    }
    let error = std::io::Error::last_os_error();
    if error.raw_os_error() == Some(ERROR_FILE_NOT_FOUND as i32) {
        Ok(false)
    } else {
        Err(format!("cannot inspect Dext Core mutex: {error}"))
    }
}

fn open_core_process(pid: i32) -> Result<usize, String> {
    if pid <= 0 {
        return Err("Dext Core returned an invalid process ID".into());
    }
    let handle = unsafe {
        OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
            0,
            pid as u32,
        )
    };
    if handle.is_null() {
        return Err(format!(
            "cannot inspect Dext Core PID {pid}: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(handle as usize)
}

fn process_executable(handle: usize) -> Result<PathBuf, String> {
    let mut buffer = vec![0u16; 32768];
    let mut length = buffer.len() as u32;
    let ok =
        unsafe { QueryFullProcessImageNameW(handle as _, 0, buffer.as_mut_ptr(), &mut length) };
    if ok == 0 {
        return Err(format!(
            "cannot read Dext Core executable path: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(PathBuf::from(String::from_utf16_lossy(
        &buffer[..length as usize],
    )))
}

fn same_executable(actual: &Path, expected: &Path) -> bool {
    let actual = std::fs::canonicalize(actual).unwrap_or_else(|_| actual.to_path_buf());
    let expected = std::fs::canonicalize(expected).unwrap_or_else(|_| expected.to_path_buf());
    normalize_path(&actual) == normalize_path(&expected)
}

fn verified_process_handle(identity: &CoreIdentity, expected: &Path) -> Result<usize, String> {
    if !identity_is_expected_process(identity, expected, None) {
        return Err(format!(
            "refusing Core outside this configurator worktree: {}",
            identity.base_directory
        ));
    }
    let handle = open_core_process(identity.process_id)?;
    let actual = process_executable(handle);
    match actual {
        Ok(actual) if same_executable(&actual, expected) => Ok(handle),
        Ok(actual) => {
            unsafe { CloseHandle(handle as _) };
            Err(format!(
                "refusing Core executable {} (expected {})",
                actual.display(),
                expected.display()
            ))
        }
        Err(error) => {
            unsafe { CloseHandle(handle as _) };
            Err(error)
        }
    }
}

fn product_exit_identity(
    raw: &crate::proto::desktop::GetCoreStatsResponse,
    expected: &Path,
) -> Result<Option<CoreIdentity>, String> {
    if !raw.is_product_exiting {
        return Ok(None);
    }
    crate::grpc::verify_core_identity_response(raw)?;
    let identity: CoreIdentity = raw.clone().into();
    if !identity_is_expected_process(&identity, expected, None) {
        return Err("refusing product exit from another Core worktree".into());
    }
    Ok(Some(identity))
}

pub fn watch_product_exit(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let Ok(expected) = expected_core_path() else { return };
        loop {
            let response = tokio::time::timeout(
                Duration::from_secs(2), crate::grpc::raw_core_identity(),
            ).await;
            if let Ok(Ok(raw)) = response {
                if let Ok(Some(identity)) = product_exit_identity(&raw, &expected) {
                    // An RPC's reported path alone cannot authorize app exit:
                    // hold the actual PID and compare its executable as well.
                    if let Ok(handle) = verified_process_handle(&identity, &expected) {
                        unsafe { CloseHandle(handle as _) };
                        app.exit(0);
                        return;
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    });
}

pub async fn managed_core_identity() -> Result<CoreIdentity, String> {
    let identity = crate::grpc::core_identity().await?;
    let expected = expected_core_path()?;
    let handle = verified_process_handle(&identity, &expected)?;
    unsafe { CloseHandle(handle as _) };
    Ok(identity)
}

async fn wait_until_ready(
    expected: &Path,
    spawned_pid: Option<u32>,
) -> Result<CoreIdentity, String> {
    let deadline = Instant::now() + Duration::from_secs(20);
    loop {
        if let Some(child) = STARTED_CORE.lock().await.as_mut() {
            if let Some(status) = child
                .try_wait()
                .map_err(|error| format!("cannot inspect started Core: {error}"))?
            {
                return Err(format!(
                    "Dext Core exited during startup with status {status}"
                ));
            }
        }
        if let Ok(raw) = crate::grpc::raw_core_identity().await {
            crate::grpc::verify_core_identity_response(&raw)?;
            let identity: CoreIdentity = raw.into();
            if !identity_is_expected_process(&identity, expected, spawned_pid) {
                return Err("another Dext Core owns the runtime identity".into());
            }
            let handle = verified_process_handle(&identity, expected)?;
            unsafe { CloseHandle(handle as _) };
            if identity_matches_expected_core(&identity, expected, spawned_pid) {
                return Ok(identity);
            }
        }
        if Instant::now() >= deadline {
            return Err(
                "Dext Core started but its desktop did not become ready within 20 seconds".into(),
            );
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
}

pub async fn start_core() -> Result<CoreIdentity, String> {
    let _guard = LIFECYCLE_LOCK.lock().await;
    let expected = expected_core_path()?;

    if let Ok(raw) = crate::grpc::raw_core_identity().await {
        crate::grpc::verify_core_identity_response(&raw)?;
        let identity: CoreIdentity = raw.into();
        let handle = verified_process_handle(&identity, &expected)?;
        unsafe { CloseHandle(handle as _) };
        return if identity.is_core_initialized {
            Ok(identity)
        } else {
            wait_until_ready(&expected, None).await
        };
    }
    if !crate::grpc::pipe_is_absent()? || mutex_exists()? {
        return Err("Dext runtime identity is occupied but Core is not responding; cannot start another instance".into());
    }
    validate_core_binary_identity(&expected)?;

    let mut started = STARTED_CORE.lock().await;
    if let Some(child) = started.as_mut() {
        if child
            .try_wait()
            .map_err(|error| format!("cannot inspect started Core: {error}"))?
            .is_none()
        {
            return Err("Dext Core process is still running but not responding".into());
        }
    }
    let launch_started=Instant::now();
    let child = Command::new(&expected)
        .current_dir(
            expected
                .parent()
                .expect("Core executable has a parent directory"),
        )
        .spawn()
        .map_err(|error| format!("failed to start Dext Core {}: {error}", expected.display()))?;
    let pid = child.id();
    *started = Some(child);
    drop(started);
    let identity=wait_until_ready(&expected, Some(pid)).await?;
    crate::room_performance::record("core.spawn.ready",launch_started,serde_json::json!({"processId":pid}));
    Ok(identity)
}

pub async fn exit_core() -> Result<(), String> {
    let _guard = LIFECYCLE_LOCK.lock().await;
    let expected = expected_core_path()?;
    let raw = crate::grpc::raw_core_identity().await?;
    crate::grpc::verify_core_identity_response(&raw)?;
    let identity: CoreIdentity = raw.into();
    let handle = verified_process_handle(&identity, &expected)?;
    // Core may close its Pipe before the shutdown RPC can return trailers.
    let request = tokio::time::timeout(Duration::from_secs(3), crate::grpc::shutdown_core()).await;
    let outcome = tokio::task::spawn_blocking(move || {
        let result = unsafe { WaitForSingleObject(handle as _, 10000) };
        unsafe { CloseHandle(handle as _) };
        result
    })
    .await
    .map_err(|error| format!("cannot wait for Dext Core exit: {error}"))?;
    if outcome != WAIT_OBJECT_0 {
        return Err(format!(
            "Dext Core did not exit within 10 seconds; shutdown RPC: {request:?}"
        ));
    }
    let mut started = STARTED_CORE.lock().await;
    if started
        .as_ref()
        .is_some_and(|child| child.id() == identity.process_id as u32)
    {
        *started = None;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        core_path_for_configurator, core_path_for_configurator_with_target,
        identity_matches_expected_core, valid_core_binary_identity,
    };
    use crate::grpc::CoreIdentity;
    use std::path::Path;

    #[test]
    fn development_configurator_uses_its_own_worktree_core() {
        let root = tempfile::tempdir().unwrap();
        let manifest = root.path().join("tauri-ui/src-tauri");
        let configurator = manifest.join("target/debug/dext-configurator.exe");
        let core = root.path().join("lively-core-separation/src/Lively/Lively/bin/x64/Debug/net9.0-windows10.0.18362.0/Lively.exe");
        std::fs::create_dir_all(configurator.parent().unwrap()).unwrap();
        std::fs::create_dir_all(core.parent().unwrap()).unwrap();
        std::fs::write(&configurator, b"config").unwrap();
        std::fs::write(&core, b"core").unwrap();

        assert_eq!(
            core_path_for_configurator(&configurator, &manifest).unwrap(),
            core
        );
    }

    #[test]
    fn development_configurator_rejects_a_different_worktree() {
        let root = tempfile::tempdir().unwrap();
        let manifest = root.path().join("first/tauri-ui/src-tauri");
        let other = root
            .path()
            .join("other/tauri-ui/src-tauri/target/debug/dext-configurator.exe");
        std::fs::create_dir_all(other.parent().unwrap()).unwrap();
        std::fs::write(&other, b"config").unwrap();

        assert!(core_path_for_configurator(&other, &manifest)
            .unwrap_err()
            .contains("worktree"));
    }

    #[test]
    fn redirected_cargo_target_still_uses_its_compiled_worktree_core() {
        let root = tempfile::tempdir().unwrap();
        let manifest = root.path().join("checkout/tauri-ui/src-tauri");
        let target = root.path().join("build-cache");
        let configurator = target.join("debug/dext-configurator.exe");
        let core = root.path().join("checkout/lively-core-separation/src/Lively/Lively/bin/x64/Debug/net9.0-windows10.0.18362.0/Lively.exe");
        std::fs::create_dir_all(configurator.parent().unwrap()).unwrap();
        std::fs::create_dir_all(core.parent().unwrap()).unwrap();
        std::fs::write(&configurator, b"config").unwrap();
        std::fs::write(&core, b"core").unwrap();

        assert_eq!(
            core_path_for_configurator_with_target(&configurator, &manifest, Some(&target)).unwrap(),
            core
        );
        assert!(core_path_for_configurator_with_target(&configurator, &manifest, None)
            .unwrap_err()
            .contains("worktree"));
    }

    #[test]
    fn missing_core_binary_is_reported_before_spawn() {
        let root = tempfile::tempdir().unwrap();
        let manifest = root.path().join("tauri-ui/src-tauri");
        let configurator = manifest.join("target/debug/dext-configurator.exe");
        std::fs::create_dir_all(configurator.parent().unwrap()).unwrap();
        std::fs::write(&configurator, b"config").unwrap();

        assert!(core_path_for_configurator(&configurator, &manifest)
            .unwrap_err()
            .contains("Lively.exe"));
    }

    #[test]
    fn readiness_requires_matching_process_path_and_initialized_desktop() {
        let expected = Path::new(r"C:\Dext\Lively.exe");
        let mut identity = CoreIdentity {
            product_name: "Dext".into(),
            runtime_identity: "DEXT:DESKTOPSHELL".into(),
            process_id: 99,
            base_directory: r"C:\Dext\".into(),
            app_data_directory: r"C:\Users\Jan\AppData\Local\Dext".into(),
            grpc_pipe_name: "Grpc_DEXT:DESKTOPSHELLJAN".into(),
            assembly_version: "2.2.1.5".into(),
            is_core_initialized: true,
        };
        assert!(identity_matches_expected_core(
            &identity,
            expected,
            Some(99)
        ));
        identity.is_core_initialized = false;
        assert!(!identity_matches_expected_core(
            &identity,
            expected,
            Some(99)
        ));
        identity.is_core_initialized = true;
        assert!(!identity_matches_expected_core(
            &identity,
            expected,
            Some(100)
        ));
        identity.process_id = 100;
        identity.base_directory = r"C:\Other\".into();
        assert!(!identity_matches_expected_core(
            &identity,
            expected,
            Some(100)
        ));
    }

    #[test]
    fn refuses_stale_lively_build_before_spawn() {
        assert!(valid_core_binary_identity("Dext", "Dext Core"));
        assert!(!valid_core_binary_identity(
            "Lively Wallpaper",
            "Lively Wallpaper"
        ));
        assert!(!valid_core_binary_identity("Dext", "Lively Core"));
        assert!(!valid_core_binary_identity("", "Dext Core"));
    }
    #[test]
    fn product_exit_notice_requires_verified_current_worktree_identity() {
        use crate::proto::desktop::GetCoreStatsResponse;
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..").canonicalize().unwrap();
        let expected = root.join("lively-core-separation/src/Lively/Lively/bin/x64/Debug/net9.0-windows10.0.18362.0/Lively.exe");
        let mut raw = GetCoreStatsResponse {
            base_directory: expected.parent().unwrap().to_string_lossy().into(), assembly_version: "1".into(),
            is_core_initialized: true, product_name: "Dext".into(),
            runtime_identity: crate::grpc::runtime_identity_name().into(),
            process_id: 42, app_data_directory: std::env::var("LOCALAPPDATA").unwrap() + r"\Dext",
            grpc_pipe_name: crate::grpc::pipe_name().strip_prefix(r"\\.\pipe\").unwrap().into(),
            is_product_exiting: false,
        };
        assert!(super::product_exit_identity(&raw, &expected).unwrap().is_none());
        raw.is_product_exiting = true;
        assert_eq!(super::product_exit_identity(&raw, &expected).unwrap().unwrap().process_id,42);
        raw.base_directory = r"C:\Other\".into();
        assert!(super::product_exit_identity(&raw, &expected).is_err());
        raw.base_directory = expected.parent().unwrap().to_string_lossy().into(); raw.product_name = "Lively Wallpaper".into();
        assert!(super::product_exit_identity(&raw, &expected).is_err());
        raw.product_name = "Dext".into(); raw.process_id = 0;
        assert!(super::product_exit_identity(&raw, &expected).is_err());
    }

}
