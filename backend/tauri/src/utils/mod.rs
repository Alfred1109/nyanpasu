pub mod candy;
pub mod config;
pub mod dialog;
pub mod dirs;
pub mod help;
pub mod init;
pub mod resolve;
// mod winhelp;
pub mod downloader;
#[cfg(windows)]
pub mod winreg;

pub mod collect;
pub mod net;

pub mod open;

pub mod dock;
pub mod platform;
pub mod sudo;

// 第三轮冗余修复：共享导入预导入库
pub mod prelude;

// 第三轮冗余修复：统一错误处理模块
pub mod error;
