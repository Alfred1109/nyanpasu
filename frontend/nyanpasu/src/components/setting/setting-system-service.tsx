import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseServiceManagerReturn } from '@/hooks/use-service-manager'
import { IS_IN_TAURI } from '@/utils/tauri'
import { getDefaultChipStyles, getTokenSurfaceStyles } from '@/utils/theme'
import { Alert, Box, Button, Chip, Divider, Typography } from '@mui/material'
import { BaseCard } from '@nyanpasu/ui'
import ServiceInstallDialog from './modules/service-install-dialog'
import {
  SettingSummaryItem,
  SettingSummaryPanel,
} from './setting-summary-panel'

interface SettingSystemServiceProps {
  serviceManager: UseServiceManagerReturn
}

export default function SettingSystemService({
  serviceManager,
}: SettingSystemServiceProps) {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const isInTauri = IS_IN_TAURI

  const isServiceModeEnabled = serviceManager.serviceModeEnabled
  const feedbackSeverity = serviceManager.lastError
    ? 'error'
    : message.includes('失败')
      ? 'error'
      : message.includes('取消') ||
          message.includes('超时') ||
          message.includes('请按需启动服务') ||
          message.includes('请检查服务状态')
        ? 'warning'
        : 'success'
  const primaryActionLabel = serviceManager.isInstalling
    ? '处理中...'
    : !serviceManager.isServiceInstalled
      ? '安装服务并启用'
      : isServiceModeEnabled
        ? '服务模式已启用'
        : '启用服务模式'
  const startActionLabel = !serviceManager.isServiceInstalled
    ? '启动服务'
    : !isServiceModeEnabled
      ? '先启用服务模式'
      : serviceManager.serviceStatus === 'running'
        ? '服务已运行'
        : '启动服务'
  const stopActionLabel =
    serviceManager.serviceStatus === 'running' ? '停止服务' : '服务已停止'
  const uninstallActionLabel = serviceManager.isServiceInstalled
    ? '卸载服务'
    : '服务未安装'
  const serviceStatusLabel =
    serviceManager.serviceStatus === 'running'
      ? '运行中'
      : serviceManager.serviceStatus === 'stopped'
        ? '已停止'
        : '未安装'
  const serviceStatusTone =
    serviceManager.serviceStatus === 'running'
      ? 'success'
      : serviceManager.serviceStatus === 'stopped'
        ? 'warning'
        : 'default'
  const handleInstallService = async () => {
    if (!isInTauri) {
      setMessage('该功能仅在桌面端可用，请使用 tauri dev 或安装版 exe 测试。')
      return
    }
    setMessage('')
    try {
      const wasInstalled = serviceManager.isServiceInstalled
      const success = await serviceManager.installService({ autoStart: false })
      if (success) {
        if (wasInstalled) {
          setMessage(
            serviceManager.serviceStatus === 'running'
              ? '服务模式已启用，服务当前正在运行。'
              : '服务模式已启用，请按需启动服务。',
          )
        } else {
          setMessage('服务安装成功，服务模式已启用。请按需启动服务。')
        }
      } else {
        setMessage(
          wasInstalled
            ? '服务模式启用未完成，请检查服务状态。'
            : '服务安装未完成，请检查服务状态。',
        )
      }
    } catch (error) {
      console.error('Service install error:', error)
      setMessage(
        `${serviceManager.isServiceInstalled ? '启用服务模式' : '服务安装'}失败: ${error}`,
      )
    }
  }

  const handleStartService = async () => {
    if (!isInTauri) {
      setMessage('该功能仅在桌面端可用，请使用 tauri dev 或安装版 exe 测试。')
      return
    }
    setMessage('')
    try {
      await serviceManager.startService()
      setMessage('服务启动成功！')
    } catch (error) {
      console.error('Service start error:', error)
      setMessage(`服务启动失败: ${error}`)
    }
  }

  const handleUninstallService = async () => {
    if (!isInTauri) {
      setMessage('该功能仅在桌面端可用，请使用 tauri dev 或安装版 exe 测试。')
      return
    }
    setMessage('')
    try {
      await serviceManager.uninstallService()
      setMessage('服务卸载成功！')
    } catch (error) {
      console.error('Service uninstall error:', error)
      setMessage(`服务卸载失败: ${error}`)
    }
  }

  const handleStopService = async () => {
    if (!isInTauri) {
      setMessage('该功能仅在桌面端可用，请使用 tauri dev 或安装版 exe 测试。')
      return
    }
    setMessage('')
    try {
      await serviceManager.stopService()
      setMessage('服务停止成功！')
    } catch (error) {
      console.error('Service stop error:', error)
      setMessage(`服务停止失败: ${error}`)
    }
  }

  const actionItems = [
    {
      key: 'install',
      title: '安装与启用',
      description: '写入系统服务并打开服务模式，为 TUN 和后台接管做准备。',
      buttonLabel: primaryActionLabel,
      variant: 'contained' as const,
      color: 'primary' as const,
      handleClick: handleInstallService,
      disabled:
        !isInTauri ||
        serviceManager.isInstalling ||
        (serviceManager.isServiceInstalled && isServiceModeEnabled),
    },
    {
      key: 'start',
      title: '启动服务',
      description: '在已安装且已启用服务模式后拉起后台服务进程。',
      buttonLabel: startActionLabel,
      variant: 'outlined' as const,
      color: 'primary' as const,
      handleClick: handleStartService,
      disabled:
        !isInTauri ||
        serviceManager.isInstalling ||
        !serviceManager.isServiceInstalled ||
        !isServiceModeEnabled ||
        serviceManager.serviceStatus === 'running',
    },
    {
      key: 'stop',
      title: '停止服务',
      description: '停止当前运行中的服务进程，但保留服务安装状态。',
      buttonLabel: stopActionLabel,
      variant: 'outlined' as const,
      color: 'primary' as const,
      handleClick: handleStopService,
      disabled:
        !isInTauri ||
        serviceManager.isInstalling ||
        !serviceManager.isServiceInstalled ||
        serviceManager.serviceStatus !== 'running',
    },
    {
      key: 'uninstall',
      title: '卸载服务',
      description: '移除本地服务安装，适合排障或恢复到不使用服务模式。',
      buttonLabel: uninstallActionLabel,
      variant: 'outlined' as const,
      color: 'error' as const,
      handleClick: handleUninstallService,
      disabled:
        !isInTauri ||
        serviceManager.isInstalling ||
        !serviceManager.isServiceInstalled,
    },
  ]

  return (
    <>
      <BaseCard
        label={t('System Service')}
        labelChildren={
          <Chip
            size="small"
            color={serviceStatusTone}
            variant="filled"
            label={serviceStatusLabel}
            sx={(theme) => ({
              fontWeight: 800,
              ...(serviceStatusTone === 'default'
                ? getDefaultChipStyles(theme)
                : {}),
            })}
          />
        }
      >
        <Box display="flex" flexDirection="column" gap={1.5}>
          <Typography variant="body2" color="text.secondary">
            系统服务为 TUN 和更稳定的代理接管提供底层能力，建议在需要 TUN
            时优先完成这里的配置。
          </Typography>

          {!isInTauri && (
            <Alert severity="info" sx={{ mt: 1 }}>
              该功能仅在桌面端可用（Tauri WebView）。浏览器 Dev
              模式无法调用系统服务。
            </Alert>
          )}

          {(message || serviceManager.lastError) && (
            <Alert severity={feedbackSeverity} sx={{ mt: 1 }}>
              {message}
              {serviceManager.lastError && (
                <>
                  <br />
                  详细: {serviceManager.lastError}
                  <br />
                  请在任务栏确认是否有 UAC 弹窗；若无弹窗，可查看
                  %TEMP%/nyanpasu-service-*.log 便于排查。
                </>
              )}
            </Alert>
          )}

          {serviceManager.serviceStatusError && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {serviceManager.serviceStatusError}
            </Alert>
          )}

          <SettingSummaryPanel columns={2}>
            {[
              {
                label: '服务进程',
                value: serviceStatusLabel,
                tone: serviceStatusTone,
              },
              {
                label: '服务模式',
                value: isServiceModeEnabled ? '已启用' : '未启用',
                tone: isServiceModeEnabled ? 'success' : 'default',
              },
            ].map((item) => (
              <SettingSummaryItem
                key={item.label}
                label={item.label}
                value={
                  <Chip
                    size="small"
                    color={item.tone as 'default' | 'success' | 'warning'}
                    variant="filled"
                    label={item.value}
                    sx={(theme) => ({
                      fontWeight: 800,
                      mt: 0.5,
                      ...(item.tone === 'default'
                        ? getDefaultChipStyles(theme)
                        : {}),
                    })}
                  />
                }
              />
            ))}
          </SettingSummaryPanel>

          <Divider />

          <Box display="flex" flexDirection="column" gap={1}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                服务操作面板
              </Typography>
              <Typography variant="caption" color="text.secondary">
                按安装、启动、停止、卸载的顺序组织，方便排障时逐步确认状态。
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                },
              }}
            >
              {actionItems.map((item) => (
                <Box
                  key={item.key}
                  sx={(theme) => ({
                    ...getTokenSurfaceStyles(theme, { elevated: true }),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    p: 1.25,
                    borderRadius: 2.5,
                    border: '1px solid',
                  })}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {item.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.5, lineHeight: 1.45 }}
                    >
                      {item.description}
                    </Typography>
                  </Box>

                  <Button
                    variant={item.variant}
                    size="medium"
                    color={item.color}
                    sx={{ fontWeight: 700, borderRadius: 2.5, minHeight: 38 }}
                    onClick={item.handleClick}
                    disabled={item.disabled}
                  >
                    {item.buttonLabel}
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </BaseCard>

      {/* 6-stage progress dialog */}
      <ServiceInstallDialog
        open={serviceManager.isInstalling}
        operation={serviceManager.currentOperation || 'install'}
        installStage={serviceManager.installStage}
      />
    </>
  )
}
