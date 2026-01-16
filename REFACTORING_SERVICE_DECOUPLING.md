# 服务安装与模式切换解耦重构方案

## 📋 当前问题

### 1. **代码重复**

- `setting-system-proxy.tsx` 和 `setting-system-service.tsx` 都包含服务安装逻辑
- 安装验证轮询代码重复 3 次（30s × 2 + 40s）
- `restartSidecar()` 调用散布在多处

### 2. **职责混乱**

- `setting-system-proxy.tsx` (783行)
  - 主职责：系统代理 + TUN 模式
  - 额外职责：完整的服务安装流程（400+ 行）
  - 包含 6 个安装阶段、进度条、Dialog
- `setting-system-service.tsx` (269行)
  - 主职责：服务模式开关
  - 额外职责：自己的服务安装流程
  - 与上面的逻辑有重复但不完全一致

### 3. **状态管理混乱**

- 两个组件各自维护 `serviceActionPending` / `installOrUninstallPending`
- 没有全局的服务安装状态管理
- 用户可能同时在两个地方触发安装，导致冲突

### 4. **用户体验不一致**

- `setting-system-proxy.tsx` 有详细的 6 阶段进度条
- `setting-system-service.tsx` 只有简单的 loading
- 错误处理逻辑不一致

---

## 🎯 解耦目标

1. **单一职责原则**：每个组件只负责自己的核心功能
2. **代码复用**：共享的服务安装逻辑只写一次
3. **状态统一**：全局管理服务安装状态
4. **体验一致**：统一的安装流程和错误处理

---

## 🏗️ 重构架构

### **三层架构**

```
┌─────────────────────────────────────────────────────────┐
│  Presentation Layer (UI 层)                              │
│  ├─ SettingSystemProxy                                   │
│  │   - 只负责系统代理/TUN模式的UI和切换                  │
│  │   - 检测到服务未安装时，调用 serviceManager.install() │
│  │                                                        │
│  ├─ SettingSystemService                                 │
│  │   - 只负责服务模式的UI和切换                          │
│  │   - 启用服务模式时，调用 serviceManager.install()     │
│  │                                                        │
│  └─ ServiceInstallDialog (共享组件)                      │
│      - 统一的安装进度 Dialog                              │
│      - 6 阶段进度条、UAC 提示                             │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────┐
│  Business Logic Layer (业务逻辑层)                       │
│  └─ useServiceManager (统一的服务管理 hook)              │
│     ├─ State:                                            │
│     │   - isInstalling: boolean                          │
│     │   - installStage: InstallStage | null              │
│     │   - canCancel: boolean                             │
│     │                                                     │
│     ├─ Methods:                                          │
│     │   - installService(options?)                       │
│     │   - uninstallService()                             │
│     │   - cancelInstallation()                           │
│     │                                                     │
│     └─ Internal Logic:                                   │
│         - 服务安装流程编排                                │
│         - 安装验证轮询（统一40s）                         │
│         - 错误处理和重试                                  │
│         - sidecar 重启管理                                │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────┐
│  Data Layer (数据层)                                      │
│  └─ useSystemService (现有 hook，保持不变)               │
│     - query: 服务状态查询                                 │
│     - upsert: 服务操作 mutation                           │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 实现细节

### **1. 创建 `useServiceManager` Hook**

**文件**: `frontend/nyanpasu/src/hooks/use-service-manager.ts`

```typescript
import { useCallback, useState } from 'react'
import { restartSidecar, useSystemService } from '@nyanpasu/interface'

export enum InstallStage {
  PREPARING = 'preparing',
  WAITING_UAC = 'waiting_uac',
  INSTALLING = 'installing',
  VERIFYING = 'verifying',
  STARTING = 'starting',
  CONFIGURING = 'configuring',
}

export interface ServiceInstallOptions {
  autoStart?: boolean
  onConfigureProxy?: () => Promise<void>
  onConfigureTun?: () => Promise<void>
}

