import { useLockFn } from 'ahooks'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseServiceManagerReturn } from '@/hooks/use-service-manager'
import { IS_IN_TAURI } from '@/utils/tauri'
import { applyDarkStyles } from '@/utils/theme'
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { Alert, Box, Chip, Fade, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { toggleTunMode, useSetting } from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { message } from '@tauri-apps/plugin-dialog'
import { PaperSwitchButton } from './modules/system-proxy'

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
  serviceConnected?: boolean,
  isServiceInstalled?: boolean,
  isServiceModeEnabled?: boolean,
  serviceStatusError?: string,
  isInTauri?: boolean,
  t?: (key: string) => string,
): ServiceStatusInfo => {
  if (!isInTauri) {
    return {
      status: 'not_installed',
      canUseTun: false,
      message: '该功能仅在桌面应用中可用',
      severity: 'info',
      actionHint: '请使用桌面版应用',
    }
  }

  if (serviceStatusError) {
    return {
      status: 'stopped',
      canUseTun: false,
      message: serviceStatusError,
      severity: 'warning',
      actionHint: '请先恢复服务访问权限，再启用 TUN 模式',
    }
  }

  if (!isServiceInstalled || serviceStatus === 'not_installed') {
    return {
      status: 'not_installed',
      canUseTun: false,
      message: '需要先安装系统服务才能使用TUN模式',
      severity: 'warning',
      actionHint: '点击上方"安装服务"按钮',
    }
  }

  if (!isServiceModeEnabled) {
    return {
      status: 'stopped',
      canUseTun: false,
      message: '系统服务已安装，但当前未启用服务模式',
      severity: 'warning',
      actionHint: '请先到上方“系统服务”卡片中启用服务模式',
    }
  }

  if (serviceStatus === 'stopped') {
    return {
      status: 'stopped',
      canUseTun: false,
      message: '服务已安装但未运行，TUN模式无法使用',
      severity: 'warning',
      actionHint: '点击上方"启动服务"按钮',
    }
  }

  if (serviceStatus === 'running') {
    if (!serviceConnected) {
      return {
        status: 'stopped',
        canUseTun: false,
        message: '服务正在启动中，IPC 连接尚未就绪',
        severity: 'info',
        actionHint: '请稍等几秒后再启用 TUN 模式',
      }
    }

    return {
      status: 'running',
      canUseTun: true,
      message: '服务运行正常，TUN模式可用',
      severity: 'success',
    }
  }

  return {
    status: 'not_installed',
    canUseTun: false,
    message: '正在检查服务状态...',
    severity: 'info',
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
const EnhancedTunModeButton = ({
  serviceManager,
}: {
  serviceManager: UseServiceManagerReturn
}) => {
  const { t } = useTranslation()
  const isInTauri = IS_IN_TAURI
  const tunMode = useSetting('enable_tun_mode')

  const [isToggling, setIsToggling] = useState(false)
  const [lastToggleError, setLastToggleError] = useState<string | null>(null)
  const [optimisticTunEnabled, setOptimisticTunEnabled] = useState<
    boolean | null
  >(null)

  // 计算当前服务状态信息
  const statusInfo = getServiceStatusInfo(
    serviceManager.serviceStatus,
    serviceManager.serviceConnected,
    serviceManager.isServiceInstalled,
    serviceManager.serviceModeEnabled,
    serviceManager.serviceStatusError,
    isInTauri,
    t,
  )

  const handleTunMode = useLockFn(async () => {
    // 如果服务不可用，显示提示而不执行切换
    if (!statusInfo.canUseTun) {
      message(
        statusInfo.message +
          (statusInfo.actionHint ? `\n\n${statusInfo.actionHint}` : ''),
        {
          title: t('TUN Mode'),
          kind: 'warning',
        },
      )
      return
    }

    setIsToggling(true)
    setLastToggleError(null)
    const currentEnabled = Boolean(tunMode.value)
    const nextEnabled = !currentEnabled
    setOptimisticTunEnabled(nextEnabled)

    try {
      const result = await toggleTunMode()

      // 如果后端返回了消息，显示给用户
      if (
        result &&
        typeof result === 'object' &&
        'message' in result &&
        result.message
      ) {
        message(result.message, {
          title: t('TUN Mode'),
          kind: 'success' in result && result.success ? 'info' : 'warning',
        })
      }

      // If backend reports failure (but not thrown), rollback optimistic UI
      if (
        result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === false
      ) {
        setOptimisticTunEnabled(currentEnabled)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      setLastToggleError(errorMessage)
      // rollback optimistic state
      setOptimisticTunEnabled(currentEnabled)

      const action = currentEnabled ? '关闭' : '开启'

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
  }, [
    serviceManager.serviceStatus,
    serviceManager.serviceStatusError,
    serviceManager.serviceModeEnabled,
  ])

  // When underlying setting changes (query refresh), clear optimistic override
  useEffect(() => {
    setOptimisticTunEnabled(null)
  }, [tunMode.value])

  const isTunEnabled = optimisticTunEnabled ?? Boolean(tunMode.value)
  const isDisabled = isToggling || serviceManager.isInstalling
  const serviceModeEnabled = serviceManager.serviceModeEnabled

  return (
    <Box>
      <Box
        sx={(theme) => ({
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 0.75,
          mb: 1.5,
        })}
      >
        {[
          {
            label: 'TUN 状态',
            value: isTunEnabled ? '已开启' : '已关闭',
            tone: isTunEnabled ? 'success' : 'default',
          },
          {
            label: '服务模式',
            value: serviceModeEnabled ? '已启用' : '未启用',
            tone: serviceModeEnabled ? 'success' : 'warning',
          },
          {
            label: '可用性',
            value: statusInfo.canUseTun ? '可用' : '不可用',
            tone: statusInfo.canUseTun ? 'success' : statusInfo.severity,
          },
        ].map((item) => (
          <Box
            key={item.label}
            sx={(theme) => ({
              p: 1,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: alpha(theme.palette.common.black, 0.08),
              background: `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.96)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.04)}`,
              ...applyDarkStyles(theme, {
                borderColor: alpha(theme.palette.common.white, 0.1),
                background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.94)} 0%, ${alpha(theme.palette.primary.main, 0.12)} 100%)`,
                boxShadow: `0 12px 24px ${alpha(theme.palette.common.black, 0.2)}`,
              }),
            })}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600 }}
            >
              {item.label}
            </Typography>
            <Box mt={0.75}>
              <Chip
                size="small"
                color={item.tone as 'default' | 'success' | 'warning' | 'info'}
                variant="filled"
                label={item.value}
                sx={(theme) => ({
                  fontWeight: 800,
                  ...(item.tone === 'default'
                    ? {
                        color: alpha(theme.palette.common.black, 0.78),
                        backgroundColor: alpha(
                          theme.palette.common.black,
                          0.06,
                        ),
                        border: `1px solid ${alpha(theme.palette.common.black, 0.08)}`,
                        ...applyDarkStyles(theme, {
                          color: alpha(theme.palette.common.white, 0.82),
                          backgroundColor: alpha(
                            theme.palette.common.white,
                            0.08,
                          ),
                          border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
                        }),
                      }
                    : {}),
                })}
              />
            </Box>
          </Box>
        ))}
      </Box>

      {/* 主要的TUN模式开关 */}
      <PaperSwitchButton
        label={t('TUN Mode')}
        checked={isTunEnabled}
        loading={isToggling}
        onClick={handleTunMode}
        disabled={isDisabled}
        statusText={null}
        sxPaper={(theme) => ({
          background:
            isTunEnabled && statusInfo.canUseTun
              ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
              : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.98)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          borderColor:
            isTunEnabled && statusInfo.canUseTun
              ? alpha(theme.palette.primary.main, 0.42)
              : alpha(theme.palette.common.black, 0.08),
          boxShadow:
            isTunEnabled && statusInfo.canUseTun
              ? `0 16px 32px ${alpha(theme.palette.primary.main, 0.22)}`
              : `0 10px 24px ${alpha(theme.palette.common.black, 0.06)}`,
          '&:hover': {
            background:
              isTunEnabled && statusInfo.canUseTun
                ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`
                : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 1)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
          },
          ...applyDarkStyles(theme, {
            background:
              isTunEnabled && statusInfo.canUseTun
                ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
                : `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.94)} 0%, ${alpha(theme.palette.primary.main, 0.14)} 100%)`,
            borderColor:
              isTunEnabled && statusInfo.canUseTun
                ? alpha(theme.palette.primary.main, 0.42)
                : alpha(theme.palette.common.white, 0.12),
            boxShadow:
              isTunEnabled && statusInfo.canUseTun
                ? `0 16px 32px ${alpha(theme.palette.primary.main, 0.22)}`
                : `0 12px 28px ${alpha(theme.palette.common.black, 0.22)}`,
            '&:hover': {
              background:
                isTunEnabled && statusInfo.canUseTun
                  ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`
                  : `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.primary.main, 0.18)} 100%)`,
            },
          }),
        })}
        sx={{
          opacity: statusInfo.canUseTun ? 1 : 0.6,
        }}
      >
        {/* 服务状态指示器 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            width: '100%',
          }}
        >
          <Box display="flex" alignItems="center" gap={0.75}>
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
                variant="filled"
                sx={{ fontSize: '0.65rem', height: 20, fontWeight: 700 }}
              />
            )}
          </Box>

          {/* TUN模式状态文本 */}
          <Typography
            variant="caption"
            sx={{
              color: isTunEnabled
                ? statusInfo.canUseTun
                  ? 'success.main'
                  : 'warning.main'
                : 'text.secondary',
              fontWeight: 'medium',
              fontSize: '0.7rem',
              whiteSpace: 'nowrap',
            }}
          >
            {isTunEnabled ? 'TUN已开启' : 'TUN已关闭'}
          </Typography>
        </Box>
      </PaperSwitchButton>

      {/* 状态提示信息 */}
      <Fade in timeout={300}>
        <Alert
          severity={statusInfo.severity}
          icon={getStatusIcon(statusInfo.severity)}
          sx={{
            mt: 1.5,
            '& .MuiAlert-message': {
              width: '100%',
            },
          }}
        >
          <Box>
            <Typography
              variant="body2"
              sx={{ mb: statusInfo.actionHint ? 1 : 0 }}
            >
              {statusInfo.message}
            </Typography>

            {statusInfo.actionHint && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                }}
              >
                提示: {statusInfo.actionHint}
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
                  fontSize: '0.75rem',
                }}
              >
                操作失败: {lastToggleError}
              </Typography>
            )}
          </Box>
        </Alert>
      </Fade>

      {/* TUN模式技术说明 */}
      <Box
        sx={(theme) => ({
          mt: 1.5,
          p: 1.5,
          borderRadius: 2.5,
          background: `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.96)} 0%, ${alpha(theme.palette.info.main, 0.06)} 100%)`,
          border: '1px solid',
          borderColor: alpha(theme.palette.info.main, 0.14),
          ...applyDarkStyles(theme, {
            background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.94)} 0%, ${alpha(theme.palette.info.main, 0.14)} 100%)`,
            borderColor: alpha(theme.palette.info.main, 0.22),
          }),
        })}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1.4 }}
        >
          <strong>TUN模式说明:</strong>{' '}
          TUN模式通过虚拟网络接口实现全局流量代理，
          提供比系统代理更完整的网络拦截能力。需要系统服务支持和管理员权限。
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * 增强版TUN模式设置卡片
 */
export default function EnhancedTunModeCard({
  serviceManager,
}: {
  serviceManager: UseServiceManagerReturn
}) {
  return (
    <BaseCard
      label="TUN模式管理"
      labelChildren={
        <Chip
          size="small"
          color={serviceManager.serviceConnected ? 'success' : 'warning'}
          variant="filled"
          label={serviceManager.serviceConnected ? '连接就绪' : '等待服务'}
          sx={{ fontWeight: 700 }}
        />
      }
    >
      <EnhancedTunModeButton serviceManager={serviceManager} />
    </BaseCard>
  )
}
