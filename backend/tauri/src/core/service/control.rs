use crate::utils::dirs::{app_config_dir, app_data_dir, app_install_dir};
use runas::Command as RunasCommand;
use std::ffi::OsString;

use nyanpasu_ipc::types::ServiceStatus;

use super::SERVICE_PATH;

#[cfg(unix)]
use std::os::unix::process::ExitStatusExt;

#[cfg(windows)]
use std::ffi::OsStr;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use std::os::windows::process::ExitStatusExt;
#[cfg(windows)]
use std::ptr;
#[cfg(windows)]
use winapi::um::shellapi::ShellExecuteW;
#[cfg(windows)]
use winapi::um::winuser::{SW_HIDE, SW_SHOW};

#[cfg(windows)]
fn escape_windows_cmd_arg(arg: &OsString) -> String {
    let s = arg.to_string_lossy();
    if !s.chars().any(|c| c.is_whitespace() || c == '"') {
        return s.into_owned();
    }

    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');

    let mut backslashes = 0usize;
    for ch in s.chars() {
        match ch {
            '\\' => {
                backslashes += 1;
            }
            '"' => {
                out.extend(std::iter::repeat('\\').take(backslashes * 2 + 1));
                out.push('"');
                backslashes = 0;
            }
            _ => {
                out.extend(std::iter::repeat('\\').take(backslashes));
                out.push(ch);
                backslashes = 0;
            }
        }
    }

    out.extend(std::iter::repeat('\\').take(backslashes * 2));
    out.push('"');
    out
}

#[cfg(windows)]
fn run_elevated(
    program: &std::path::Path,
    args: &[OsString],
    show: bool,
) -> Result<std::process::ExitStatus, std::io::Error> {
    // 服务安装/卸载/启动/停止操作总是需要管理员权限
    // 直接使用UAC提权，不先尝试普通权限
    tracing::info!("Service operation requires administrator privileges, requesting UAC elevation...");

    // 需要提权时，使用UAC
    let program_wide: Vec<u16> = OsStr::new(program).encode_wide().chain(Some(0)).collect();
    let args_str = args
        .iter()
        .map(escape_windows_cmd_arg)
        .collect::<Vec<_>>()
        .join(" ");
    let args_wide: Vec<u16> = OsStr::new(&args_str).encode_wide().chain(Some(0)).collect();

    tracing::info!("Requesting administrator privileges for service operation...");

    let result = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            OsStr::new("runas")
                .encode_wide()
                .chain(Some(0))
                .collect::<Vec<u16>>()
                .as_ptr(),
            program_wide.as_ptr(),
            if args_str.is_empty() {
                ptr::null()
            } else {
                args_wide.as_ptr()
            },
            ptr::null(),
            if show { SW_SHOW } else { SW_HIDE },
        )
    };

    if result as usize > 32 {
        tracing::info!("UAC elevation prompt launched successfully, waiting for user response...");
        
        // ShellExecuteW 成功启动了提权进程，但不会等待用户响应
        // 我们需要给用户足够的时间来响应UAC对话框
        // 使用较长的等待时间，让用户有充分时间看到并响应UAC
        std::thread::sleep(std::time::Duration::from_secs(10));
        
        tracing::info!("UAC wait period completed");
        Ok(std::process::ExitStatus::from_raw(0))
    } else {
        let error_code = result as i32;
        tracing::error!("UAC elevation failed with error code: {}", error_code);

        // 常见的UAC错误码
        match error_code {
            1223 => {
                // 用户取消了UAC提示
                Err(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    "User cancelled the UAC elevation prompt",
                ))
            }
            _ => Err(std::io::Error::from_raw_os_error(error_code)),
        }
    }
}

pub async fn get_service_install_args() -> Result<Vec<OsString>, anyhow::Error> {
    let user = {
        #[cfg(windows)]
        {
            nyanpasu_utils::os::get_current_user_sid().await?
        }
        #[cfg(not(windows))]
        {
            whoami::username()
        }
    };
    let data_dir = app_data_dir()?;
    let config_dir = app_config_dir()?;
    let app_dir = app_install_dir()?;

    #[cfg(not(windows))]
    let args: Vec<OsString> = vec![
        "install".into(),
        "--user".into(),
        user.into(),
        "--nyanpasu-data-dir".into(),
        format!("\"{}\"", data_dir.to_string_lossy()).into(),
        "--nyanpasu-config-dir".into(),
        format!("\"{}\"", config_dir.to_string_lossy()).into(),
        "--nyanpasu-app-dir".into(),
        format!("\"{}\"", app_dir.to_string_lossy()).into(),
    ];

    #[cfg(windows)]
    let args: Vec<OsString> = vec![
        "install".into(),
        "--user".into(),
        user.into(),
        "--nyanpasu-data-dir".into(),
        data_dir.into(),
        "--nyanpasu-config-dir".into(),
        config_dir.into(),
        "--nyanpasu-app-dir".into(),
        app_dir.into(),
    ];

    Ok(args)
}

