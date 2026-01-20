/**
 * 统一Rust错误处理模块
 * 标准化20+文件中重复的Result返回模式和错误处理逻辑
 */

use std::{fmt, io};
use anyhow::{Context, Result as AnyhowResult};
use serde::{Deserialize, Serialize};
use specta::Type;

/// 应用级标准Result类型
pub type AppResult<T> = AnyhowResult<T>;

/// 统一的错误类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", content = "data")]
pub enum AppError {
    /// 配置相关错误
    Config { message: String, source: Option<String> },
    /// 网络请求错误
    Network { message: String, status_code: Option<u16> },
    /// 文件系统错误
    FileSystem { message: String, path: Option<String> },
    /// 权限错误
    Permission { message: String, required: String },
    /// 服务相关错误
    Service { message: String, service: String },
    /// 解析错误
    Parse { message: String, format: String },
    /// 验证错误
    Validation { message: String, field: Option<String> },
    /// 外部命令执行错误
    Command { message: String, exit_code: Option<i32> },
    /// 超时错误
    Timeout { message: String, duration_ms: u64 },
    /// 通用错误
    Generic { message: String },
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Config { message, source } => {
                if let Some(source) = source {
                    write!(f, "Config error: {} (source: {})", message, source)
                } else {
                    write!(f, "Config error: {}", message)
                }
            }
            AppError::Network { message, status_code } => {
                if let Some(code) = status_code {
                    write!(f, "Network error: {} (status: {})", message, code)
                } else {
                    write!(f, "Network error: {}", message)
                }
            }
            AppError::FileSystem { message, path } => {
                if let Some(path) = path {
                    write!(f, "File system error: {} (path: {})", message, path)
                } else {
                    write!(f, "File system error: {}", message)
                }
            }
            AppError::Permission { message, required } => {
                write!(f, "Permission error: {} (required: {})", message, required)
            }
            AppError::Service { message, service } => {
                write!(f, "Service error: {} (service: {})", message, service)
            }
            AppError::Parse { message, format } => {
                write!(f, "Parse error: {} (format: {})", message, format)
            }
            AppError::Validation { message, field } => {
                if let Some(field) = field {
                    write!(f, "Validation error: {} (field: {})", message, field)
                } else {
                    write!(f, "Validation error: {}", message)
                }
            }
            AppError::Command { message, exit_code } => {
                if let Some(code) = exit_code {
                    write!(f, "Command error: {} (exit code: {})", message, code)
                } else {
                    write!(f, "Command error: {}", message)
                }
            }
            AppError::Timeout { message, duration_ms } => {
                write!(f, "Timeout error: {} ({}ms)", message, duration_ms)
            }
            AppError::Generic { message } => {
                write!(f, "Error: {}", message)
            }
        }
    }
}

impl std::error::Error for AppError {}

/// 标准错误处理trait
pub trait StandardErrorHandler<T> {
    /// 转换为应用标准Result
    fn to_app_result(self) -> AppResult<T>;
    
    /// 转换为应用标准Result并添加上下文
    fn to_app_result_with_context<F>(self, f: F) -> AppResult<T>
    where
        F: FnOnce() -> String;
}

impl<T, E> StandardErrorHandler<T> for Result<T, E>
where
    E: std::error::Error + Send + Sync + 'static,
{
    fn to_app_result(self) -> AppResult<T> {
        self.map_err(|e| anyhow::Error::from(e))
    }
    
    fn to_app_result_with_context<F>(self, f: F) -> AppResult<T>
    where
        F: FnOnce() -> String,
    {
        self.map_err(|e| anyhow::Error::from(e)).with_context(f)
    }
}

impl<T> StandardErrorHandler<T> for Option<T> {
    fn to_app_result(self) -> AppResult<T> {
        self.ok_or_else(|| anyhow::anyhow!("Value is None"))
    }
    
    fn to_app_result_with_context<F>(self, f: F) -> AppResult<T>
    where
        F: FnOnce() -> String,
    {
        self.ok_or_else(|| anyhow::anyhow!("Value is None"))
            .with_context(f)
    }
}

/// 便捷的错误构造函数
pub mod error_constructors {
    use super::AppError;
    use anyhow::Result;

    pub fn config_error(message: impl Into<String>) -> anyhow::Error {
        anyhow::Error::msg(format!("Config error: {}", message.into()))
    }

    pub fn network_error(message: impl Into<String>, status_code: Option<u16>) -> anyhow::Error {
        let msg = if let Some(code) = status_code {
            format!("Network error: {} (status: {})", message.into(), code)
        } else {
            format!("Network error: {}", message.into())
        };
        anyhow::Error::msg(msg)
    }

