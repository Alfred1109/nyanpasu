# 快速生成 Windows 安装包

## 🚀 一键构建

### Windows 用户

在项目根目录打开 PowerShell，运行：

```powershell
# 正式版本
.\scripts\build-windows-installer.ps1 -Release

# 测试版本（带 git hash）
.\scripts\build-windows-installer.ps1 -Nightly
```

### Linux 用户

```bash
# 正式版本
./scripts/build-windows-installer.sh --release

# 测试版本
./scripts/build-windows-installer.sh --nightly
```

## 📦 安装包位置

构建完成后，安装包在：

```
backend/tauri/target/release/bundle/nsis/
└── nyanpasu_x.x.x_x64-setup.exe
```

## ⚙️ 前置要求

- Node.js >= 22.0.0
- pnpm >= 10.26.1  
- Rust (nightly)
- Visual Studio Build Tools (Windows)

## 📖 详细文档

查看完整构建指南：[docs/BUILD_WINDOWS_INSTALLER.md](docs/BUILD_WINDOWS_INSTALLER.md)

## 🔧 常用选项

```powershell
# 内置 WebView2（安装包更大，无需联网）
.\scripts\build-windows-installer.ps1 -Release -FixedWebview

# 快速重新构建（跳过依赖安装）
.\scripts\build-windows-installer.ps1 -Release -SkipBuild
```