pub async fn install_service() -> anyhow::Result<()> {
    tracing::info!("🚀 Starting service installation process");
    
    if let Ok(info) = status().await {
        tracing::info!("📊 Current service status: {:?}", info.status);
        if !matches!(info.status, ServiceStatus::NotInstalled) {
            tracing::info!("✅ Service already installed, skipping installation");
            return Ok(());
        }
    }
    
    let args = get_service_install_args().await?;
    tracing::info!("🔧 Service install args prepared: {:?}", args);
    
    tracing::info!("🔍 Checking service executable path: {}", SERVICE_PATH.display());
    if !SERVICE_PATH.as_path().exists() {
        tracing::error!("❌ Service executable not found at: {}", SERVICE_PATH.display());
        anyhow::bail!(
            "nyanpasu-service executable not found at: {}",
            SERVICE_PATH.display()
        );
    }
    tracing::info!("✅ Service executable found at: {}", SERVICE_PATH.display());
    tracing::info!("⚡ Executing service installation command with elevated privileges");
    let child = tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            tracing::info!("🔧 Windows: Running elevated command: {} {:?}", SERVICE_PATH.display(), args);
            let result = run_elevated(SERVICE_PATH.as_path(), &args, true);
            tracing::info!("📋 Elevated command result: {:?}", result);
            result
        }
        #[cfg(all(not(windows), not(target_os = "macos")))]
        {
            let mut cmd = RunasCommand::new(SERVICE_PATH.as_path());
            cmd.args(&args);
            cmd.gui(false).show(false);
            tracing::info!("🔧 Linux: Running runas command: {} {:?}", SERVICE_PATH.display(), args);
            let result = cmd.status();
            tracing::info!("📋 Runas command result: {:?}", result);
            result
        }
        #[cfg(target_os = "macos")]
        {
            use crate::utils::sudo::sudo;
            let args = args.iter().map(|s| s.to_string_lossy()).collect::<Vec<_>>();
            tracing::info!("🔧 macOS: Running sudo command: {} {:?}", SERVICE_PATH.display(), args);
            match sudo(SERVICE_PATH.to_string_lossy(), &args) {
                Ok(()) => {
                    tracing::info!("✅ Sudo command succeeded");
                    Ok(std::process::ExitStatus::from_raw(0))
                }
                Err(e) => {
                    tracing::error!("❌ Sudo command failed: {}", e);
                    Err(std::io::Error::new(std::io::ErrorKind::Other, e))
                }
            }
        }
    })
    .await??;
    
    tracing::info!("🎉 Service installation command completed successfully");
    if !child.success() {
        anyhow::bail!(
            "failed to install service, exit code: {}, signal: {:?}",
            child.code().unwrap_or(-1),
            {
                #[cfg(unix)]
                {
                    child.signal().unwrap_or(0)
                }
                #[cfg(not(unix))]
                {
                    0
                }
            }
        );
    }

    // Windows 的 ShellExecuteW 会立即返回，需要轮询等待服务真正安装完成
    #[cfg(windows)]
    {
        tracing::info!("Waiting for service installation to complete...");
        for attempt in 0..30 {
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
            match status().await {
                Ok(info) if !matches!(info.status, ServiceStatus::NotInstalled) => {
                    tracing::info!(
                        "Service installation verified after {} seconds",
                        attempt + 1
                    );
                    break;
                }
                Ok(_) => {
                    if attempt == 29 {
                        tracing::warn!(
                            "Service still shows as not_installed after 30 seconds, but continuing"
                        );
                    }
                }
                Err(e) => {
                    tracing::debug!(
                        "Status check failed during install wait (attempt {}): {}",
                        attempt + 1,
                        e
                    );
                }
            }
        }
    }

    // 只在服务模式启用时才启动健康检查
    let enable_service_mode = {
        *crate::config::Config::verge()
            .latest()
            .enable_service_mode
            .as_ref()
            .unwrap_or(&false)
    };

    if enable_service_mode {
        // 验证服务确实可以连接后再启动健康检查
        match status().await {
            Ok(info) if matches!(info.status, ServiceStatus::Running | ServiceStatus::Stopped) => {
                if !super::ipc::HEALTH_CHECK_RUNNING.load(std::sync::atomic::Ordering::Relaxed) {
                    tracing::info!("Service installed and accessible, starting health check");
                    super::ipc::spawn_health_check();
                }
            }
            Ok(_) => {
                tracing::debug!(
                    "Service installed but not yet accessible, health check will be started when service mode is enabled"
                );
            }
            Err(e) => {
                tracing::warn!(
                    "Service installed but status check failed: {}. Health check deferred.",
                    e
                );
            }
        }
    } else {
        tracing::debug!("Service mode not enabled, skipping health check startup");
    }

    Ok(())
}

