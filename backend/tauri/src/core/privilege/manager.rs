use anyhow::Result;
use once_cell::sync::OnceCell;
use std::sync::Arc;
use tracing::{error, info, warn};

use super::{
    PrivilegeMode, PrivilegeStatus, PrivilegedOperation, PrivilegedOperationHandler,
    PrivilegedOperationResult, service_handler::ServicePrivilegeHandler,
};

/// 全局权限管理器（纯服务模式）
pub struct PrivilegeManager {
    pub(crate) service_handler: Option<Arc<ServicePrivilegeHandler>>,
}

static PRIVILEGE_MANAGER: OnceCell<Arc<PrivilegeManager>> = OnceCell::new();

impl PrivilegeManager {
    /// 创建权限管理器实例（纯服务模式）
    pub fn new() -> Self {
        Self {
            service_handler: Some(Arc::new(ServicePrivilegeHandler::new())),
        }
    }

    /// 获取全局实例
    pub fn global() -> &'static Arc<PrivilegeManager> {
        PRIVILEGE_MANAGER.get_or_init(|| Arc::new(Self::new()))
    }

    /// 执行权限操作（纯服务模式）
    pub async fn execute_operation(
        &self,
        operation: PrivilegedOperation,
    ) -> Result<PrivilegedOperationResult> {
        info!("执行权限操作: {:?}", operation);

        // 所有操作都通过服务处理
        self.execute_service_operation(operation).await
    }

    /// 执行服务操作（仅检查状态，不自动管理服务）
    async fn execute_service_operation(
        &self,
        operation: PrivilegedOperation,
    ) -> Result<PrivilegedOperationResult> {
        info!("执行服务操作: {:?}", operation);

        // 检查是否为关闭操作
        let is_disable_operation = match &operation {
            PrivilegedOperation::SetTunMode { enable } => !enable,
            _ => false,
        };

        // 如果是关闭操作，提示用户手动关闭服务
        if is_disable_operation {
            return self.handle_disable_operation(operation).await;
        }

        // 启用操作：检查服务状态
        if let Some(service_handler) = &self.service_handler {
            if service_handler.is_available().await {
                // 服务已运行，直接执行
                return match service_handler.execute(operation).await {
                    Ok(()) => Ok(PrivilegedOperationResult {
                        success: true,
                        message: None,
                        handler_used: service_handler.name().to_string(),
                    }),
                    Err(e) => {
                        error!("服务执行操作失败: {}", e);
                        Ok(PrivilegedOperationResult {
                            success: false,
                            message: Some(format!("操作失败: {}", e)),
                            handler_used: service_handler.name().to_string(),
                        })
                    }
                };
            }
        }

        // 检查服务状态并返回相应提示
        match crate::core::service::control::status().await {
            Ok(status) => {
                use nyanpasu_ipc::types::ServiceStatus;
                match status.status {
                    ServiceStatus::NotInstalled => {
                        warn!("服务未安装，无法执行TUN模式操作");
                        Ok(PrivilegedOperationResult {
                            success: false,
                            message: Some("TUN模式需要系统服务支持，请先安装服务".to_string()),
                            handler_used: "service_not_installed".to_string(),
                        })
                    }
                    ServiceStatus::Stopped => {
                        warn!("服务未启动，无法执行TUN模式操作");
                        Ok(PrivilegedOperationResult {
                            success: false,
                            message: Some("TUN模式需要服务运行，请先启动服务".to_string()),
                            handler_used: "service_not_running".to_string(),
                        })
                    }
                    ServiceStatus::Running => {
                        // 服务正在运行但IPC连接可能还没建立，等待一下再重试
                        warn!("服务正在运行但IPC连接未就绪，请稍后重试");
                        Ok(PrivilegedOperationResult {
                            success: false,
                            message: Some("服务正在启动中，请稍后重试".to_string()),
                            handler_used: "service_starting".to_string(),
                        })
                    }
                }
            }
            Err(e) => {
                error!("无法获取服务状态: {}", e);
                Ok(PrivilegedOperationResult {
                    success: false,
                    message: Some("无法获取服务状态，请检查服务是否正确安装".to_string()),
                    handler_used: "service_status_error".to_string(),
                })
            }
        }
    }

    /// 处理关闭操作（仅执行操作，不自动管理服务）
    async fn handle_disable_operation(
        &self,
        operation: PrivilegedOperation,
    ) -> Result<PrivilegedOperationResult> {
        // 先执行关闭操作
        if let Some(service_handler) = &self.service_handler {
            if service_handler.is_available().await {
                let result = match service_handler.execute(operation).await {
                    Ok(()) => Ok(PrivilegedOperationResult {
                        success: true,
                        message: Some("TUN模式已关闭。建议关闭服务以节省系统资源。".to_string()),
                        handler_used: service_handler.name().to_string(),
                    }),
                    Err(e) => {
                        error!("关闭操作失败: {}", e);
                        Ok(PrivilegedOperationResult {
                            success: false,
                            message: Some(format!("操作失败: {}", e)),
                            handler_used: service_handler.name().to_string(),
                        })
                    }
                };

                return result;
            }
        }

        // 服务不可用时，尝试直接更新配置
        warn!("服务不可用，直接更新配置");
        match &operation {
            PrivilegedOperation::SetTunMode { .. } => {
                // 更新配置关闭TUN模式
                let patch = crate::config::nyanpasu::IVerge {
                    enable_tun_mode: Some(false),
                    ..Default::default()
                };

                match crate::feat::patch_verge(patch).await {
                    Ok(()) => Ok(PrivilegedOperationResult {
                        success: true,
                        message: Some("已关闭TUN模式配置".to_string()),
                        handler_used: "config_direct".to_string(),
                    }),
                    Err(e) => Ok(PrivilegedOperationResult {
                        success: false,
                        message: Some(format!("配置更新失败: {}", e)),
                        handler_used: "config_direct".to_string(),
                    }),
                }
            }
            _ => Ok(PrivilegedOperationResult {
                success: false,
                message: Some("不支持的操作".to_string()),
                handler_used: "unsupported".to_string(),
            }),
        }
    }


    /// 获取权限状态（纯服务模式）
    pub async fn get_privilege_status(&self) -> PrivilegeStatus {
        let service_available = self.service_handler.is_some();
        let service_connected = if let Some(handler) = &self.service_handler {
            handler.is_available().await
        } else {
            false
        };

        PrivilegeStatus {
            service_available,
            service_connected,
            current_mode: PrivilegeMode::Service,
        }
    }

    /// 检查权限操作是否需要确认（纯服务模式）
    pub fn requires_confirmation(&self, operation: &PrivilegedOperation) -> bool {
        // 服务模式下大部分操作不需要确认
        if let Some(handler) = &self.service_handler {
            handler.requires_confirmation(operation)
        } else {
            true // 服务不可用时需要确认（提示安装服务）
        }
    }

    /// 预热权限系统
    pub async fn warm_up(&self) -> Result<()> {
        info!("预热权限管理系统");

        // 检查服务状态
        if let Some(service_handler) = &self.service_handler {
            if service_handler.is_available().await {
                info!("服务模式已就绪");
            } else {
                info!("服务未运行，需要手动启动服务以使用TUN模式");
            }
        }

        // 纯服务模式，无需检查其他权限模式
        info!("权限系统预热完成");

        Ok(())
    }
}