export const useServiceManager = () => {
  const { query, upsert } = useSystemService()
  const [isInstalling, setIsInstalling] = useState(false)
  const [installStage, setInstallStage] = useState<InstallStage | null>(null)
  const [canCancel, setCanCancel] = useState(false)
  const [cancelRequested, setCancelRequested] = useState(false)

  /**
   * 等待服务安装完成
   * 统一的轮询逻辑，可配置超时时间
   */
  const waitForInstallation = useCallback(
    async (maxSeconds: number = 40): Promise<boolean> => {
      for (let i = 0; i < maxSeconds; i++) {
        if (cancelRequested) return false

        await new Promise((resolve) => setTimeout(resolve, 1000))
        const result = await query.refetch()

        if (result.data?.status !== 'not_installed') {
          console.log(`Service installation verified after ${i + 1}s`)
          return true
        }

        if ((i + 1) % 5 === 0) {
          console.log(
            `Waiting for service installation... (${i + 1}/${maxSeconds}s)`,
          )
        }
      }
      return false
    },
    [query, cancelRequested],
  )

  /**
   * 安装服务（统一流程）
   */
  const installService = useCallback(
    async (options: ServiceInstallOptions = {}) => {
      const { autoStart = false, onConfigureProxy, onConfigureTun } = options

      setIsInstalling(true)
      setCancelRequested(false)

      try {
        // Stage 1: Preparing
        setInstallStage(InstallStage.PREPARING)
        await new Promise((resolve) => setTimeout(resolve, 800))
        if (cancelRequested) return

        // Stage 2: Waiting for UAC
        setInstallStage(InstallStage.WAITING_UAC)
        setCanCancel(true)
        await upsert.mutateAsync('install')
        if (cancelRequested) return
        setCanCancel(false)

        // Stage 3: Installing
        setInstallStage(InstallStage.INSTALLING)
        if (cancelRequested) return

        // Stage 4: Verifying
        setInstallStage(InstallStage.VERIFYING)
        const installed = await waitForInstallation(40)
        if (!installed) {
          throw new Error('service_not_installed')
        }

        // Restart sidecar after installation
        await restartSidecar()

        // Stage 5: Starting (optional)
        if (autoStart) {
          setInstallStage(InstallStage.STARTING)
          await upsert.mutateAsync('start')
          await restartSidecar()
          if (cancelRequested) return

          // Stage 6: Configuring (optional)
          setInstallStage(InstallStage.CONFIGURING)
          if (onConfigureProxy) await onConfigureProxy()
          if (onConfigureTun) await onConfigureTun()
        }

        await query.refetch()
        return true
      } finally {
        setIsInstalling(false)
        setInstallStage(null)
        setCanCancel(false)
        setCancelRequested(false)
      }
    },
    [upsert, query, waitForInstallation, cancelRequested],
  )

  /**
   * 卸载服务
   */
  const uninstallService = useCallback(async () => {
    setIsInstalling(true)
    setInstallStage(InstallStage.INSTALLING) // Reuse for uninstall

    try {
      await upsert.mutateAsync('uninstall')
      await restartSidecar()
      await query.refetch()
      return true
    } finally {
      setIsInstalling(false)
      setInstallStage(null)
    }
  }, [upsert, query])

  /**
   * 取消安装
   */
  const cancelInstallation = useCallback(() => {
    setCancelRequested(true)
    setCanCancel(false)
  }, [])

  return {
    // State
    isInstalling,
    installStage,
    canCancel,
    serviceStatus: query.data?.status,
    isServiceInstalled: query.data?.status !== 'not_installed',

    // Methods
    installService,
    uninstallService,
    cancelInstallation,

    // Query
    query,
  }
}
```

### **2. 创建共享的 `ServiceInstallDialog` 组件**

**文件**: `frontend/nyanpasu/src/components/setting/modules/service-install-dialog.tsx`

```typescript
import { useTranslation } from 'react-i18next'
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Typography,
  Button,
} from '@mui/material'
import { Close as CloseIcon, Security as SecurityIcon } from '@mui/icons-material'
import { InstallStage } from '@/hooks/use-service-manager'

interface ServiceInstallDialogProps {
  open: boolean
  installStage: InstallStage | null
  canCancel: boolean
  onCancel: () => void
}

const getStageProgress = (stage: InstallStage): number => {
  // ... (复用现有逻辑)
}

const getStageText = (stage: InstallStage, t: (key: string) => string): string => {
  // ... (复用现有逻辑)
}

const getStageDescription = (stage: InstallStage, t: (key: string) => string): string => {
  // ... (复用现有逻辑)
}