pub async fn update_service() -> anyhow::Result<()> {
    let child = tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            run_elevated(SERVICE_PATH.as_path(), &["update".into()], true)
        }
        #[cfg(all(not(windows), not(target_os = "macos")))]
        {
            let mut cmd = RunasCommand::new(SERVICE_PATH.as_path());
            cmd.args(&["update"]);
            cmd.gui(false).show(false);
            cmd.status()
        }
        #[cfg(target_os = "macos")]
        {
            use crate::utils::sudo::sudo;
            match sudo(SERVICE_PATH.to_string_lossy(), &["update"]) {
                Ok(()) => Ok(std::process::ExitStatus::from_raw(0)),
                Err(e) => {
                    tracing::error!("failed to update service: {}", e);
                    Err(e)
                }
            }
        }
    })
    .await??;
    if !child.success() {
        anyhow::bail!(
            "failed to update service, exit code: {}, signal: {:?}",
            child.code().unwrap_or(-1),
            {
                #[cfg(unix)]
                {
                    child.signal().unwrap_or(0)
                }
                #[cfg(not(unix))]
                {
                    0
                }
            }
        );
    }
    Ok(())
}

pub async fn uninstall_service() -> anyhow::Result<()> {
    let child = tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            run_elevated(SERVICE_PATH.as_path(), &["uninstall".into()], true)
        }
        #[cfg(all(not(windows), not(target_os = "macos")))]
        {
            let mut cmd = RunasCommand::new(SERVICE_PATH.as_path());
            cmd.args(&["uninstall"]);
            cmd.gui(false).show(false);
            cmd.status()
        }
        #[cfg(target_os = "macos")]
        {
            use crate::utils::sudo::sudo;
            match sudo(SERVICE_PATH.to_string_lossy(), &["uninstall"]) {
                Ok(()) => Ok(std::process::ExitStatus::from_raw(0)),
                Err(e) => {
                    tracing::error!("failed to uninstall service: {}", e);
                    Err(e)
                }
            }
        }
    })
    .await??;
    if !child.success() {
        anyhow::bail!(
            "failed to uninstall service, exit code: {}",
            child.code().unwrap()
        );
    }
    let _ = super::ipc::KILL_FLAG.compare_exchange(
        false,
        true,
        std::sync::atomic::Ordering::Acquire,
        std::sync::atomic::Ordering::Relaxed,
    );
    Ok(())
}

pub async fn start_service() -> anyhow::Result<()> {
    let child = tokio::task::spawn_blocking(move || {
        #[cfg(not(target_os = "macos"))]
        {
            #[cfg(all(unix, not(target_os = "macos")))]
            let status = {
                let service = SERVICE_PATH.to_string_lossy();
                let cmd = format!(
                    "\"{}\" start; for i in $(seq 1 20); do [ -S /run/nyanpasu_ipc.sock ] && break; sleep 0.1; done; if [ -S /run/nyanpasu_ipc.sock ]; then chown root:nyanpasu /run/nyanpasu_ipc.sock && chmod 660 /run/nyanpasu_ipc.sock; fi",
                    service
                );
                RunasCommand::new("/bin/sh")
                    .arg("-c")
                    .arg(cmd)
                    .gui(false)
                    .show(false)
                    .status()
            };

            #[cfg(windows)]
            let status = run_elevated(SERVICE_PATH.as_path(), &["start".into()], true);

            #[cfg(all(not(windows), not(all(unix, not(target_os = "macos")))))]
            let status = {
                let mut cmd = RunasCommand::new(SERVICE_PATH.as_path());
                cmd.args(&["start"]);
                cmd.gui(false).show(false);
                cmd.status()
            };

            status
        }
        #[cfg(target_os = "macos")]
        {
            use crate::utils::sudo::sudo;
            const ARGS: &[&str] = &["start"];
            match sudo(SERVICE_PATH.to_string_lossy(), ARGS) {
                Ok(()) => Ok(std::process::ExitStatus::from_raw(0)),
                Err(e) => {
                    tracing::error!("failed to start service: {}", e);
                    Err(e)
                }
            }
        }
    })
    .await??;
    if !child.success() {
        anyhow::bail!(
            "failed to start service, exit code: {}, signal: {:?}",
            child.code().unwrap_or(-1),
            {
                #[cfg(unix)]
                {
                    child.signal().unwrap_or(0)
                }
                #[cfg(not(unix))]
                {
                    0
                }
            }
        );
    }

    // 只在服务模式启用且服务可访问时才启动健康检查
    let enable_service_mode = {
        *crate::config::Config::verge()
            .latest()
            .enable_service_mode
            .as_ref()
            .unwrap_or(&false)
    };

    if enable_service_mode {
        if let Ok(info) = status().await {
            if matches!(info.status, ServiceStatus::Running) {
                if !super::ipc::HEALTH_CHECK_RUNNING.load(std::sync::atomic::Ordering::Acquire) {
                    tracing::info!("Service started successfully, starting health check");
                    super::ipc::spawn_health_check();
                }
            }
        }
    }

    Ok(())
}

