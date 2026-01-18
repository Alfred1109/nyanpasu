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
    auto_service_setup: bool,
}

static PRIVILEGE_MANAGER: OnceCell<Arc<PrivilegeManager>> = OnceCell::new();

impl PrivilegeManager {
    /// 创建权限管理器实例（纯服务模式）
    pub fn new() -> Self {
        Self {
            service_handler: Some(Arc::new(ServicePrivilegeHandler::new())),
            auto_service_setup: true,
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

    /// 执行服务操作（自动服务生命周期管理）
    async fn execute_service_operation(
        &self,
        operation: PrivilegedOperation,
    ) -> Result<PrivilegedOperationResult> {
        info!("执行服务强制操作: {:?}", operation);

        // 检查是否为关闭操作
        let is_disable_operation = match &operation {
            PrivilegedOperation::SetTunMode { enable } => !enable,
            _ => false,
        };

        // 如果是关闭操作，先执行操作再检查是否需要停止服务
        if is_disable_operation {
            return self.handle_disable_operation(operation).await;
        }

        // 启用操作：检查服务状态
        if let Some(service_handler) = &self.service_handler {
            let mut available = service_handler.is_available().await;

            if !available && self.auto_service_setup {
                info!("服务未运行，尝试自动设置后再执行操作");
                if let Err(e) = self.auto_setup_service().await {
                    warn!("自动设置服务失败: {}", e);
                } else {
                    available = service_handler.is_available().await;
                }
            }

            if available {
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

        // 服务未运行，返回错误提示用户先启动服务
        warn!("服务未启动，无法执行操作");
        Ok(PrivilegedOperationResult {
            success: false,
            message: Some("服务未启动，请先启动服务后再试".to_string()),
            handler_used: "service_not_running".to_string(),
        })
    }

    /// 处理关闭操作并管理服务生命周期
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
                        message: None,
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

                // 检查是否需要停止服务
                if result.as_ref().unwrap().success {
                    self.check_and_stop_service_if_idle().await;
                }

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

    /// 检查并在空闲时停止服务
    async fn check_and_stop_service_if_idle(&self) {
        // 检查是否还有需要服务的功能在运行
        let tun_mode_enabled = {
            let verge = crate::config::Config::verge();
            let config = verge.latest();
            config.enable_tun_mode.unwrap_or(false)
        };

        if !tun_mode_enabled {
            info!("TUN模式已关闭，自动停止服务");

            // 停止服务
            if let Err(e) = crate::core::service::control::stop_service().await {
                warn!("自动停止服务失败: {}", e);
            } else {
                info!("服务已自动停止");
            }
        } else {
            info!("TUN模式仍在使用，保持服务运行");
        }
    }

    /// 自动安装和启动服务
    async fn auto_setup_service(&self) -> Result<()> {
        info!("自动设置服务以支持TUN模式");

        if let Some(service_handler) = &self.service_handler {
            // 检查服务当前状态
            let status = crate::core::service::control::status().await;

            match status {
                Ok(status) => {
                    use nyanpasu_ipc::types::ServiceStatus;
                    match status.status {
                        ServiceStatus::Running => {
                            info!("服务已运行");
                            return Ok(());
                        }
                        ServiceStatus::Stopped => {
                            info!("服务已安装但未运行，尝试启动");
                            return crate::core::service::control::start_service().await;
                        }
                        ServiceStatus::NotInstalled => {
                            info!("服务未安装，开始安装流程");
                            // 继续执行安装逻辑
                        }
                    }
                }
                Err(e) => {
                    warn!("无法检查服务状态，假设需要安装: {}", e);
                }
            }

            // 安装服务
            info!("正在安装nyanpasu服务...");
            match crate::core::service::control::install_service().await {
                Ok(()) => {
                    info!("服务安装成功");

                    // 更新配置启用服务模式
                    let patch = crate::config::nyanpasu::IVerge {
                        enable_service_mode: Some(true),
                        ..Default::default()
                    };

                    if let Err(e) = crate::feat::patch_verge(patch).await {
                        warn!("更新服务模式配置失败: {}", e);
                    } else {
                        info!("服务模式已启用");
                    }

                    // 确保服务正在运行
                    if !service_handler.is_available().await {
                        info!("服务安装完成，但可能需要手动启动");
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

                        if !service_handler.is_available().await {
                            warn!("服务可能未自动启动，尝试手动启动");
                            crate::core::service::control::start_service().await?;
                        }
                    }

                    Ok(())
                }
                Err(e) => {
                    error!("服务安装失败: {}", e);
                    Err(anyhow::anyhow!(
                        "无法安装服务: {}. 系统代理和TUN模式需要服务支持。",
                        e
                    ))
                }
            }
        } else {
            anyhow::bail!("服务功能未编译或不可用")
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
            } else if self.auto_service_setup {
                info!("服务未运行，尝试自动设置");
                let _ = self.auto_setup_service().await;
            }
        }

        // 纯服务模式，无需检查其他权限模式
        info!("权限系统预热完成");

        Ok(())
    }
}