export const ServiceInstallDialog = ({
  open,
  installStage,
  canCancel,
  onCancel,
}: ServiceInstallDialogProps) => {
  const { t } = useTranslation()

  if (!installStage) return null

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogContent>
        {/* 进度显示UI（复用现有的） */}
      </DialogContent>
    </Dialog>
  )
}
```

### **3. 重构 `SettingSystemProxy` 组件**

**简化后的核心逻辑**:

```typescript
export const SettingSystemProxy = () => {
  const { t } = useTranslation()
  const serviceManager = useServiceManager()
  const systemProxy = useSetting('enable_system_proxy')
  const tunMode = useSetting('enable_tun_mode')

  const [pendingModeAction, setPendingModeAction] = useState<ModeAction | null>(null)
  const [showInstallDialog, setShowInstallDialog] = useState(false)

  const handleRequireInstall = (action: ModeAction) => {
    setPendingModeAction(action)
    setShowInstallDialog(true)
  }

  const handleInstallConfirm = async () => {
    setShowInstallDialog(false)

    await serviceManager.installService({
      autoStart: true,
      onConfigureProxy: pendingModeAction === 'system_proxy'
        ? () => toggleSystemProxy()
        : undefined,
      onConfigureTun: pendingModeAction === 'tun'
        ? () => toggleTunMode()
        : undefined,
    })

    setPendingModeAction(null)
  }

  return (
    <BaseCard label={t('System Settings')}>
      {/* 安装进度Dialog（共享组件） */}
      <ServiceInstallDialog
        open={serviceManager.isInstalling}
        installStage={serviceManager.installStage}
        canCancel={serviceManager.canCancel}
        onCancel={serviceManager.cancelInstallation}
      />

      {/* 系统代理和TUN模式按钮 */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6 }}>
          <SystemProxyButton
            serviceStatus={serviceManager.serviceStatus}
            onRequireInstall={handleRequireInstall}
            disabled={serviceManager.isInstalling}
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TunModeButton
            serviceStatus={serviceManager.serviceStatus}
            onRequireInstall={handleRequireInstall}
            disabled={serviceManager.isInstalling}
          />
        </Grid>
      </Grid>

      {/* 其他UI保持不变 */}
    </BaseCard>
  )
}
```

**代码减少**: 783行 → ~200行 ✅

### **4. 重构 `SettingSystemService` 组件**

**简化后的核心逻辑**:

```typescript
export const SettingSystemService = () => {
  const { t } = useTranslation()
  const serviceManager = useServiceManager()
  const serviceMode = useSetting('enable_service_mode')

  const [showInstallDialog, setShowInstallDialog] = useState(false)

  const handleServiceModeToggle = () => {
    if (!serviceMode.value && !serviceManager.isServiceInstalled) {
      setShowInstallDialog(true)
      return
    }
    serviceMode.upsert(!serviceMode.value)
  }

  const handleInstallConfirm = async () => {
    setShowInstallDialog(false)

    await serviceManager.installService({
      autoStart: true,
      onConfigureProxy: async () => {
        await serviceMode.upsert(true)
      },
    })
  }

  return (
    <BaseCard label={t('System Service')}>
      {/* 共享安装进度Dialog */}
      <ServiceInstallDialog
        open={serviceManager.isInstalling}
        installStage={serviceManager.installStage}
        canCancel={serviceManager.canCancel}
        onCancel={serviceManager.cancelInstallation}
      />

      <SwitchItem
        label={t('Service Mode')}
        checked={serviceMode.value || false}
        onChange={handleServiceModeToggle}
        disabled={serviceManager.isInstalling}
      />

      {/* 其他UI保持不变 */}
    </BaseCard>
  )
}
```

**代码减少**: 269行 → ~100行 ✅

---

## 📊 重构收益

### **代码行数对比**

| 文件                                  | 重构前  | 重构后 | 减少     |
| ------------------------------------- | ------- | ------ | -------- |
| `setting-system-proxy.tsx`            | 783行   | ~200行 | **-74%** |
| `setting-system-service.tsx`          | 269行   | ~100行 | **-63%** |
| **新增** `use-service-manager.ts`     | -       | ~150行 | -        |
| **新增** `service-install-dialog.tsx` | -       | ~100行 | -        |
| **总计**                              | 1,052行 | 550行  | **-48%** |

### **质量提升**

✅ **单一职责**: 每个组件只关注自己的核心功能
✅ **代码复用**: 安装逻辑只实现一次
✅ **状态统一**: 全局的服务安装状态，避免冲突
✅ **体验一致**: 统一的安装流程和进度显示
✅ **易于测试**: 业务逻辑层可以独立测试
✅ **易于维护**: 修改安装流程只需改一处

---

## 🚀 实施步骤

1. **第一步**: 创建 `use-service-manager.ts` hook
2. **第二步**: 创建 `ServiceInstallDialog` 共享组件
3. **第三步**: 重构 `setting-system-proxy.tsx`（移除服务安装逻辑）
4. **第四步**: 重构 `setting-system-service.tsx`（移除重复逻辑）
5. **第五步**: 测试所有安装流程
6. **第六步**: 删除重复代码

---

## ⚠️ 注意事项

1. **向后兼容**: 确保现有的用户流程不受影响
2. **错误处理**: 保持现有的错误处理逻辑
3. **状态同步**: `useServiceManager` 需要正确管理全局状态
4. **取消逻辑**: 确保取消操作在所有阶段都能正确工作

---

## 🎯 后续优化

1. **添加单元测试**: 为 `useServiceManager` 编写测试
2. **状态持久化**: 考虑将安装进度保存到本地，防止刷新丢失
3. **错误恢复**: 添加自动重试机制
4. **进度通知**: 可以添加全局的安装进度通知
