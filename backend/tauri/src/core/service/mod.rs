use std::path::PathBuf;

use nyanpasu_ipc::types::StatusInfo;
use once_cell::sync::Lazy;

use crate::{config::Config, utils::dirs::app_install_dir};

pub mod control;
pub mod ipc;

const SERVICE_NAME: &str = "nyanpasu-service";
const SERVICE_TARGET_TRIPLE: Option<&str> = option_env!("TAURI_ENV_TARGET_TRIPLE");

fn service_file_names() -> Vec<String> {
    let mut names = Vec::new();
    names.push(format!("{}{}", SERVICE_NAME, std::env::consts::EXE_SUFFIX));

    if let Some(triple) = SERVICE_TARGET_TRIPLE {
        names.push(format!(
            "{}-{}{}",
            SERVICE_NAME,
            triple,
            std::env::consts::EXE_SUFFIX
        ));
    }

    names
}

/// Get service executable path with improved resolution logic
pub fn get_service_path() -> anyhow::Result<PathBuf> {
    // Try multiple possible locations in order of preference
    let candidates = get_service_path_candidates()?;

    tracing::debug!(
        "🔍 Searching for nyanpasu-service executable in {} locations",
        candidates.len()
    );

    for (i, path) in candidates.iter().enumerate() {
        tracing::debug!("  {}: {:?} - exists: {}", i + 1, path, path.exists());
        if path.exists() {
            tracing::info!("✅ Found nyanpasu-service at: {:?}", path);
            return Ok(path.clone());
        }
    }

    // If none found, return the most likely fallback
    let app_path = app_install_dir()?;
    let fallback_path = app_path.join(format!("{}{}", SERVICE_NAME, std::env::consts::EXE_SUFFIX));
    tracing::warn!(
        "❌ Service executable not found in any candidate location. Using fallback: {:?}",
        fallback_path
    );
    Ok(fallback_path)
}

fn get_service_path_candidates() -> anyhow::Result<Vec<PathBuf>> {
    let mut candidates = Vec::new();

    // 1. Try current exe directory first (most reliable in development)
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            // Development: backend/target/debug/sidecar/
            for file_name in service_file_names() {
                candidates.push(exe_dir.join("sidecar").join(&file_name));
            }
            // Production: same directory as exe
            for file_name in service_file_names() {
                candidates.push(exe_dir.join(&file_name));
            }
        }
    }

    // 2. Try common installation paths
    #[cfg(windows)]
    {
        // Program Files installation path
        if let Some(program_files) = std::env::var_os("PROGRAMFILES") {
            for file_name in service_file_names() {
                let program_files_path = PathBuf::from(&program_files)
                    .join("nyanpasu")
                    .join(&file_name);
                candidates.push(program_files_path);
            }
        }
    }

    // 3. Try app install directory with sidecar subdirectory
    if let Ok(app_path) = app_install_dir() {
        for file_name in service_file_names() {
            candidates.push(app_path.join("sidecar").join(&file_name));
        }

        // 4. Try app directory (same folder as main exe)
        for file_name in service_file_names() {
            candidates.push(app_path.join(&file_name));
        }
    }

    // 5. Try installed service location (Windows)
    #[cfg(windows)]
    {
        if let Some(program_data) = std::env::var_os("PROGRAMDATA") {
            for file_name in service_file_names() {
                let program_data_path = PathBuf::from(&program_data)
                    .join("nyanpasu-service")
                    .join("data")
                    .join(&file_name);
                candidates.push(program_data_path);
            }
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
