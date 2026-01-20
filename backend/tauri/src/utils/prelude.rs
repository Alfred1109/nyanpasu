/**
 * Rust共享导入预导入库
 * 统一管理35+文件中重复的导入语句，减少代码冗余
 */

// 重新导出最常用的标准库类型和traits
pub use std::{
    collections::HashMap,
    sync::{Arc, Mutex, RwLock},
    path::{Path, PathBuf},
    fs,
    io::{self, Read, Write},
    result::Result as StdResult,
    string::String,
    vec::Vec,
};

// 重新导出anyhow相关的错误处理
pub use anyhow::{
    Context as AnyhowContext,
    Result as AnyhowResult,
    anyhow,
    bail,
    Error as AnyhowError,
};

// 重新导出serde相关
pub use serde::{Deserialize, Serialize};
pub use serde_json::{self, Value as JsonValue};
pub use serde_yaml::{self, Value as YamlValue, Mapping};

// 重新导出日志相关
pub use log::{debug, error, info, trace, warn};
pub use tracing::{self, instrument, event, Level as TracingLevel};

// 重新导出异步相关
pub use tokio::{self, sync as tokio_sync, time as tokio_time};
pub use futures::{Future, Stream, StreamExt, TryFutureExt};

// 重新导出配置和系统相关
pub use once_cell::sync::{Lazy, OnceCell};
pub use parking_lot::{Mutex as ParkingMutex, RwLock as ParkingRwLock};

// 重新导出Tauri相关
pub use tauri::{
    command, AppHandle, Manager, Runtime, State, Window,
    api::notification::Notification,
};

// 重新导出specta相关（用于类型生成）
pub use specta::Type;

// 项目内部常用类型别名
pub type Result<T> = AnyhowResult<T>;
pub type BoxError = Box<dyn std::error::Error + Send + Sync>;

// 常用的函数类型别名
pub type AsyncResult<T> = Result<T>;
pub type SyncResult<T> = StdResult<T, BoxError>;

// 重新导出项目内部常用模块
pub use crate::{
    config::Config,
    log_err, trace_err,
};

// 条件编译的平台特定导入
#[cfg(target_os = "windows")]
pub use std::os::windows::prelude::*;

#[cfg(target_os = "macos")]
pub use std::os::unix::prelude::*;

#[cfg(target_os = "linux")]
pub use std::os::unix::prelude::*;

// 重新导出网络相关
pub use reqwest::{Client as HttpClient, Method as HttpMethod, StatusCode};
pub use url::Url;

// 重新导出时间相关
pub use chrono::{DateTime, Local, TimeZone, Utc};

// 重新导出文件系统相关
pub use camino::{Utf8Path, Utf8PathBuf};
pub use fs_extra;
pub use tempfile;

// 常用宏重导出
pub use async_trait::async_trait;

/**
 * 通用工具函数和宏
 */

/// 简化错误转换的宏
#[macro_export]
macro_rules! map_err {
    ($result:expr, $msg:literal) => {
        $result.with_context(|| $msg)
    };
    ($result:expr, $msg:expr) => {
        $result.with_context(|| $msg)
    };
}

/// 简化Option转Result的宏
#[macro_export]
macro_rules! ok_or_err {
    ($option:expr, $msg:literal) => {
        $option.ok_or_else(|| anyhow!($msg))
    };
    ($option:expr, $msg:expr) => {
        $option.ok_or_else(|| anyhow!($msg))
    };
}

/// 条件编译的日志宏
#[macro_export]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        #[cfg(debug_assertions)]
        log::debug!($($arg)*);
    };
}

/// 简化异步操作的宏
#[macro_export]
macro_rules! spawn_task {
    ($future:expr) => {
        tokio::spawn(async move { $future })
    };
    ($future:expr, $name:literal) => {
        tokio::spawn(async move {
            let _guard = tracing::info_span!($name).entered();
            $future
        })
    };
}
