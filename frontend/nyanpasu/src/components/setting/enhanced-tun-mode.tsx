import { useLockFn } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { 
  Box, 
  Typography, 
  Alert, 
  Chip, 
  Fade
} from '@mui/material'
import { 
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import { IS_IN_TAURI } from '@/utils/tauri'
import { message } from '@tauri-apps/plugin-dialog'
import { toggleTunMode, useSetting } from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'
import { useServiceManager } from '@/hooks/use-service-manager'

/**
 * 服务状态类型定义
 */
type ServiceStatusInfo = {
  status: 'not_installed' | 'stopped' | 'running'
  canUseTun: boolean
  message: string
  severity: 'error' | 'warning' | 'info' | 'success'
  actionHint?: string
}

/**
 * 根据服务状态计算TUN模式的可用性和提示信息
 */
const getServiceStatusInfo = (
  serviceStatus?: string,
  isServiceInstalled?: boolean,
  isInTauri?: boolean,
  t?: (key: string) => string
): ServiceStatusInfo => {
  if (!isInTauri) {
    return {
      status: 'not_installed',
      canUseTun: false,
      message: '该功能仅在桌面应用中可用',
      severity: 'info',
      actionHint: '请使用桌面版应用'
    }
  }

  if (!isServiceInstalled || serviceStatus === 'not_installed') {
    return {
      status: 'not_installed',
      canUseTun: false,
      message: '需要先安装系统服务才能使用TUN模式',
      severity: 'warning',
      actionHint: '点击上方"安装服务"按钮'
    }
  }

  if (serviceStatus === 'stopped') {
    return {
      status: 'stopped',
      canUseTun: false,
      message: '服务已安装但未运行，TUN模式无法使用',
      severity: 'warning', 
      actionHint: '点击上方"启动服务"按钮'
    }
  }

  if (serviceStatus === 'running') {
    return {
      status: 'running',
      canUseTun: true,
      message: '服务运行正常，TUN模式可用',
      severity: 'success'
    }
  }

  return {
    status: 'not_installed',
    canUseTun: false,
    message: '正在检查服务状态...',
    severity: 'info'
  }
}

/**
 * 获取状态图标
 */
const getStatusIcon = (severity: ServiceStatusInfo['severity']) => {
  switch (severity) {
    case 'success':
      return <CheckIcon color="success" fontSize="small" />
    case 'warning':
      return <WarningIcon color="warning" fontSize="small" />
    case 'error':
      return <ErrorIcon color="error" fontSize="small" />
    case 'info':
    default:
      return <InfoIcon color="info" fontSize="small" />
  }
}

/**
 * 增强的TUN模式按钮组件
 */
const EnhancedTunModeButton = () => {
  const { t } = useTranslation()
  const isInTauri = IS_IN_TAURI
  const serviceManager = useServiceManager()
  const tunMode = useSetting('enable_tun_mode')
  
  const [isToggling, setIsToggling] = useState(false)
  const [lastToggleError, setLastToggleError] = useState<string | null>(null)

  // 计算当前服务状态信息
  const statusInfo = getServiceStatusInfo(
    serviceManager.serviceStatus,
    serviceManager.isServiceInstalled,
    isInTauri,
    t
  )

  const handleTunMode = useLockFn(async () => {
    // 如果服务不可用，显示提示而不执行切换
    if (!statusInfo.canUseTun) {
      message(statusInfo.message + (statusInfo.actionHint ? `\n\n${statusInfo.actionHint}` : ''), {
        title: t('TUN Mode'),
        kind: 'warning',
      })
      return
    }

    setIsToggling(true)
    setLastToggleError(null)

    try {
      const result = await toggleTunMode()
      
      // 如果后端返回了消息，显示给用户
      if (result && typeof result === 'object' && 'message' in result && result.message) {
        message(result.message, {
          title: t('TUN Mode'),
          kind: 'success' in result && result.success ? 'info' : 'warning',
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setLastToggleError(errorMessage)
      
      const isCurrentlyEnabled = Boolean(tunMode.value)
      const action = isCurrentlyEnabled ? '关闭' : '开启'
      
      message(`${action} TUN Mode 失败: ${errorMessage}`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setIsToggling(false)
    }
  })

  // 监听服务状态变化，清除之前的切换错误
  useEffect(() => {
    if (serviceManager.serviceStatus) {
      setLastToggleError(null)
    }
  }, [serviceManager.serviceStatus])

  const isTunEnabled = Boolean(tunMode.value)
  const isDisabled = !statusInfo.canUseTun || isToggling || serviceManager.isInstalling

  return (
    <Box>
      {/* 主要的TUN模式开关 */}
      <PaperSwitchButton
        label={t('TUN Mode')}
        checked={isTunEnabled && statusInfo.canUseTun}
        loading={isToggling}
        onClick={handleTunMode}
        disabled={isDisabled}
        sx={{
          position: 'relative',
          opacity: statusInfo.canUseTun ? 1 : 0.6,
        }}
      >
        {/* 服务状态指示器 */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          {statusInfo.canUseTun ? (
            <Chip
              icon={getStatusIcon('success')}
              label="可用"
              size="small"
              color="success"
              variant="filled"
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
          ) : (
            <Chip
              icon={getStatusIcon(statusInfo.severity)}
              label="不可用"
              size="small"
              color={statusInfo.severity}
              variant="outlined" 
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
          )}
        </Box>

        {/* TUN模式状态文本 */}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            color: isTunEnabled && statusInfo.canUseTun ? 'success.main' : 'text.secondary',
            fontWeight: 'medium',
            fontSize: '0.7rem',
          }}
        >
          {isTunEnabled && statusInfo.canUseTun ? 'TUN已开启' : 'TUN已关闭'}
        </Typography>
      </PaperSwitchButton>

      {/* 状态提示信息 */}
      <Fade in timeout={300}>
        <Alert 
          severity={statusInfo.severity}
          icon={getStatusIcon(statusInfo.severity)}
          sx={{ 
            mt: 2,
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          <Box>
            <Typography variant="body2" sx={{ mb: statusInfo.actionHint ? 1 : 0 }}>
              {statusInfo.message}
            </Typography>
            
            {statusInfo.actionHint && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  fontStyle: 'italic'
                }}
              >
                💡 {statusInfo.actionHint}
              </Typography>
            )}

            {/* 显示最近的切换错误 */}
            {lastToggleError && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'error.main',
                  display: 'block',
                  mt: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.75rem'
                }}
              >
                ❌ 操作失败: {lastToggleError}
              </Typography>
            )}
          </Box>
        </Alert>
      </Fade>

      {/* TUN模式技术说明 */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          <strong>TUN模式说明:</strong> TUN模式通过虚拟网络接口实现全局流量代理，
          提供比系统代理更完整的网络拦截能力。需要系统服务支持和管理员权限。
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * 增强版TUN模式设置卡片
 */
export default function EnhancedTunModeCard() {
  return (
    <BaseCard label="TUN模式管理">
      <EnhancedTunModeButton />
    </BaseCard>
  )
}
