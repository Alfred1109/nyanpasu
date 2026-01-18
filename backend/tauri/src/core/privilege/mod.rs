use anyhow::Result;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;

pub mod ipc_commands;
pub mod manager;
pub mod operations;
pub mod service_handler;
pub mod service_utils;
pub mod simple_service;

/// 需要特权的操作类型
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", content = "data")]
pub enum PrivilegedOperation {
    /// 设置TUN模式
    SetTunMode { enable: bool },
    /// 修改网络设置
    ModifyNetworkSettings { dns: Option<Vec<String>> },
    /// 更新核心权限
    UpdateCorePermissions { core_path: PathBuf },
}

/// 特权操作处理器接口
#[async_trait::async_trait]
pub trait PrivilegedOperationHandler: Send + Sync {
    /// 执行特权操作
    async fn execute(&self, operation: PrivilegedOperation) -> Result<()>;

    /// 检查处理器是否可用
    async fn is_available(&self) -> bool;

    /// 获取处理器名称
    fn name(&self) -> &'static str;

    /// 检查是否需要用户确认
    fn requires_confirmation(&self, operation: &PrivilegedOperation) -> bool {
        match operation {
            PrivilegedOperation::SetTunMode { .. } => false,
            _ => true,
        }
    }
}

/// 权限操作结果
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PrivilegedOperationResult {
    pub success: bool,
    pub message: Option<String>,
    pub handler_used: String,
}

/// 权限状态（纯服务模式）
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PrivilegeStatus {
    pub service_available: bool,
    pub service_connected: bool,
    pub current_mode: PrivilegeMode,
}

/// 权限模式（已简化为纯服务模式）
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq)]
pub enum PrivilegeMode {
    /// 服务模式（唯一模式）
    Service,
    /// 禁用权限操作
    Disabled,
}

impl Default for PrivilegeMode {
    fn default() -> Self {
        Self::Service
    }
}