    pub fn file_error(message: impl Into<String>, path: Option<&str>) -> anyhow::Error {
        let msg = if let Some(path) = path {
            format!("File system error: {} (path: {})", message.into(), path)
        } else {
            format!("File system error: {}", message.into())
        };
        anyhow::Error::msg(msg)
    }

    pub fn permission_error(message: impl Into<String>, required: impl Into<String>) -> anyhow::Error {
        anyhow::Error::msg(format!(
            "Permission error: {} (required: {})",
            message.into(),
            required.into()
        ))
    }

    pub fn service_error(message: impl Into<String>, service: impl Into<String>) -> anyhow::Error {
        anyhow::Error::msg(format!(
            "Service error: {} (service: {})",
            message.into(),
            service.into()
        ))
    }

    pub fn parse_error(message: impl Into<String>, format: impl Into<String>) -> anyhow::Error {
        anyhow::Error::msg(format!(
            "Parse error: {} (format: {})",
            message.into(),
            format.into()
        ))
    }

    pub fn validation_error(message: impl Into<String>, field: Option<&str>) -> anyhow::Error {
        let msg = if let Some(field) = field {
            format!("Validation error: {} (field: {})", message.into(), field)
        } else {
            format!("Validation error: {}", message.into())
        };
        anyhow::Error::msg(msg)
    }

    pub fn timeout_error(message: impl Into<String>, duration_ms: u64) -> anyhow::Error {
        anyhow::Error::msg(format!(
            "Timeout error: {} ({}ms)",
            message.into(),
            duration_ms
        ))
    }
}

/// 统一的异步操作Result包装器
pub async fn safe_async_op<F, T>(operation: F) -> AppResult<T>
where
    F: std::future::Future<Output = AppResult<T>>,
{
    match tokio::time::timeout(
        std::time::Duration::from_secs(30), // 默认30秒超时
        operation
    ).await {
        Ok(result) => result,
        Err(_) => Err(error_constructors::timeout_error("Operation timed out", 30000)),
    }
}

/// 统一的文件操作Result包装器
pub fn safe_file_op<F, T>(operation: F, path: &str) -> AppResult<T>
where
    F: FnOnce() -> io::Result<T>,
{
    operation().map_err(|e| {
        error_constructors::file_error(e.to_string(), Some(path))
    })
}

/// 统一的网络操作Result包装器
pub async fn safe_network_op<F, T>(operation: F) -> AppResult<T>
where
    F: std::future::Future<Output = Result<T, reqwest::Error>>,
{
    match operation.await {
        Ok(result) => Ok(result),
        Err(e) => {
            let status_code = e.status().map(|s| s.as_u16());
            Err(error_constructors::network_error(e.to_string(), status_code))
        }
    }
}

/// 统一的配置操作Result包装器
pub fn safe_config_op<F, T>(operation: F, context: &str) -> AppResult<T>
where
    F: FnOnce() -> Result<T, Box<dyn std::error::Error>>,
{
    operation().map_err(|e| {
        error_constructors::config_error(format!("{}: {}", context, e))
    })
}

/// 便捷宏：简化错误处理
#[macro_export]
macro_rules! app_bail {
    ($msg:literal) => {
        return Err(anyhow::anyhow!($msg))
    };
    ($msg:expr) => {
        return Err(anyhow::anyhow!($msg))
    };
    ($fmt:expr, $($arg:tt)*) => {
        return Err(anyhow::anyhow!($fmt, $($arg)*))
    };
}

#[macro_export]
macro_rules! ensure_app {
    ($cond:expr, $msg:literal) => {
        if !($cond) {
            return Err(anyhow::anyhow!($msg));
        }
    };
    ($cond:expr, $msg:expr) => {
        if !($cond) {
            return Err(anyhow::anyhow!($msg));
        }
    };
    ($cond:expr, $fmt:expr, $($arg:tt)*) => {
        if !($cond) {
            return Err(anyhow::anyhow!($fmt, $($arg)*));
        }
    };
}

/// 测试模块
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = AppError::Config {
            message: "Invalid configuration".to_string(),
            source: Some("config.yaml".to_string()),
        };
        assert!(error.to_string().contains("Config error"));
        assert!(error.to_string().contains("Invalid configuration"));
    }

    #[tokio::test]
    async fn test_safe_async_op() {
        let result = safe_async_op(async { Ok::<i32, anyhow::Error>(42) }).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }
}
