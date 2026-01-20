/*! Rust共享导入预导入库
 * 统一管理35+文件中重复的导入语句，减少代码冗余
 */

// 重新导出anyhow相关的错误处理
pub use anyhow::Result as AnyhowResult;

// 项目内部常用类型别名
pub type Result<T> = AnyhowResult<T>;
