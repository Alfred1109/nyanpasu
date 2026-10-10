# 官方更新移植与 Mihomo 内核升级

本次基于官方 Nyanpasu main `3ec0072298e1a0c5223fe1c91d76490d2767f1a0` 对照实现第一批功能，保留本项目配置生成、DNS 设置与服务架构。

## 已实现

- 迁移前自动备份、手动备份、备份列表与完整性校验。每份备份记录应用版本、迁移版本、文件大小与 SHA256；运行中的 redb 数据通过单个读事务生成一致性快照。只清理同类别超过三份的有效旧备份，损坏备份保留供排查。
- 迁移锁严格解析与原子持久化。未开始、中断或失败的迁移会再次执行；全部迁移成功且锁文件保存成功后才推进版本。
- 代理组收藏、节点链路与健康信息、测速地址及超时设置；支持的自动组可固定节点和恢复自动选择。能力由真实内核返回字段判断，旧内核缺少字段时不会错误展示能力。
- 提供商健康检查触发真实接口，然后重新读取提供商和代理组状态。核心代理快照优先，提供商只补充缺失节点。
- `unified-delay` 和 `tcp-concurrent` 可分别跟随订阅与增强脚本，或由应用强制开启/关闭。DNS 与字段控制共享写入锁，配置生成、校验、保存及加载失败时恢复先前状态。
- IPC 错误保留代码、消息及详细上下文；全局错误、Promise 拒绝、控制台和 React 错误边界记录到本地日志，带去重、限流及长度限制。

## Mihomo

稳定版由 1.19.25 升至 [v1.19.32](https://github.com/MetaCubeX/mihomo/releases/tag/v1.19.32)。资源清单保留 amd64-v1，下载按官方资源 SHA256 校验；已有文件必须匹配来源记录与二进制摘要才会复用。下载、摘要或解压失败时保留原文件并报告失败。

Mihomo 热加载发送已生成且校验的配置 `payload`，适配其对 `path` 工作目录的限制；Clash Premium 保留原路径接口。日志只记录 payload 字节数，避免输出完整配置。接口依据：[Mihomo API 文档](https://wiki.metacubex.one/api/)。

Linux x86_64 与 Windows x86_64 随包资源已准备并验证下载摘要；Windows 程序未在 Linux 执行。Alpha 版本未修改。

## 验证

- Rust 库测试 84 项通过、3 项忽略，覆盖备份完整性、数据库快照、迁移状态和持久化失败、字段控制及代理元数据。
- TypeScript 检查、ESLint、前端 Vite 生产构建。
- `scripts/tests/sidecar.test.ts` 使用本地 HTTP 测试来源缓存、文件篡改、错误摘要和升级失败保留已有资源。
- `scripts/tests/mihomo-smoke.test.ts` 经 `start.sh --core` 启动真实随包内核，经 `stop.sh --core` 停止；检查版本、实际测速、自动组固定/恢复、提供商真实健康检查与配置内容热加载。
- 浏览器设置页 390px 预览检查；备份和字段保存依赖桌面 IPC，浏览器预览不执行本地操作。

构建验证使用 ext4 上的 `CARGO_TARGET_DIR=/home/alfred/.cache/nyanpasu-target`，绕过当前 NTFS 工作区旧编译缓存的动态库问题。Linux 正式安装包同样通过该目录执行 release 构建。

## 页面与本机运行

设置页采用常用操作区与应用、网络、维护三个分区，统一设置行的图标列、标题、状态、说明和操作位置。共享页面容器按实际可用宽度响应，修复首页窄屏卡片，并整理连接、规则、日志、订阅、提供商与代理页面的窄屏交互。

已安装客户端通过 `./start.sh --installed` / `./stop.sh --installed` 启停；本机内核托管服务通过 `./start.sh --service` / `./stop.sh --service` 启停。服务操作需要本机 sudo 权限。开发与网页预览继续使用原有参数。

## Linux 更新包类型识别

Tauri CLI 固定为 2.10.1，其打包器包含官方 [#14521](https://github.com/tauri-apps/tauri/pull/14521) 修复：按默认标记的二进制内容写入安装包类型，不再依赖被 release 符号移除清除的符号表。保留 `strip = true`、LTO 与大小优化。

`nyanpasu collect` 会输出运行时 `Bundle type`，用于核对 updater 识别到的实际安装格式。Linux deb 验收应同时检查：正式构建不再出现 `Failed to add bundler type` 警告；安装后的 `nyanpasu collect` 输出 `Bundle type: Some(Deb)`。此检查验证安装格式识别，不代表已执行未来版本的在线下载、签名校验和升级。
