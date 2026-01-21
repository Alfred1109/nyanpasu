# 在 Linux 上构建 Windows 安装包

## 当前情况

你在 Linux 系统上运行了构建脚本，成功生成了 **Linux deb 包**：
```
backend/target/release/bundle/deb/nyanpasu_3.0.1_amd64.deb
```

但是，**无法直接在 Linux 上生成 Windows exe 安装包**，因为：
1. Tauri 的 NSIS 打包器需要 Windows 系统
2. Windows 特定的依赖和工具链只能在 Windows 上运行

## 解决方案

### 方案 1: 在 Windows 系统上构建（推荐）

将项目代码复制到 Windows 系统，然后运行：

```powershell
# 在 Windows PowerShell 中运行
.\scripts\build-windows-installer.ps1 -Release
```

### 方案 2: 使用 GitHub Actions 自动构建

项目已经配置了 GitHub Actions，可以自动在 Windows 环境中构建：

1. 推送代码到 GitHub
2. 触发 CI/CD 工作流
3. 在 Actions 页面下载构建好的 Windows 安装包

参考工作流文件：
- `.github/workflows/ci.yml` - 持续集成
- `.github/workflows/daily.yml` - 每日构建

### 方案 3: 使用 Docker + Wine（不推荐，复杂且不稳定）

理论上可以使用 Wine 在 Linux 上模拟 Windows 环境，但这种方法：
- 配置复杂
- 容易出错
- 构建时间长
- 不建议用于生产环境

### 方案 4: 使用 Windows 虚拟机

在 Linux 上运行 Windows 虚拟机（VirtualBox、VMware、KVM 等），然后在虚拟机中构建。

## 当前已完成的工作

✅ 环境检查通过
✅ 依赖安装完成
✅ 资源文件准备完成
✅ 构建配置准备完成
✅ Git 信息生成完成
✅ **Linux deb 包构建成功**

## 生成的文件

```bash
# Linux 安装包
backend/target/release/bundle/deb/nyanpasu_3.0.1_amd64.deb

# 可执行文件
backend/target/release/nyanpasu
```

## 下一步操作

### 如果你有 Windows 系统访问权限：

1. 将项目同步到 Windows 系统
2. 安装必要工具（Node.js, pnpm, Rust, Visual Studio Build Tools）
3. 运行构建脚本：
   ```powershell
   .\scripts\build-windows-installer.ps1 -Release
   ```

### 如果你想使用 CI/CD：

1. 确保代码已推送到 GitHub
2. 在 GitHub Actions 中查看构建结果
3. 下载生成的 Windows 安装包

## 技术说明

Tauri 使用平台特定的打包工具：
- **Windows**: NSIS (Nullsoft Scriptable Install System) 或 WiX (Windows Installer XML)
- **macOS**: DMG 和 App Bundle
- **Linux**: deb, rpm, AppImage

这些工具通常只能在对应的操作系统上运行，因此跨平台构建需要：
- 多个构建环境（推荐）
- CI/CD 系统（如 GitHub Actions）
- 虚拟机或容器化解决方案

## 参考资料

- [Tauri 构建文档](https://tauri.app/v1/guides/building/)
- [项目构建指南](./docs/BUILD_WINDOWS_INSTALLER.md)
- [GitHub Actions 工作流](./.github/workflows/)
