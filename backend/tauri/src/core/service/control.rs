use crate::utils::dirs::{app_config_dir, app_data_dir, app_install_dir};
#[cfg(not(windows))]
use runas::Command as RunasCommand;
use std::ffi::OsString;

use nyanpasu_ipc::types::ServiceStatus;

use super::resolve_service_path;

#[cfg(unix)]
use std::os::unix::process::ExitStatusExt;

#[cfg(all(unix, not(target_os = "macos")))]
fn map_privilege_tool_not_found_error(e: std::io::Error) -> anyhow::Error {
    // Linux: missing privilege escalation tool (commonly pkexec from polkit)
    // Some environments report ENOENT via raw_os_error=2 but with a non-NotFound kind.
    if e.kind() == std::io::ErrorKind::NotFound || e.raw_os_error() == Some(2) {
        return anyhow::anyhow!(
            "failed to run privileged command: privilege escalation tool not found (pkexec/polkit). Please install polkit (pkexec) and try again"
        );
    }
    anyhow::Error::from(e)
}

#[cfg(windows)]
fn run_service_command(
    service_exe: &std::path::Path,
    service_args: &[OsString],
) -> anyhow::Result<(std::process::ExitStatus, String)> {
    let output = std::process::Command::new(service_exe)
        .args(service_args)
        .output()?;
    let mut out = String::new();
    out.push_str(&String::from_utf8_lossy(&output.stdout));
    if !output.stderr.is_empty() {
        if !out.ends_with('\n') && !out.is_empty() {
            out.push('\n');
        }
        out.push_str(&String::from_utf8_lossy(&output.stderr));
    }
    Ok((output.status, out))
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

    let service_path = resolve_service_path();
    tracing::info!(
        "🔍 Checking service executable path: {}",
        service_path.display()
    );
    if !service_path.as_path().exists() {
        tracing::error!(
            "❌ Service executable not found at: {}",
            service_path.display()
        );
        anyhow::bail!(
            "nyanpasu-service executable not found at: {}",
            service_path.display()
        );
    }
    tracing::info!("✅ Service executable found at: {}", service_path.display());
    tracing::info!("⚡ Executing service installation command with elevated privileges");
    let (child, output) = tokio::task::spawn_blocking(
        move || -> anyhow::Result<(std::process::ExitStatus, String)> {
            #[cfg(windows)]
            {
                tracing::info!(
                    "🔧 Windows: Running service command: {} {:?}",
                    service_path.display(),
                    args
                );
                let result = run_service_command(service_path.as_path(), &args);
                tracing::info!(
                    "📋 Service script result: {:?}",
                    result.as_ref().map(|r| r.0)
                );
                result
            }
            #[cfg(all(not(windows), not(target_os = "macos")))]
            {
                let mut cmd = RunasCommand::new(service_path.as_path());
                cmd.args(&args);
                cmd.gui(false).show(false);
                tracing::info!(
                    "🔧 Linux: Running runas command: {} {:?}",
                    service_path.display(),
                    args
                );
                let result = cmd
                    .status()
                    .map(|status| (status, String::new()))
                    .map_err(map_privilege_tool_not_found_error);
                tracing::info!(
                    "📋 Runas command result: {:?}",
                    result.as_ref().map(|r| r.0)
                );
                result
            }
            #[cfg(target_os = "macos")]
            {
                use crate::utils::sudo::sudo;
                let args = args.iter().map(|s| s.to_string_lossy()).collect::<Vec<_>>();
                tracing::info!(
                    "🔧 macOS: Running sudo command: {} {:?}",
                    service_path.display(),
                    args
                );
                sudo(service_path.to_string_lossy(), &args)
                    .map(|()| {
                        tracing::info!("✅ Sudo command succeeded");
                        (std::process::ExitStatus::from_raw(0), String::new())
                    })
                    .map_err(anyhow::Error::from)
            }
        },
    )
    .await??;

    tracing::info!("🎉 Service installation command completed successfully");
    if !child.success() {
        anyhow::bail!(
            "failed to install service, exit code: {}, signal: {:?}, output: {}",
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
            },
            output.trim()
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
    let service_path = resolve_service_path();
    if !service_path.as_path().exists() {
        tracing::warn!(
            "nyanpasu-service executable not found at: {}, skip update",
            service_path.display()
        );
        return Ok(());
    }

    let (child, output) = tokio::task::spawn_blocking(
        move || -> anyhow::Result<(std::process::ExitStatus, String)> {
            #[cfg(windows)]
            {
                run_service_command(service_path.as_path(), &["update".into()])
            }
            #[cfg(all(not(windows), not(target_os = "macos")))]
            {
                let mut cmd = RunasCommand::new(service_path.as_path());
                cmd.args(&["update"]);
                cmd.gui(false).show(false);
                cmd.status()
                    .map(|status| (status, String::new()))
                    .map_err(map_privilege_tool_not_found_error)
            }
            #[cfg(target_os = "macos")]
            {
                use crate::utils::sudo::sudo;
                sudo(service_path.to_string_lossy(), &["update"])
                    .map(|()| (std::process::ExitStatus::from_raw(0), String::new()))
                    .map_err(anyhow::Error::from)
            }
        },
    )
    .await??;
    if !child.success() {
        anyhow::bail!(
            "failed to update service, exit code: {}, signal: {:?}, output: {}",
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
            },
            output.trim()
        );
    }
    Ok(())
}

