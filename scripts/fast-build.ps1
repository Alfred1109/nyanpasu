# 高性能构建脚本 - 使用共享构建模块
param(
    [string]$BuildType = "release",
    [switch]$SkipFrontend = $false,
    [switch]$UseCache
)

# 导入共享构建函数模块
Import-Module "$PSScriptRoot\shared-build-functions.psm1" -Force

Write-Host "🚀 Starting Fast Build Process..." -ForegroundColor Green

# 获取最优构建设置
$buildSettings = Get-OptimalBuildSettings

# 设置优化的构建环境
Set-OptimizedBuildEnvironment -ParallelJobs $buildSettings.RecommendedParallelJobs -NodeMemoryLimit $buildSettings.NodeMemoryLimit -ThreadPoolSize $buildSettings.ThreadPoolSize

# 获取构建配置
$buildProfile = Get-BuildProfile -BuildType $BuildType
$cargoProfile = $buildProfile.CargoProfile
$viteBuildArgs = $buildProfile.ViteBuildArgs

# 前端构建阶段
if (-not $SkipFrontend) {
    Write-Host "`n📦 Building Frontend (Parallel)..." -ForegroundColor Green
    
    $frontendJobs = @()
    
    # 并行构建所有前端包
    $frontendJobs += Start-Job -ScriptBlock {
        Set-Location "d:\nyanpansu\frontend\interface"
        pnpm build
    }
    
    $frontendJobs += Start-Job -ScriptBlock {
        Set-Location "d:\nyanpansu\frontend\ui"
        pnpm build
    }
    
    $frontendJobs += Start-Job -ScriptBlock {
        Set-Location "d:\nyanpansu\frontend\nyanpasu"
        $env:NODE_OPTIONS = "--max-old-space-size=8192"
        pnpm build
    }
    
    # 等待所有前端构建完成
    Write-Host "⏳ Waiting for parallel frontend builds..." -ForegroundColor Yellow
    $frontendJobs | ForEach-Object {
        $result = Receive-Job -Job $_ -Wait
        Write-Host $result
    }
    
    # 清理作业
    $frontendJobs | Remove-Job
    
    Write-Host "✅ Frontend build completed!" -ForegroundColor Green
}

# 后端构建阶段
Write-Host "`n🦀 Building Rust Backend..." -ForegroundColor Green

# 预编译依赖以利用缓存
if ($UseCache) {
    Write-Host "📋 Pre-compiling dependencies..." -ForegroundColor Yellow
    cargo build --profile $cargoProfile --workspace --lib
}

# 主要构建
$tauriArgs = @(
    "build"
    "--profile", $cargoProfile
)

if ($BuildType -eq "debug") {
    $tauriArgs += "-d"
}

Write-Host "🔨 Starting Tauri build with profile: $cargoProfile" -ForegroundColor Yellow
Write-Host "Command: tauri $($tauriArgs -join ' ')" -ForegroundColor Gray

# 执行构建并测量时间
$buildStart = Get-Date
& tauri $tauriArgs

if ($LASTEXITCODE -eq 0) {
    $buildEnd = Get-Date
    $buildTime = $buildEnd - $buildStart
    
    Write-Host "`n🎉 Build completed successfully!" -ForegroundColor Green
    Write-Host "⏱️  Total build time: $($buildTime.Minutes)m $($buildTime.Seconds)s" -ForegroundColor Cyan
    Write-Host "💡 Hardware utilization: Optimized for 24-thread CPU" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Build failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 清理临时文件以节省磁盘空间
Write-Host "`n🧹 Cleaning up..." -ForegroundColor Yellow
Remove-Item -Path "target\tmp" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "🚀 Fast build process completed!" -ForegroundColor Green
