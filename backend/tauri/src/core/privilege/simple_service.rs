use anyhow::Result;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::command;
use tracing::{error, info, warn};

use super::service_utils;
use crate::core::service::control;
use nyanpasu_ipc::types::ServiceStatus;

#[command]
#[specta::specta]
pub async fn service_status<'a>() -> Result<nyanpasu_ipc::types::StatusInfo<'a>, String> {
    control::status().await.map_err(|e| e.to_string())
}

#[command]
#[specta::specta]
pub async fn service_install() -> Result<(), String> {
    control::install_service().await.map_err(|e| e.to_string())
}

#[command]
#[specta::specta]
pub async fn service_uninstall() -> Result<(), String> {
    control::uninstall_service()
        .await
        .map_err(|e| e.to_string())
}

#[command]
#[specta::specta]
pub async fn service_start() -> Result<(), String> {
    control::start_service().await.map_err(|e| e.to_string())
}

#[command]
#[specta::specta]
pub async fn service_stop() -> Result<(), String> {
    control::stop_service().await.map_err(|e| e.to_string())
}

#[command]
#[specta::specta]
pub async fn service_restart() -> Result<(), String> {
    control::restart_service().await.map_err(|e| e.to_string())
}

/// 简化的服务状态信息
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SimpleServiceStatus {
    /// 服务是否已安装
    pub installed: bool,
    /// 服务当前状态
    pub status: ServiceStatus,
    /// 服务版本信息
    pub version: Option<String>,
    /// 状态描述消息
    pub message: String,
}

/// 获取简化的服务状态
#[command]
#[specta::specta]
pub async fn service_status_summary() -> Result<SimpleServiceStatus, String> {
    match control::status().await {
        Ok(status_info) => {
            let message = service_utils::get_service_status_message().await;

            Ok(SimpleServiceStatus {
                installed: service_utils::is_service_installed().await.unwrap_or(false),
                status: status_info.status,
                version: status_info.server.map(|s| s.version.to_string()),
                message,
            })
        }
        Err(e) => {
            warn!("获取服务状态失败: {}", e);
            Ok(SimpleServiceStatus {
                installed: false,
                status: ServiceStatus::NotInstalled,
                version: None,
                message: format!("无法获取服务状态: {}", e),
            })
        }
    }
}

/// 安装服务（一键安装并启用服务模式）
#[command]
#[specta::specta]
pub async fn service_setup() -> Result<String, String> {
    info!("开始一键安装服务");

    // 检查当前状态
    let current_status = service_status_summary().await?;
    if current_status.installed && service_utils::is_service_running().await.unwrap_or(false) {
        return Ok("服务已安装并运行中".to_string());
    }

    info!("准备安装服务，即将请求UAC权限...");

    // 执行安装 - 这里会触发UAC对话框
    match control::install_service().await {
        Ok(()) => {
            info!("服务安装命令执行完成，开始验证安装状态...");

            // 启用服务模式配置
            if let Err(e) = service_utils::update_service_mode_config(true).await {
                warn!("更新服务模式配置失败: {}", e);
            }

            // 等待并验证服务安装状态 - 增加等待时间
            info!("等待服务安装完成...");
            for i in 0..30 {
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;

                let status = service_status_summary().await?;
                info!(
                    "安装验证 {}/30: installed={}, running={}",
                    i + 1,
                    status.installed,
                    service_utils::is_service_running().await.unwrap_or(false)
                );

                if status.installed {
                    info!("服务安装验证成功！");

                    // 尝试启动服务
                    if !service_utils::is_service_running().await.unwrap_or(false) {
                        info!("服务已安装但未运行，尝试启动...");
                        if let Err(e) = control::start_service().await {
                            warn!("启动服务失败: {}", e);
                            return Ok("✅ 服务安装成功，但启动失败。请手动启动服务。".to_string());
                        }

                        // 等待服务启动
                        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                    }

                    return Ok("✅ 服务安装成功！现在可以享受丝滑的TUN模式体验。".to_string());
                }
            }

            // 安装超时
            warn!("服务安装验证超时");
            Ok("服务安装可能成功，但验证超时。请检查服务状态。".to_string())
        }
        Err(e) => {
            error!("服务安装失败: {}", e);
            Err(service_utils::handle_service_error("服务安装", e))
        }
    }
}

