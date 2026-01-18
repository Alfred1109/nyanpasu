use anyhow::Result;
use nyanpasu_ipc::types::ServiceStatus;
use tracing::{error, info, warn};

use crate::core::service::control;

/// 服务配置更新工具函数
/// 提取公共的配置更新逻辑，减少代码重复

/// 更新服务模式配置
pub async fn update_service_mode_config(enable: bool) -> Result<()> {
    let patch = crate::config::nyanpasu::IVerge {
        enable_service_mode: Some(enable),
        ..Default::default()
    };
    crate::feat::patch_verge(patch).await
}


/// 更新TUN模式配置
pub async fn update_tun_config(enable: bool) -> Result<()> {
    let patch = crate::config::nyanpasu::IVerge {
        enable_tun_mode: Some(enable),
        ..Default::default()
    };
    crate::feat::patch_verge(patch).await
}

/// 检查服务是否正在运行
pub async fn is_service_running() -> Result<bool> {
    match control::status().await {
        Ok(status) => Ok(matches!(status.status, ServiceStatus::Running)),
        Err(e) => {
            warn!("无法获取服务状态: {}", e);
            Ok(false)
        }
    }
}

/// 检查服务是否已安装
pub async fn is_service_installed() -> Result<bool> {
    match control::status().await {
        Ok(status) => Ok(!matches!(status.status, ServiceStatus::NotInstalled)),
        Err(e) => {
            warn!("无法获取服务状态: {}", e);
            Ok(false)
        }
    }
}

/// 安全地启动服务（如果未运行）
pub async fn ensure_service_running() -> Result<()> {
    match control::status().await {
        Ok(status) => {
            if matches!(status.status, ServiceStatus::Running) {
                info!("服务已在运行");
                Ok(())
            } else if matches!(status.status, ServiceStatus::Stopped) {
                info!("服务已安装但未运行，尝试启动");
                control::start_service().await
            } else {
                anyhow::bail!("服务未安装，无法启动");
            }
        }
        Err(e) => {
            error!("无法获取服务状态: {}", e);
            Err(e)
        }
    }
}

/// 获取服务状态的用户友好描述
pub async fn get_service_status_message() -> String {
    match control::status().await {
        Ok(status_info) => {
            match status_info.status {
                ServiceStatus::Running => "服务运行中，系统代理和TUN模式可正常使用".to_string(),
                ServiceStatus::Stopped => "服务已安装但未运行".to_string(),
                ServiceStatus::NotInstalled => {
                    "服务未安装，需要安装后才能使用系统代理和TUN模式".to_string()
                }
            }
        }
        Err(e) => {
            warn!("获取服务状态失败: {}", e);
            format!("无法获取服务状态: {}", e)
        }
    }
}

/// 服务操作的统一错误处理
pub fn handle_service_error(operation: &str, error: anyhow::Error) -> String {
    let error_msg = error.to_string();
    error!("{}失败: {}", operation, error_msg);
    
    if error_msg.contains("permission") || error_msg.contains("access") {
        format!("{}失败: 权限不足。请确保有管理员权限。", operation)
    } else if error_msg.contains("not found") || error_msg.contains("not installed") {
        format!("{}失败: 服务未安装或文件缺失。", operation)
    } else {
        format!("{}失败: {}。请检查系统状态或重试。", operation, error_msg)
    }
}