pub async fn stop_service() -> anyhow::Result<()> {
    // 先检查服务状态，如果已经停止则直接返回成功
    match status().await {
        Ok(status_info) => {
            if matches!(status_info.status, ServiceStatus::Stopped | ServiceStatus::NotInstalled) {
                tracing::info!("服务已经停止或未安装，无需停止操作");
                return Ok(());
            }
        }
        Err(e) => {
            tracing::warn!("无法获取服务状态，继续尝试停止: {}", e);
        }
    }

    let child = tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            run_elevated(SERVICE_PATH.as_path(), &["stop".into()], true)
        }
        #[cfg(all(not(windows), not(target_os = "macos")))]
        {
            let mut cmd = RunasCommand::new(SERVICE_PATH.as_path());
            cmd.args(&["stop"]);
            cmd.gui(false).show(false);
            cmd.status()
        }
        #[cfg(target_os = "macos")]
        {
            use crate::utils::sudo::sudo;
            match sudo(SERVICE_PATH.to_string_lossy(), &["stop"]) {
                Ok(()) => Ok(std::process::ExitStatus::from_raw(0)),
                Err(e) => {
                    tracing::error!("failed to stop service: {}", e);
                    Err(e)
                }
            }
        }
    })
    .await??;
    if !child.success() {
        anyhow::bail!(
            "failed to stop service, exit code: {}, signal: {:?}",
            child.code().unwrap_or(-1),
            {
                #[cfg(unix)]
                {
                    child.signal().unwrap_or(0)
                }
                #[cfg(not(unix))]
                {
                    0
                }
            }
        );
    }
    let _ = super::ipc::KILL_FLAG.compare_exchange_weak(
        false,
        true,
        std::sync::atomic::Ordering::Acquire,
        std::sync::atomic::Ordering::Relaxed,
    );
    Ok(())
}

pub async fn restart_service() -> anyhow::Result<()> {
    let child = tokio::task::spawn_blocking(move || {
        #[cfg(not(target_os = "macos"))]
        {
            #[cfg(all(unix, not(target_os = "macos")))]
            let status = {
                let service = SERVICE_PATH.to_string_lossy();
                let cmd = format!(
                    "\"{}\" restart; for i in $(seq 1 20); do [ -S /run/nyanpasu_ipc.sock ] && break; sleep 0.1; done; if [ -S /run/nyanpasu_ipc.sock ]; then chown root:nyanpasu /run/nyanpasu_ipc.sock && chmod 660 /run/nyanpasu_ipc.sock; fi",
                    service
                );
                RunasCommand::new("/bin/sh")
                    .arg("-c")
                    .arg(cmd)
                    .gui(false)
                    .show(false)
                    .status()
            };

            #[cfg(not(all(unix, not(target_os = "macos"))))]
            let status = RunasCommand::new(SERVICE_PATH.as_path())
                .args(&["restart"])
                .gui(false)
                .show(false)
                .status();

            status
        }
        #[cfg(target_os = "macos")]
        {
            use crate::utils::sudo::sudo;
            const ARGS: &[&str] = &["restart"];
            match sudo(SERVICE_PATH.to_string_lossy(), ARGS) {
                Ok(()) => Ok(std::process::ExitStatus::from_raw(0)),
                Err(e) => {
                    tracing::error!("failed to restart service: {}", e);
                    Err(e)
                }
            }
        }
    })
    .await??;
    if !child.success() {
        anyhow::bail!(
            "failed to restart service, exit code: {}, signal: {:?}",
            child.code().unwrap_or(-1),
            {
                #[cfg(unix)]
                {
                    child.signal().unwrap_or(0)
                }
                #[cfg(not(unix))]
                {
                    0
                }
            }
        );
    }

    // 只在服务模式启用且服务可访问时才启动健康检查
    let enable_service_mode = {
        *crate::config::Config::verge()
            .latest()
            .enable_service_mode
            .as_ref()
            .unwrap_or(&false)
    };

    if enable_service_mode {
        if let Ok(info) = status().await {
            if matches!(info.status, ServiceStatus::Running) {
                if !super::ipc::HEALTH_CHECK_RUNNING.load(std::sync::atomic::Ordering::Acquire) {
                    tracing::info!("Service restarted successfully, starting health check");
                    super::ipc::spawn_health_check();
                }
            }
        }
    }

    Ok(())
}

