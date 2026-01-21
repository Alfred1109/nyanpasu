# Windows 安装包构建指南

本文档介绍如何为 Clash Nyanpasu 生成 Windows 安装包（NSIS 格式）。

## 前置要求

### 必需工具

1. **Node.js** (>= 22.0.0)
   - 下载地址: https://nodejs.org/
   - 验证安装: `node --version`

2. **pnpm** (>= 10.26.1)
   - 安装命令: `npm install -g pnpm`
   - 验证安装: `pnpm --version`

3. **Rust** (nightly)
   - 下载地址: https://rustup.rs/
   - 安装后运行: `rustup default nightly`
   - 验证安装: `rustc --version`

### Windows 特定要求

4. **Visual Studio Build Tools** 或 **Visual Studio**
   - 需要 C++ 构建工具
   - 下载地址: https://visualstudio.microsoft.com/downloads/

5. **WebView2 Runtime** (可选，用于测试)
   - 下载地址: https://developer.microsoft.com/microsoft-edge/webview2/

## 快速开始

### 方法 1: 使用构建脚本 (推荐)

#### Windows (PowerShell)

```powershell
# 构建正式版本
.\scripts\build-windows-installer.ps1 -Release

# 构建每日版本
.\scripts\build-windows-installer.ps1 -Nightly

# 构建内置 WebView2 的版本
.\scripts\build-windows-installer.ps1 -Release -FixedWebview

# 跳过依赖安装和前端构建（快速重新构建）
.\scripts\build-windows-installer.ps1 -Release -SkipBuild
```

#### Linux/macOS (需要交叉编译工具)

```bash
# 构建正式版本
./scripts/build-windows-installer.sh --release

# 构建每日版本
./scripts/build-windows-installer.sh --nightly

# 构建内置 WebView2 的版本
./scripts/build-windows-installer.sh --release --fixed-webview
```

### 方法 2: 手动构建

#### 1. 安装依赖

```bash
pnpm install
```

#### 2. 准备资源和配置

```bash
# 检查并准备 sidecar 和资源文件
pnpm prepare:check

# 准备正式版本配置
pnpm prepare:release

# 或准备每日版本配置
pnpm prepare:nightly --nsis
```

#### 3. 构建前端

```bash
pnpm -r build
```

#### 4. 生成 Git 信息

```bash
pnpm generate:git-info
```

#### 5. 构建 Tauri 应用

```bash
# 正式版本
pnpm tauri build -c backend/tauri/tauri.conf.json

# 每日版本
pnpm tauri build -c backend/tauri/tauri.nightly.conf.json
```

## 构建选项说明

### 构建类型

- **Release (正式版本)**: 用于发布的稳定版本
- **Nightly (每日版本)**: 包含最新功能的测试版本，版本号会附加 git hash

### WebView2 模式

- **引导程序模式** (默认): 安装包较小，首次运行时在线下载 WebView2
- **固定版本模式** (`-FixedWebview`): 安装包较大，内置 WebView2 运行时，无需联网

### 安装包格式

项目配置支持以下格式（在 `tauri.conf.json` 中配置）:

- **NSIS**: Windows 标准安装程序，支持自定义安装选项
- **MSI**: Windows Installer 格式，适合企业部署
- **便携版**: 无需安装的可执行文件（需要额外配置）

## 输出位置

构建完成后，安装包会生成在以下目录：

```
backend/tauri/target/release/bundle/
├── nsis/
│   ├── nyanpasu_3.0.1_x64-setup.exe          # NSIS 安装程序
│   └── nyanpasu_3.0.1_x64-setup.exe.sig      # 签名文件（如果配置了签名）
└── msi/
    ├── nyanpasu_3.0.1_x64_en-US.msi          # MSI 安装程序
    └── nyanpasu_3.0.1_x64_en-US.msi.sig      # 签名文件（如果配置了签名）
```

## 配置文件说明

### Tauri 配置文件

- `backend/tauri/tauri.conf.json`: 正式版本配置
- `backend/tauri/tauri.nightly.conf.json`: 每日版本配置（构建时生成）
- `backend/tauri/overrides/nightly.conf.json`: 每日版本配置覆盖

### 关键配置项

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis", "dmg", "deb"],
    "windows": {
      "webviewInstallMode": {
        "type": "embedBootstrapper"  // 或 "fixedRuntime"
      },
      "nsis": {
        "displayLanguageSelector": false,
        "installerIcon": "icons/icon.ico",
        "languages": ["SimpChinese"],
        "template": "./templates/installer.nsi",
        "installMode": "both"  // 支持单用户和所有用户安装
      }
    }
  }
}
```

## 常见问题

### 1. 构建失败: "找不到 MSVC"

**解决方案**: 安装 Visual Studio Build Tools，确保包含 C++ 构建工具。

### 2. 构建失败: "WebView2 runtime not found"

**解决方案**: 
- 如果使用固定版本模式，需要下载 WebView2 Runtime 并放置在正确位置
- 或者使用引导程序模式（默认）

### 3. 前端构建内存不足

**解决方案**: 增加 Node.js 内存限制
```bash
export NODE_OPTIONS="--max_old_space_size=4096"
```

### 4. Rust 编译错误

**解决方案**: 
- 确保使用 nightly 工具链: `rustup default nightly`
- 更新工具链: `rustup update`
- 清理缓存: `cargo clean`

### 5. 依赖安装失败

**解决方案**:
```bash
# 清理缓存
pnpm store prune

# 重新安装
pnpm install --no-frozen-lockfile
```

## 高级选项

### 自定义 NSIS 安装程序

编辑 `backend/tauri/templates/installer.nsi` 文件来自定义安装程序界面和行为。

### 代码签名

要对安装包进行数字签名，需要配置证书：

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

### 生成便携版

运行以下命令生成便携版：

```bash
pnpm portable
```

## CI/CD 集成

项目已配置 GitHub Actions 自动构建，参考：
- `.github/workflows/ci.yml`: 持续集成
- `.github/workflows/daily.yml`: 每日构建
- `.github/workflows/publish.yml`: 发布流程

## 相关资源

- [Tauri 官方文档](https://tauri.app/)
- [NSIS 文档](https://nsis.sourceforge.io/Docs/)
- [项目 README](../README.md)
- [贡献指南](../CONTRIBUTING.md)

## 技术支持

如遇到问题，请：
1. 查看 [Issues](https://github.com/Alfred1109/clashnyanpasu/issues)
2. 提交新的 Issue 并附上详细的错误信息和构建日志
