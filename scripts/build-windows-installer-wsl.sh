#!/bin/bash
# WSL 优化的 Windows 安装包构建脚本
# 在 WSL2 中直接使用 Windows 的 NSIS 生成 exe 安装包

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 参数解析
RELEASE=false
NIGHTLY=false
FIXED_WEBVIEW=false
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --release)
            RELEASE=true
            shift
            ;;
        --nightly)
            NIGHTLY=true
            shift
            ;;
        --fixed-webview)
            FIXED_WEBVIEW=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        *)
            echo -e "${RED}未知参数: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}========================================"
echo "Clash Nyanpasu WSL Windows 安装包构建工具"
echo -e "========================================${NC}"
echo ""

# 检查 WSL 环境
if ! grep -qi microsoft /proc/version; then
    echo -e "${YELLOW}⚠ 警告: 未检测到 WSL 环境${NC}"
    echo -e "${YELLOW}此脚本针对 WSL2 优化，在其他环境中可能无法正常工作${NC}"
    echo ""
fi

# 检查必要的工具
echo -e "${YELLOW}检查构建环境...${NC}"

# 检查 Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ 未找到 Node.js，请先安装 Node.js 22+${NC}"
    exit 1
fi

# 检查 pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo -e "${GREEN}✓ pnpm: $PNPM_VERSION${NC}"
else
    echo -e "${RED}✗ 未找到 pnpm，请先安装 pnpm${NC}"
    echo -e "${YELLOW}  运行: npm install -g pnpm${NC}"
    exit 1
fi

# 检查 Rust
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    echo -e "${GREEN}✓ Rust: $RUST_VERSION${NC}"
else
    echo -e "${RED}✗ 未找到 Rust，请先安装 Rust${NC}"
    echo -e "${YELLOW}  访问: https://rustup.rs/${NC}"
    exit 1
fi

# 检查 NSIS
if command -v makensis &> /dev/null; then
    NSIS_VERSION=$(makensis -VERSION 2>&1 | head -n1)
    echo -e "${GREEN}✓ NSIS: $NSIS_VERSION${NC}"
else
    echo -e "${RED}✗ 未找到 NSIS (makensis)${NC}"
    echo -e "${YELLOW}  在 WSL 中运行: sudo apt install nsis${NC}"
    exit 1
fi

# 检查 Windows 交叉编译工具链
if command -v x86_64-w64-mingw32-gcc &> /dev/null; then
    echo -e "${GREEN}✓ MinGW-w64 交叉编译工具链已安装${NC}"
else
    echo -e "${YELLOW}⚠ 未找到 MinGW-w64，尝试安装...${NC}"
    sudo apt-get update
    sudo apt-get install -y gcc-mingw-w64-x86-64 g++-mingw-w64-x86-64
fi

echo ""

# 确定构建类型
BUILD_TYPE="release"
PREPARE_ARGS="--release"

if [ "$NIGHTLY" = true ]; then
    BUILD_TYPE="nightly"
    PREPARE_ARGS="--nightly --nsis"
    echo -e "${CYAN}构建类型: Nightly (每日构建)${NC}"
else
    echo -e "${CYAN}构建类型: Release (正式版本)${NC}"
fi

if [ "$FIXED_WEBVIEW" = true ]; then
    PREPARE_ARGS="$PREPARE_ARGS --fixed-webview"
    echo -e "${CYAN}WebView2: 固定版本 (内置)${NC}"
else
    echo -e "${CYAN}WebView2: 引导程序 (在线下载)${NC}"
fi

echo -e "${CYAN}目标平台: Windows (x86_64-pc-windows-gnu)${NC}"
echo ""

# 安装依赖
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}安装依赖...${NC}"
    pnpm install
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
    echo ""
fi

# 准备构建配置
echo -e "${YELLOW}准备构建配置...${NC}"
pnpm prepare:check

pnpm tsx scripts/prepare-unified.ts $PREPARE_ARGS

echo -e "${GREEN}✓ 配置准备完成${NC}"
echo ""

# 下载 Windows sidecar 文件
echo -e "${YELLOW}下载 Windows sidecar 文件...${NC}"
pnpm tsx scripts/download-windows-sidecars.ts
echo -e "${GREEN}✓ Sidecar 文件下载完成${NC}"
echo ""

# 构建前端（如果需要）
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}构建前端...${NC}"
    export NODE_OPTIONS="--max_old_space_size=4096"
    pnpm -r build
    echo -e "${GREEN}✓ 前端构建完成${NC}"
    echo ""
fi

# 生成 Git 信息
echo -e "${YELLOW}生成 Git 信息...${NC}"
pnpm generate:git-info
echo -e "${GREEN}✓ Git 信息生成完成${NC}"
echo ""

# 添加 Windows 交叉编译目标
echo -e "${YELLOW}添加 Windows 交叉编译目标...${NC}"
rustup target add x86_64-pc-windows-gnu 2>/dev/null || true
echo -e "${GREEN}✓ 交叉编译目标已准备${NC}"
echo ""

# 构建 Tauri 应用
echo -e "${YELLOW}构建 Tauri 应用和 Windows 安装包...${NC}"
echo -e "${YELLOW}这可能需要几分钟时间，请耐心等待...${NC}"
echo ""

TAURI_CONFIG="backend/tauri/tauri.conf.json"
if [ "$NIGHTLY" = true ]; then
    TAURI_CONFIG="backend/tauri/tauri.nightly.conf.json"
fi

pnpm tauri build -c $TAURI_CONFIG --target x86_64-pc-windows-gnu

echo ""
echo -e "${GREEN}========================================"
echo "✓ 构建完成！"
echo -e "========================================${NC}"
echo ""

# 查找生成的安装包
BUNDLE_DIR="backend/target/x86_64-pc-windows-gnu/release/bundle"
echo -e "${CYAN}安装包位置:${NC}"

if [ -d "$BUNDLE_DIR/nsis" ]; then
    find "$BUNDLE_DIR/nsis" -name "*.exe" -type f | while read -r file; do
        SIZE=$(du -h "$file" | cut -f1)
        echo -e "  ${YELLOW}• $file${NC}"
        echo -e "    ${NC}大小: $SIZE${NC}"
    done
fi

if [ -d "$BUNDLE_DIR/msi" ]; then
    find "$BUNDLE_DIR/msi" -name "*.msi" -type f | while read -r file; do
        SIZE=$(du -h "$file" | cut -f1)
        echo -e "  ${YELLOW}• $file${NC}"
        echo -e "    ${NC}大小: $SIZE${NC}"
    done
fi

echo ""
echo -e "${CYAN}提示: 你可以在 $BUNDLE_DIR 目录找到所有生成的安装包${NC}"
echo ""
echo -e "${GREEN}WSL 优势:${NC}"
echo -e "  • 直接使用 Windows 的 NSIS 工具"
echo -e "  • 支持交叉编译到 Windows"
echo -e "  • 可以访问 Windows 文件系统"
echo -e "  • 生成的 exe 可以直接在 Windows 中运行"
