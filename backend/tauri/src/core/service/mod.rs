use std::path::PathBuf;

use nyanpasu_ipc::types::StatusInfo;
use once_cell::sync::Lazy;

use crate::{config::Config, utils::dirs::app_install_dir};

pub mod control;
pub mod ipc;

const SERVICE_NAME: &str = "nyanpasu-service";

/// Get service executable path with improved resolution logic
pub fn get_service_path() -> anyhow::Result<PathBuf> {
    // Try multiple possible locations in order of preference
    let candidates = get_service_path_candidates()?;

    for path in candidates {
        if path.exists() {
            return Ok(path);
        }
    }

    // If none found, return the most likely fallback
    let app_path = app_install_dir()?;
    Ok(app_path.join(format!("{}{}", SERVICE_NAME, std::env::consts::EXE_SUFFIX)))
}

fn get_service_path_candidates() -> anyhow::Result<Vec<PathBuf>> {
    let app_path = app_install_dir()?;
    let mut candidates = Vec::new();

    // 1. Try sidecar directory (development/unpacked)
    candidates.push(app_path.join("sidecar").join(format!(
        "{}{}",
        SERVICE_NAME,
        std::env::consts::EXE_SUFFIX
    )));

    // 2. Try app directory (same folder as main exe)
    candidates.push(app_path.join(format!("{}{}", SERVICE_NAME, std::env::consts::EXE_SUFFIX)));

    // 3. Try installed service location (Windows)
    #[cfg(windows)]
    {
        if let Some(program_data) = std::env::var_os("PROGRAMDATA") {
            let program_data_path = PathBuf::from(program_data)
                .join("nyanpasu-service")
                .join("data")
                .join(format!("{}{}", SERVICE_NAME, std::env::consts::EXE_SUFFIX));
            candidates.push(program_data_path);
        }
    }

    Ok(candidates)
}

static SERVICE_PATH: Lazy<PathBuf> = Lazy::new(|| {
    get_service_path().unwrap_or_else(|_| {
        // Final fallback
        app_install_dir()
            .unwrap_or_else(|_| {
                std::env::current_exe()
                    .unwrap()
                    .parent()
                    .unwrap()
                    .to_path_buf()
            })
            .join(format!("{}{}", SERVICE_NAME, std::env::consts::EXE_SUFFIX))
    })
});

pub async fn init_service() {
    let enable_service = {
        *Config::verge()
            .latest()
            .enable_service_mode
            .as_ref()
            .unwrap_or(&false)
    };
    if let Ok(StatusInfo {
        status: nyanpasu_ipc::types::ServiceStatus::Running,
        ..
    }) = control::status().await
        && enable_service
    {
        ipc::spawn_health_check();
        while !ipc::HEALTH_CHECK_RUNNING.load(std::sync::atomic::Ordering::Acquire) {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
    }
}
