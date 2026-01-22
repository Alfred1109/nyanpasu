# WSL 中构建 Windows 安装包

在 WSL2 中构建 Windows 安装包是最简单的方式，因为 WSL2 可以直接访问 Windows 的工具和文件系统。

## 优势

✅ **直接使用 Windows NSIS** - 无需额外安装 Linux 版本的 NSIS  
✅ **完整的交叉编译支持** - MinGW-w64 工具链  
✅ **访问 Windows 文件系统** - 可以直接在 Windows 中打开生成的 exe  
✅ **最快的构建速度** - 充分利用硬件资源  

## 快速开始

### 1. 确保 WSL2 环境已准备好

```bash
# 检查 WSL 版本
wsl --version

# 检查 NSIS 是否可用
makensis -VERSION
```

### 2. 运行构建脚本

```bash
# 构建正式版本
./scripts/build-windows-installer-wsl.sh --release

# 构建每日版本
./scripts/build-windows-installer-wsl.sh --nightly

# 构建内置 WebView2 的版本
./scripts/build-windows-installer-wsl.sh --release --fixed-webview

# 跳过依赖安装和前端构建（快速重新构建）
./scripts/build-windows-installer-wsl.sh --release --skip-build
```

## 构建过程详解

脚本会自动执行以下步骤：

1. **环境检查** - 验证 Node.js、pnpm、Rust、NSIS 等工具
2. **依赖安装** - 安装 pnpm 依赖
3. **资源准备** - 下载 sidecar 文件和其他资源
4. **配置准备** - 准备 Tauri 构建配置
5. **前端构建** - 构建 React 前端应用
6. **Git 信息** - 生成版本和 git 信息
7. **交叉编译** - 使用 MinGW-w64 编译 Rust 后端
8. **NSIS 打包** - 使用 NSIS 生成 Windows 安装程序

## 输出位置

构建完成后，安装包会生成在：

```
backend/target/x86_64-pc-windows-gnu/release/bundle/nsis/
└── nyanpasu_3.0.1_x64-setup.exe  (41 MB)
```

### 成功构建示例

```
✓ 构建完成！
✓ Windows exe 安装包已生成

安装包位置:
  • backend/target/x86_64-pc-windows-gnu/release/bundle/nsis/nyanpasu_3.0.1_x64-setup.exe
    大小: 41M
    类型: PE32 executable (GUI) Intel 80386, Nullsoft Installer self-extracting archive
    MD5: be1b5b9150fb2e41f50672aeb28d3493
```

## 在 Windows 中使用

生成的 exe 文件可以直接在 Windows 中运行：

```powershell
# 从 WSL 访问 Windows 文件
cd /mnt/c/Users/YourName/...

# 或者从 Windows 资源管理器中访问
\\wsl$\Ubuntu\home\alfred\projects\nyanpasu\clashnyanpasu\backend\target\...
```

## 常见问题

### Q: 如何在 WSL 中安装 MinGW-w64？

```bash
sudo apt-get update
sudo apt-get install -y gcc-mingw-w64-x86-64 g++-mingw-w64-x86-64
```

### Q: 如何在 WSL 中安装 NSIS？

```bash
sudo apt-get install -y nsis
```

### Q: 构建失败，如何清理重新开始？

```bash
# 清理 Rust 构建缓存
cargo clean

# 清理 pnpm 缓存
pnpm store prune

# 重新安装依赖
pnpm install
```

### Q: 如何加速构建？

```bash
# 使用 --skip-build 跳过前端构建（如果前端没有改动）
./scripts/build-windows-installer-wsl.sh --release --skip-build

# 增加并行构建任务数（编辑 .cargo/config.toml）
[build]
jobs = 24  # 根据 CPU 核心数调整
```

### Q: 生成的 exe 可以在其他 Windows 系统上运行吗？

是的，生成的 exe 是标准的 Windows 可执行文件，可以在任何 Windows 系统上运行。

## 与其他构建方式的对比

| 方式 | 优点 | 缺点 |
|------|------|------|
| **WSL** | 最简单，最快，直接使用 Windows 工具 | 需要 WSL2 环境 |
| **Windows 本机** | 最原生，最稳定 | 需要 Windows 系统 |
| **Linux 交叉编译** | 可在纯 Linux 系统上运行 | 配置复杂，速度较慢 |
| **GitHub Actions** | 自动化，无需本地环境 | 需要推送代码，等待时间长 |

## 推荐工作流

1. **开发阶段** - 在 WSL 中使用 `--skip-build` 快速迭代
2. **测试阶段** - 完整构建并在 Windows 中测试
3. **发布阶段** - 使用 GitHub Actions 自动构建所有平台

## 相关文档

- [完整构建指南](./docs/BUILD_WINDOWS_INSTALLER.md)
- [Linux 交叉编译](./BUILD_WINDOWS_ON_LINUX.md)
- [快速开始](./BUILD_INSTALLER.md)