/// 卸载服务
#[command]
#[specta::specta]
pub async fn service_remove() -> Result<String, String> {
    info!("开始卸载服务");

    // 检查当前状态
    let current_status = service_status_summary().await?;
    if !current_status.installed {
        return Ok("服务未安装，无需卸载".to_string());
    }

    // 先停止服务（如果正在运行）
    if matches!(current_status.status, ServiceStatus::Running) {
        info!("正在停止服务...");
        if let Err(e) = control::stop_service().await {
            warn!("停止服务失败，继续卸载: {}", e);
        }
    }

    // 执行卸载
    match control::uninstall_service().await {
        Ok(()) => {
            info!("服务卸载成功");

            // 禁用服务模式配置
            if let Err(e) = service_utils::update_service_mode_config(false).await {
                warn!("更新服务模式配置失败: {}", e);
            }

            Ok("✅ 服务卸载成功。系统代理和TUN模式将需要UAC权限确认。".to_string())
        }
        Err(e) => {
            error!("服务卸载失败: {}", e);
            Err(service_utils::handle_service_error("服务卸载", e))
        }
    }
}

/// 检查是否需要显示服务管理提示
#[command]
#[specta::specta]
pub async fn service_recommendation() -> Result<ServiceRecommendation, String> {
    let (tun_mode_enabled, service_mode_enabled) = {
        let verge = crate::config::Config::verge();
        let config = verge.latest();
        (
            config.enable_tun_mode.unwrap_or(false),
            config.enable_service_mode.unwrap_or(false),
        )
    };

    // 如果用户使用了TUN模式，但服务未安装，则推荐安装
    if tun_mode_enabled && !service_mode_enabled {
        let status = service_status_summary().await?;
        if !status.installed {
            return Ok(ServiceRecommendation {
                should_recommend: true,
                title: "建议安装服务模式".to_string(),
                message: "检测到您正在使用TUN模式。安装服务模式可以避免频繁的UAC权限确认，获得更好的使用体验。".to_string(),
                benefits: vec![
                    "无需每次确认UAC权限".to_string(),
                    "更快的代理切换速度".to_string(),
                    "更稳定的权限管理".to_string(),
                    "符合系统安全最佳实践".to_string(),
                ],
                action_text: "一键安装服务".to_string(),
            });
        }
    }

    Ok(ServiceRecommendation {
        should_recommend: false,
        title: "".to_string(),
        message: "".to_string(),
        benefits: vec![],
        action_text: "".to_string(),
    })
}

/// 服务推荐信息
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ServiceRecommendation {
    /// 是否应该推荐安装服务
    pub should_recommend: bool,
    /// 推荐标题
    pub title: String,
    /// 推荐消息
    pub message: String,
    /// 服务优势列表
    pub benefits: Vec<String>,
    /// 操作按钮文字
    pub action_text: String,
}

/// 获取服务管理操作建议
#[command]
#[specta::specta]
pub async fn service_action() -> Result<ServiceAction, String> {
    let status = service_status_summary().await?;

    let action = if !status.installed {
        ServiceActionType::Install
    } else {
        ServiceActionType::Uninstall
    };

    let button_text = match action {
        ServiceActionType::Install => "安装服务".to_string(),
        ServiceActionType::Uninstall => "卸载服务".to_string(),
    };

    let description = match (&action, &status.status) {
        (ServiceActionType::Install, _) => {
            "安装服务后，系统代理和TUN模式切换将无需UAC确认，提供丝滑的使用体验".to_string()
        }
        (ServiceActionType::Uninstall, ServiceStatus::Running) => {
            "服务运行中。卸载后系统代理和TUN模式将需要UAC权限确认".to_string()
        }
        (ServiceActionType::Uninstall, ServiceStatus::Stopped) => {
            "服务已安装但未运行。可以卸载以完全移除服务".to_string()
        }
        (ServiceActionType::Uninstall, ServiceStatus::NotInstalled) => "服务未安装".to_string(),
    };

    Ok(ServiceAction {
        action,
        button_text,
        description,
        status: status.status,
        is_busy: false,
    })
}

/// 服务操作类型
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum ServiceActionType {
    Install,
    Uninstall,
}

/// 服务操作信息
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ServiceAction {
    /// 当前应该执行的操作
    pub action: ServiceActionType,
    /// 按钮显示文字
    pub button_text: String,
    /// 操作描述
    pub description: String,
    /// 当前服务状态
    pub status: ServiceStatus,
    /// 是否正在执行操作
    pub is_busy: bool,
}
