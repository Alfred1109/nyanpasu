#!/bin/bash
# Windows 安装包构建脚本 (Linux/macOS 交叉编译)
# 用于生成 Clash Nyanpasu 的 Windows NSIS 安装包

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
echo "Clash Nyanpasu Windows 安装包构建工具"
echo -e "========================================${NC}"
echo ""

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

if [ "$NIGHTLY" = true ]; then
    pnpm tsx scripts/prepare-unified.ts $PREPARE_ARGS
else
    pnpm tsx scripts/prepare-unified.ts $PREPARE_ARGS
fi

echo -e "${GREEN}✓ 配置准备完成${NC}"
echo ""

# 构建前端
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

# 构建 Tauri 应用
echo -e "${YELLOW}构建 Tauri 应用和安装包...${NC}"
echo -e "${YELLOW}这可能需要几分钟时间，请耐心等待...${NC}"
echo ""

TAURI_CONFIG="backend/tauri/tauri.conf.json"
if [ "$NIGHTLY" = true ]; then
    TAURI_CONFIG="backend/tauri/tauri.nightly.conf.json"
fi

pnpm tauri build -c $TAURI_CONFIG

echo ""
echo -e "${GREEN}========================================"
echo "✓ 构建完成！"
echo -e "========================================${NC}"
echo ""

# 查找生成的安装包
BUNDLE_DIR="backend/tauri/target/release/bundle"
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
