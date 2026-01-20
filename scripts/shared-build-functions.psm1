# 共享的构建优化函数模块
# 整合了来自 fast-build.ps1 和 setup-build-environment.ps1 的重复功能

# 硬件检测和优化配置
function Get-OptimalBuildSettings {
    [CmdletBinding()]
    param()
    
    $cpuCores = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors
    $availableMemory = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB, 2)
    
    $settings = @{
        CpuCores = $cpuCores
        AvailableMemory = $availableMemory
        RecommendedParallelJobs = [math]::Min($cpuCores - 4, 20)  # 保留4个核心给系统
        NodeMemoryLimit = 8192  # 8GB for Node.js
        ThreadPoolSize = [math]::Min($cpuCores, 20)
    }
    
    Write-Host "💻 检测到 $($settings.CpuCores) 个逻辑核心" -ForegroundColor Cyan
    Write-Host "🧠 可用内存: $($settings.AvailableMemory) GB" -ForegroundColor Cyan
    Write-Host "⚙️ 推荐并行任务数: $($settings.RecommendedParallelJobs)" -ForegroundColor Cyan
    
    return $settings
}

# 设置环境变量优化
function Set-OptimizedBuildEnvironment {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [int]$ParallelJobs = 20,
        
        [Parameter(Mandatory = $false)]
        [int]$NodeMemoryLimit = 8192,
        
        [Parameter(Mandatory = $false)]
        [int]$ThreadPoolSize = 20,
        
        [Parameter(Mandatory = $false)]
        [switch]$SetPermanent = $false
    )
    
    Write-Host "⚙️ 配置优化的构建环境..." -ForegroundColor Yellow
    
    # Rust 编译器优化
    $rustEnvVars = @{
        "CARGO_BUILD_JOBS" = $ParallelJobs.ToString()
        "CARGO_NET_OFFLINE" = "false"
        "CARGO_NET_GIT_FETCH_WITH_CLI" = "true"
        "RUSTC_WRAPPER" = ""
        "CARGO_TARGET_DIR" = "target"
        "RUSTFLAGS" = "-C target-cpu=native -C link-arg=/INCREMENTAL:NO"
    }
    
    # Node.js 优化
    $nodeEnvVars = @{
        "NODE_OPTIONS" = "--max-old-space-size=$NodeMemoryLimit"
        "UV_THREADPOOL_SIZE" = $ThreadPoolSize.ToString()
    }
    
    # 应用环境变量
    foreach ($envVar in ($rustEnvVars + $nodeEnvVars).GetEnumerator()) {
        $target = if ($SetPermanent) { "User" } else { "Process" }
        [Environment]::SetEnvironmentVariable($envVar.Key, $envVar.Value, $target)
        Write-Host "   ✓ $($envVar.Key) = $($envVar.Value)" -ForegroundColor Green
    }
}

# pnpm 缓存优化配置
function Set-PnpmOptimizations {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [string]$StoreDir = "D:\.pnpm-store",
        
        [Parameter(Mandatory = $false)]
        [int]$NetworkConcurrency = 20,
        
        [Parameter(Mandatory = $false)]
        [int]$ChildConcurrency = 20
    )
    
    Write-Host "🏪 配置 pnpm 优化..." -ForegroundColor Yellow
    
    try {
        pnpm config set store-dir $StoreDir 2>$null
        pnpm config set network-concurrency $NetworkConcurrency 2>$null
        pnpm config set child-concurrency $ChildConcurrency 2>$null
        pnpm config set fetch-retries 3 2>$null
        
        Write-Host "   ✓ pnpm store 目录: $StoreDir" -ForegroundColor Green
        Write-Host "   ✓ 网络并发: $NetworkConcurrency" -ForegroundColor Green
        Write-Host "   ✓ 子进程并发: $ChildConcurrency" -ForegroundColor Green
    }
    catch {
        Write-Warning "pnpm 配置失败: $($_.Exception.Message)"
    }
}

# Windows 系统优化检查和建议
function Test-WindowsOptimizations {
    [CmdletBinding()]
    param()
    
    Write-Host "🪟 检查 Windows 系统优化..." -ForegroundColor Yellow
    
    # 检查电源计划
    $currentPowerPlan = powercfg /getactivescheme
    if ($currentPowerPlan -notlike "*High performance*" -and $currentPowerPlan -notlike "*Ultimate Performance*") {
        Write-Host "💡 建议: 切换到 '高性能' 或 '卓越性能' 电源计划" -ForegroundColor Cyan
        Write-Host "   命令: powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c" -ForegroundColor Gray
    } else {
        Write-Host "   ✓ 电源计划已优化" -ForegroundColor Green
    }
    
    # 检查磁盘类型
    $driveInfo = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='D:'"
    if ($driveInfo) {
        Write-Host "   💾 构建目录: D:\ 驱动器已检测到" -ForegroundColor Gray
        Write-Host "   💡 建议: 确保 D:\ 在 SSD 上以获得最佳性能" -ForegroundColor Cyan
    }
}

# 构建配置文件选择
function Get-BuildProfile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("debug", "fast", "release")]
        [string]$BuildType
    )
    
    $profiles = @{
        "debug" = @{
            CargoProfile = "dev"
            ViteBuildArgs = "--mode development"
            Description = "🔧 使用调试构建配置..."
            Color = "Yellow"
        }
        "fast" = @{
            CargoProfile = "fast-build"
            ViteBuildArgs = "--mode production --minify esbuild"
            Description = "⚡ 使用快速构建配置..."
            Color = "Yellow"
        }
        "release" = @{
            CargoProfile = "release"
            ViteBuildArgs = "--mode production"
            Description = "🎯 使用发布构建配置..."
            Color = "Yellow"
        }
    }
    
    $profile = $profiles[$BuildType]
    Write-Host $profile.Description -ForegroundColor $profile.Color
    return $profile
}

# 执行并行构建任务
function Start-ParallelBuild {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock[]]$BuildJobs,
        
        [Parameter(Mandatory = $false)]
        [int]$ThrottleLimit = 4
    )
    
    Write-Host "🚀 启动并行构建任务..." -ForegroundColor Green
    
    try {
        $jobs = $BuildJobs | ForEach-Object {
            Start-Job -ScriptBlock $_
        }
        
        # 等待所有任务完成
        $jobs | Wait-Job | Receive-Job
        
        # 清理任务
        $jobs | Remove-Job
        
        Write-Host "✅ 所有并行构建任务完成" -ForegroundColor Green
    }
    catch {
        Write-Error "并行构建失败: $($_.Exception.Message)"
        throw
    }
}

# 导出函数
Export-ModuleMember -Function @(
    'Get-OptimalBuildSettings',
    'Set-OptimizedBuildEnvironment', 
    'Set-PnpmOptimizations',
    'Test-WindowsOptimizations',
    'Get-BuildProfile',
    'Start-ParallelBuild'
)
