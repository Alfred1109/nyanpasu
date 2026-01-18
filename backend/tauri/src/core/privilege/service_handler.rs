use anyhow::Result;
use tracing::info;

use super::{PrivilegedOperation, PrivilegedOperationHandler, service_utils};
use crate::core::service::{control, ipc};

/// 服务模式权限处理器
pub struct ServicePrivilegeHandler {
    // 可以添加配置和状态管理
}

impl ServicePrivilegeHandler {
    pub fn new() -> Self {
        Self {}
    }

    /// 通过IPC发送权限操作到服务
    async fn send_privileged_command(&self, operation: &PrivilegedOperation) -> Result<()> {
        // 这里需要扩展nyanpasu-ipc来支持权限操作
        // 现在先使用现有的服务控制功能作为基础

        match operation {
            PrivilegedOperation::SetTunMode { enable } => {
                self.set_tun_mode_via_service(*enable).await
            }
            PrivilegedOperation::UpdateCorePermissions { core_path } => {
                self.update_core_permissions_via_service(core_path.clone())
                    .await
            }
            PrivilegedOperation::ModifyNetworkSettings { dns } => {
                self.modify_network_settings_via_service(dns.clone()).await
            }
        }
    }


    async fn set_tun_mode_via_service(&self, enable: bool) -> Result<()> {
        info!("通过服务设置TUN模式: enable={}", enable);

        // 1. 更新配置
        service_utils::update_tun_config(enable).await?;

        // 2. 通过服务重启核心（TUN模式需要特权）
        self.request_core_restart().await?;

        Ok(())
    }

    async fn update_core_permissions_via_service(
        &self,
        _core_path: std::path::PathBuf,
    ) -> Result<()> {
        info!("通过服务更新核心权限");

        // 服务模式下，核心由服务管理，权限由服务处理
        // 这里可以发送重新安装或更新核心权限的请求

        // 暂时使用重启服务来重新设置权限
        control::restart_service().await?;

        Ok(())
    }

    async fn modify_network_settings_via_service(&self, _dns: Option<Vec<String>>) -> Result<()> {
        info!("通过服务修改网络设置");

        // 未来可以实现DNS设置等网络相关操作
        // 现在先返回成功

        Ok(())
    }

    /// 请求服务重启核心
    async fn request_core_restart(&self) -> Result<()> {
        // 使用工具函数确保服务运行
        service_utils::ensure_service_running().await?;
        info!("服务正在运行，配置更改将自动应用");
        Ok(())
    }

    /// 检查服务是否支持特定操作
    fn supports_operation(&self, operation: &PrivilegedOperation) -> bool {
        match operation {
            PrivilegedOperation::SetTunMode { .. } => true,
            PrivilegedOperation::UpdateCorePermissions { .. }
            | PrivilegedOperation::ModifyNetworkSettings { .. } => {
                // 这些操作需要更多的服务端支持
                false
            }
        }
    }
}

#[async_trait::async_trait]
impl PrivilegedOperationHandler for ServicePrivilegeHandler {
    async fn execute(&self, operation: PrivilegedOperation) -> Result<()> {
        if !self.supports_operation(&operation) {
            anyhow::bail!("服务不支持此操作: {:?}", operation);
        }

        self.send_privileged_command(&operation).await
    }

    async fn is_available(&self) -> bool {
        // 检查IPC连接状态
        let ipc_state = ipc::get_ipc_state();
        if !ipc_state.is_connected() {
            return false;
        }

        // 检查服务状态
        service_utils::is_service_running().await.unwrap_or(false)
    }

    fn name(&self) -> &'static str {
        "service"
    }

    fn requires_confirmation(&self, operation: &PrivilegedOperation) -> bool {
        // 服务模式下，大部分常见操作不需要用户确认
        match operation {
            PrivilegedOperation::SetTunMode { .. } => false,
            _ => true, // 高级操作仍需确认
        }
    }
}
