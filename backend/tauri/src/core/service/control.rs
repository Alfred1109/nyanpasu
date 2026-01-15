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
    let program_wide: Vec<u16> = OsStr::new(program).encode_wide().chain(Some(0)).collect();
    let args_str = args
        .iter()
        .map(escape_windows_cmd_arg)
        .collect::<Vec<_>>()
        .join(" ");
    let args_wide: Vec<u16> = OsStr::new(&args_str).encode_wide().chain(Some(0)).collect();

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
        // ShellExecuteW returns a handle > 32 on success
        // Since we can't easily wait for the process, return success
        Ok(std::process::ExitStatus::from_raw(0))
    } else {
        Err(std::io::Error::from_raw_os_error(result as i32))
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
    if let Ok(info) = status().await {
        if !matches!(info.status, ServiceStatus::NotInstalled) {
            return Ok(());
        }
    }
    let args = get_service_install_args().await?;
    if !SERVICE_PATH.as_path().exists() {
        anyhow::bail!(
            "nyanpasu-service executable not found at: {}",
            SERVICE_PATH.display()
        );
    }
    let child = tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            run_elevated(SERVICE_PATH.as_path(), &args, true)
        }
        #[cfg(all(not(windows), not(target_os = "macos")))]
        {
            let mut cmd = RunasCommand::new(SERVICE_PATH.as_path());
            cmd.args(&args);
            cmd.gui(false).show(false);
            cmd.status()
        }
        #[cfg(target_os = "macos")]
        {
            use crate::utils::sudo::sudo;
            let args = args.iter().map(|s| s.to_string_lossy()).collect::<Vec<_>>();
            match sudo(SERVICE_PATH.to_string_lossy(), &args) {
                Ok(()) => Ok(std::process::ExitStatus::from_raw(0)),
                Err(e) => {
                    tracing::error!("failed to install service: {}", e);
                    Err(e)
                }
            }
        }
    })
    .await??;
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
    // Due to most platform, the service will be started automatically after installed
    if !super::ipc::HEALTH_CHECK_RUNNING.load(std::sync::atomic::Ordering::Relaxed) {
        super::ipc::spawn_health_check();
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
    if !super::ipc::HEALTH_CHECK_RUNNING.load(std::sync::atomic::Ordering::Acquire) {
        super::ipc::spawn_health_check();
    }
    Ok(())
}

pub async fn stop_service() -> anyhow::Result<()> {
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
    if !super::ipc::HEALTH_CHECK_RUNNING.load(std::sync::atomic::Ordering::Acquire) {
        super::ipc::spawn_health_check();
    }
    Ok(())
}

#[tracing::instrument]
pub async fn status<'a>() -> anyhow::Result<nyanpasu_ipc::types::StatusInfo<'a>> {
    if !SERVICE_PATH.as_path().exists() {
        anyhow::bail!(
            "nyanpasu-service executable not found at: {}",
            SERVICE_PATH.display()
        );
    }
    let mut cmd = tokio::process::Command::new(SERVICE_PATH.as_path());
    cmd.args(["status", "--json"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    let output = cmd.output().await?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("Permission denied") || stderr.contains("os error 13") {
        anyhow::bail!(
            "failed to query service status: permission denied. Ensure the current user has access to the service IPC socket (e.g. re-login after adding to the nyanpasu group). Details: {}",
            stderr.trim()
        );
    }
    if !output.status.success() {
        anyhow::bail!(
            "failed to query service status, exit code: {}, signal: {:?}",
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
            }
        );
    }
    let mut status = String::from_utf8(output.stdout)?;
    tracing::trace!("service status: {}", status);
    Ok(serde_json::from_str(&mut status)?)
}