pub async fn uninstall_service() -> anyhow::Result<()> {
    // If service is not installed, treat uninstall as success
    if let Ok(info) = status().await {
        if matches!(info.status, ServiceStatus::NotInstalled) {
            tracing::info!("service not installed, skip uninstall");
            return Ok(());
        }
    }

    let service_path = resolve_service_path();
    if !service_path.as_path().exists() {
        tracing::warn!(
            "nyanpasu-service executable not found at: {}, skip uninstall",
            service_path.display()
        );
        return Ok(());
    }

    let (child, output) = tokio::task::spawn_blocking(
        move || -> anyhow::Result<(std::process::ExitStatus, String)> {
            #[cfg(windows)]
            {
                run_service_command(service_path.as_path(), &["uninstall".into()])
            }
            #[cfg(all(not(windows), not(target_os = "macos")))]
            {
                let mut cmd = RunasCommand::new(service_path.as_path());
                cmd.args(&["uninstall"]);
                cmd.gui(false).show(false);
                cmd.status()
                    .map(|status| (status, String::new()))
                    .map_err(map_privilege_tool_not_found_error)
            }
            #[cfg(target_os = "macos")]
            {
                use crate::utils::sudo::sudo;
                sudo(service_path.to_string_lossy(), &["uninstall"])
                    .map(|()| (std::process::ExitStatus::from_raw(0), String::new()))
                    .map_err(anyhow::Error::from)
            }
        },
    )
    .await??;
    if !child.success() {
        anyhow::bail!(
            "failed to uninstall service, exit code: {}, output: {}",
            child.code().unwrap_or(-1),
            output.trim()
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
    // If service is already running, treat start as success
    if let Ok(status_info) = status().await {
        if matches!(status_info.status, ServiceStatus::Running) {
            tracing::info!("service already running, skip start");
            return Ok(());
        }
    }

    let service_path = resolve_service_path();
    if !service_path.as_path().exists() {
        anyhow::bail!(
            "nyanpasu-service executable not found at: {}",
            service_path.display()
        );
    }

    let (child, output) = tokio::task::spawn_blocking(move || -> anyhow::Result<(std::process::ExitStatus, String)> {
        #[cfg(not(target_os = "macos"))]
        {
            #[cfg(all(unix, not(target_os = "macos")))]
            let status = {
                let service = service_path.to_string_lossy();
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
                    .map(|status| (status, String::new()))
                    .map_err(map_privilege_tool_not_found_error)
            };

            #[cfg(windows)]
            let status = run_service_command(service_path.as_path(), &["start".into()]);

            #[cfg(all(not(windows), not(all(unix, not(target_os = "macos")))))]
            let status = {
                let mut cmd = RunasCommand::new(service_path.as_path());
                cmd.args(&["start"]);
                cmd.gui(false).show(false);
                cmd.status()
                    .map(|status| (status, String::new()))
                    .map_err(anyhow::Error::from)
            };

            status
        }
        #[cfg(target_os = "macos")]
        {
            use crate::utils::sudo::sudo;
            const ARGS: &[&str] = &["start"];
            sudo(service_path.to_string_lossy(), ARGS)
                .map(|()| (std::process::ExitStatus::from_raw(0), String::new()))
                .map_err(anyhow::Error::from)
        }
    })
    .await??;
    if !child.success() {
        anyhow::bail!(
            "failed to start service, exit code: {}, signal: {:?}, output: {}",
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
            },
            output.trim()
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
            if matches!(
                status_info.status,
                ServiceStatus::Stopped | ServiceStatus::NotInstalled
            ) {
                tracing::info!("服务已经停止或未安装，无需停止操作");
                return Ok(());
            }
        }
        Err(e) => {
            tracing::warn!("无法获取服务状态，继续尝试停止: {}", e);
        }
    }

    let service_path = resolve_service_path();
    if !service_path.as_path().exists() {
        tracing::warn!(
            "nyanpasu-service executable not found at: {}, skip stopping",
            service_path.display()
        );
        return Ok(());
    }

    let (child, output) = tokio::task::spawn_blocking(
        move || -> anyhow::Result<(std::process::ExitStatus, String)> {
            #[cfg(windows)]
            {
                run_service_command(service_path.as_path(), &["stop".into()])
            }
            #[cfg(all(not(windows), not(target_os = "macos")))]
            {
                let mut cmd = RunasCommand::new(service_path.as_path());
                cmd.args(&["stop"]);
                cmd.gui(false).show(false);
                cmd.status()
                    .map(|status| (status, String::new()))
                    .map_err(map_privilege_tool_not_found_error)
            }
            #[cfg(target_os = "macos")]
            {
                use crate::utils::sudo::sudo;
                sudo(service_path.to_string_lossy(), &["stop"])
                    .map(|()| (std::process::ExitStatus::from_raw(0), String::new()))
                    .map_err(anyhow::Error::from)
            }
        },
    )
    .await??;
    if !child.success() {
        anyhow::bail!(
            "failed to stop service, exit code: {}, signal: {:?}, output: {}",
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
            },
            output.trim()
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
    let service_path = resolve_service_path();
    let (child, output) = tokio::task::spawn_blocking(move || -> anyhow::Result<(std::process::ExitStatus, String)> {
        let service_path = service_path;
        #[cfg(not(target_os = "macos"))]
        {
            #[cfg(all(unix, not(target_os = "macos")))]
            let status = {
                let service = service_path.to_string_lossy();
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
                    .map(|status| (status, String::new()))
                    .map_err(map_privilege_tool_not_found_error)
            };

            #[cfg(not(all(unix, not(target_os = "macos"))))]
            let status = {
                #[cfg(windows)]
                {
                    run_service_command(service_path.as_path(), &["restart".into()])
                }
                #[cfg(not(windows))]
                {
                    RunasCommand::new(service_path.as_path())
                        .args(&["restart"])
                        .gui(false)
                        .show(false)
                        .status()
                        .map(|status| (status, String::new()))
                        .map_err(map_privilege_tool_not_found_error)
                }
            };

            status
        }
        #[cfg(target_os = "macos")]
        {
            use crate::utils::sudo::sudo;
            const ARGS: &[&str] = &["restart"];
            sudo(service_path.to_string_lossy(), ARGS)
                .map(|()| (std::process::ExitStatus::from_raw(0), String::new()))
                .map_err(anyhow::Error::from)
        }
    })
    .await??;
    if !child.success() {
        anyhow::bail!(
            "failed to restart service, exit code: {}, signal: {:?}, output: {}",
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
            },
            output.trim()
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
    let service_path = resolve_service_path();
    // 如果服务可执行文件不存在，返回 not_installed 状态而不是错误
    if !service_path.as_path().exists() {
        tracing::debug!(
            "nyanpasu-service executable not found at: {}, returning not_installed status",
            service_path.display()
        );
        return Ok(nyanpasu_ipc::types::StatusInfo {
            name: std::borrow::Cow::Borrowed(""),
            version: std::borrow::Cow::Borrowed(""),
            status: ServiceStatus::NotInstalled,
            server: None,
        });
    }

    let mut cmd = tokio::process::Command::new(service_path.as_path());
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
