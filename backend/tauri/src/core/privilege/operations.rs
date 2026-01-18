use anyhow::Result;
use tracing::{info, warn};

use super::{PrivilegedOperation, manager::PrivilegeManager};
use crate::config::Config;

/// 权限操作的便捷函数集合
/// 这些函数提供了简化的API，隐藏了底层的权限管理复杂性

/// 设置TUN模式
pub async fn set_tun_mode(enable: bool) -> Result<()> {
    let operation = PrivilegedOperation::SetTunMode { enable };

    let result = PrivilegeManager::global()
        .execute_operation(operation)
        .await?;

    if !result.success {
        anyhow::bail!(
            "设置TUN模式失败: {}",
            result.message.unwrap_or_else(|| "未知错误".to_string())
        );
    }

    info!("TUN模式设置成功 (处理器: {})", result.handler_used);
    Ok(())
}


/// 切换TUN模式（保持与现有API兼容）
pub async fn toggle_tun_mode() -> Result<()> {
    let current_enable = Config::verge().latest().enable_tun_mode.unwrap_or(false);

    set_tun_mode(!current_enable).await
}

/// 预检权限操作
/// 在执行实际操作前检查权限状态，给用户更好的提示
pub async fn precheck_privilege_operation(operation: &PrivilegedOperation) -> Result<bool> {
    let privilege_manager = PrivilegeManager::global();

    // 检查是否需要用户确认
    let needs_confirmation = privilege_manager.requires_confirmation(operation);

    if needs_confirmation {
        let status = privilege_manager.get_privilege_status().await;

        // 如果服务不可用且需要确认，建议用户设置服务模式
        if !status.service_connected {
            info!("权限操作需要确认，建议启用服务模式以获得更好的体验");
        }
    }

    Ok(needs_confirmation)
}

/// 权限管理初始化
/// 应该在应用启动时调用
pub async fn initialize_privilege_system() -> Result<()> {
    info!("初始化权限管理系统");

    let privilege_manager = PrivilegeManager::global();

    // 预热权限系统
    privilege_manager.warm_up().await?;

    // 检查当前配置
    let status = privilege_manager.get_privilege_status().await;
    info!("权限系统状态: {:?}", status);

    // 如果配置了服务模式但服务不可用，给出提示
    if matches!(
        status.current_mode,
        crate::core::privilege::PrivilegeMode::Service
    ) && !status.service_connected
    {
        warn!("服务模式已启用但服务未运行，某些操作可能需要权限确认");
    }

    Ok(())
}

/// 获取权限操作建议
/// 根据当前系统状态给出权限配置建议
pub async fn get_privilege_recommendations() -> Result<Vec<String>> {
    let privilege_manager = PrivilegeManager::global();
    let status = privilege_manager.get_privilege_status().await;
    let mut recommendations = Vec::new();

    match status.current_mode {
        crate::core::privilege::PrivilegeMode::Service => {
            if !status.service_connected {
                recommendations.push("服务模式已启用但服务未运行，请检查服务状态".to_string());
            } else {
                recommendations.push("服务模式运行良好，享受丝滑的权限管理体验！".to_string());
            }
        }
        crate::core::privilege::PrivilegeMode::Disabled => {
            recommendations.push("权限操作已禁用，某些功能可能无法正常使用".to_string());
        }
    }

    Ok(recommendations)
}
