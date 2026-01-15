use std::path::PathBuf;

use nyanpasu_ipc::types::StatusInfo;
use once_cell::sync::Lazy;

use crate::{config::Config, utils::dirs::app_install_dir};

pub mod control;
pub mod ipc;

const SERVICE_NAME: &str = "nyanpasu-service";
static SERVICE_PATH: Lazy<PathBuf> = Lazy::new(|| {
    let app_path = app_install_dir().unwrap();

    let sidecar_path =
        app_path
            .join("sidecar")
            .join(format!("{}{}", SERVICE_NAME, std::env::consts::EXE_SUFFIX));
    if sidecar_path.exists() {
        return sidecar_path;
    }

    let app_local_path = app_path.join(format!("{}{}", SERVICE_NAME, std::env::consts::EXE_SUFFIX));
    if app_local_path.exists() {
        return app_local_path;
    }

    #[cfg(windows)]
    {
        let program_data = std::env::var_os("PROGRAMDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"));
        let program_data_path = program_data
            .join("nyanpasu-service")
            .join("data")
            .join(format!("{}{}", SERVICE_NAME, std::env::consts::EXE_SUFFIX));
        if program_data_path.exists() {
            return program_data_path;
        }
    }

    app_local_path
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
