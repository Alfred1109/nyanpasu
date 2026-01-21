# Windows 安装包构建脚本
# 用于生成 Clash Nyanpasu 的 Windows NSIS 安装包

param(
    [switch]$Release,
    [switch]$Nightly,
    [switch]$FixedWebview,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Clash Nyanpasu Windows 安装包构建工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查必要的工具
Write-Host "检查构建环境..." -ForegroundColor Yellow

# 检查 Node.js
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 未找到 Node.js，请先安装 Node.js 22+" -ForegroundColor Red
    exit 1
}

# 检查 pnpm
try {
    $pnpmVersion = pnpm --version
    Write-Host "✓ pnpm: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 未找到 pnpm，请先安装 pnpm" -ForegroundColor Red
    Write-Host "  运行: npm install -g pnpm" -ForegroundColor Yellow
    exit 1
}

# 检查 Rust
try {
    $rustVersion = rustc --version
    Write-Host "✓ Rust: $rustVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 未找到 Rust，请先安装 Rust" -ForegroundColor Red
    Write-Host "  访问: https://rustup.rs/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 确定构建类型
$buildType = "release"
$prepareArgs = "--release"

if ($Nightly) {
    $buildType = "nightly"
    $prepareArgs = "--nightly --nsis"
    Write-Host "构建类型: Nightly (每日构建)" -ForegroundColor Cyan
} else {
    Write-Host "构建类型: Release (正式版本)" -ForegroundColor Cyan
}

if ($FixedWebview) {
    $prepareArgs += " --fixed-webview"
    Write-Host "WebView2: 固定版本 (内置)" -ForegroundColor Cyan
} else {
    Write-Host "WebView2: 引导程序 (在线下载)" -ForegroundColor Cyan
}

Write-Host ""

# 安装依赖
if (-not $SkipBuild) {
    Write-Host "安装依赖..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ 依赖安装失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ 依赖安装完成" -ForegroundColor Green
    Write-Host ""
}

# 准备构建配置
Write-Host "准备构建配置..." -ForegroundColor Yellow
pnpm prepare:check
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 资源准备失败" -ForegroundColor Red
    exit 1
}

if ($Nightly) {
    pnpm tsx scripts/prepare-unified.ts $prepareArgs
} else {
    pnpm tsx scripts/prepare-unified.ts $prepareArgs
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 配置准备失败" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 配置准备完成" -ForegroundColor Green
Write-Host ""

# 构建前端
if (-not $SkipBuild) {
    Write-Host "构建前端..." -ForegroundColor Yellow
    $env:NODE_OPTIONS = "--max_old_space_size=4096"
    pnpm -r build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ 前端构建失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ 前端构建完成" -ForegroundColor Green
    Write-Host ""
}

# 生成 Git 信息
Write-Host "生成 Git 信息..." -ForegroundColor Yellow
pnpm generate:git-info
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Git 信息生成失败" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Git 信息生成完成" -ForegroundColor Green
Write-Host ""

# 构建 Tauri 应用
Write-Host "构建 Tauri 应用和安装包..." -ForegroundColor Yellow
Write-Host "这可能需要几分钟时间，请耐心等待..." -ForegroundColor Yellow
Write-Host ""

$tauriConfig = "backend/tauri/tauri.conf.json"
if ($Nightly) {
    $tauriConfig = "backend/tauri/tauri.nightly.conf.json"
}

pnpm tauri build -c $tauriConfig
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Tauri 构建失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ 构建完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 查找生成的安装包
$bundleDir = "backend/tauri/target/release/bundle"
Write-Host "安装包位置:" -ForegroundColor Cyan

if (Test-Path "$bundleDir/nsis") {
    $nsisFiles = Get-ChildItem "$bundleDir/nsis" -Filter "*.exe"
    foreach ($file in $nsisFiles) {
        Write-Host "  • $($file.FullName)" -ForegroundColor Yellow
        Write-Host "    大小: $([math]::Round($file.Length / 1MB, 2)) MB" -ForegroundColor Gray
    }
}

if (Test-Path "$bundleDir/msi") {
    $msiFiles = Get-ChildItem "$bundleDir/msi" -Filter "*.msi"
    foreach ($file in $msiFiles) {
        Write-Host "  • $($file.FullName)" -ForegroundColor Yellow
        Write-Host "    大小: $([math]::Round($file.Length / 1MB, 2)) MB" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "提示: 你可以在 $bundleDir 目录找到所有生成的安装包" -ForegroundColor Cyan