#[tracing::instrument]
pub async fn status<'a>() -> anyhow::Result<nyanpasu_ipc::types::StatusInfo<'a>> {
    // 如果服务可执行文件不存在，返回 not_installed 状态而不是错误
    if !SERVICE_PATH.as_path().exists() {
        tracing::debug!(
            "nyanpasu-service executable not found at: {}, returning not_installed status",
            SERVICE_PATH.display()
        );
        return Ok(nyanpasu_ipc::types::StatusInfo {
            name: std::borrow::Cow::Borrowed(""),
            version: std::borrow::Cow::Borrowed(""),
            status: ServiceStatus::NotInstalled,
            server: None,
        });
    }

    let mut cmd = tokio::process::Command::new(SERVICE_PATH.as_path());
    cmd.args(["status", "--json"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = match cmd.output().await {
        Ok(output) => output,
        Err(e) => {
            tracing::warn!(
                "failed to execute service status command: {}, returning not_installed",
                e
            );
            return Ok(nyanpasu_ipc::types::StatusInfo {
                name: std::borrow::Cow::Borrowed(""),
                version: std::borrow::Cow::Borrowed(""),
                status: ServiceStatus::NotInstalled,
                server: None,
            });
        }
    };

    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("Permission denied") || stderr.contains("os error 13") {
        anyhow::bail!(
            "failed to query service status: permission denied. Ensure the current user has access to the service IPC socket (e.g. re-login after adding to the nyanpasu group). Details: {}",
            stderr.trim()
        );
    }

    // 如果命令执行失败，尝试解析 stderr 判断是否是服务未安装
    if !output.status.success() {
        let stderr_str = stderr.to_string();
        // 常见的服务未安装错误消息
        if stderr_str.contains("not installed")
            || stderr_str.contains("not found")
            || stderr_str.contains("does not exist")
            || stderr_str.contains("找不到")
            || stderr_str.contains("不存在")
        {
            tracing::debug!(
                "service appears not installed based on stderr: {}",
                stderr_str
            );
            return Ok(nyanpasu_ipc::types::StatusInfo {
                name: std::borrow::Cow::Borrowed(""),
                version: std::borrow::Cow::Borrowed(""),
                status: ServiceStatus::NotInstalled,
                server: None,
            });
        }

        anyhow::bail!(
            "failed to query service status, exit code: {}, signal: {:?}, stderr: {}",
            output.status.code().unwrap_or(-1),
            {
                #[cfg(unix)]
                {
                    output.status.signal().unwrap_or(0)
                }
                #[cfg(not(unix))]
                {
                    0
                }
            },
            stderr_str
        );
    }

    let status_str = match String::from_utf8(output.stdout) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("failed to parse service status output as UTF-8: {}", e);
            return Ok(nyanpasu_ipc::types::StatusInfo {
                name: std::borrow::Cow::Borrowed(""),
                version: std::borrow::Cow::Borrowed(""),
                status: ServiceStatus::NotInstalled,
                server: None,
            });
        }
    };

    tracing::trace!("service status: {}", status_str);
    match serde_json::from_str(&status_str) {
        Ok(status) => Ok(status),
        Err(e) => {
            tracing::error!(
                "failed to parse service status JSON: {}, raw: {}",
                e,
                status_str
            );
            // JSON 解析失败也认为服务未正确安装
            Ok(nyanpasu_ipc::types::StatusInfo {
                name: std::borrow::Cow::Borrowed(""),
                version: std::borrow::Cow::Borrowed(""),
                status: ServiceStatus::NotInstalled,
                server: None,
            })
        }
    }
}
