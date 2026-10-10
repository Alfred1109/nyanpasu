import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseServiceManagerReturn } from '@/hooks/use-service-manager'
import { IS_IN_TAURI } from '@/utils/tauri'
import { Alert, Box, Button } from '@mui/material'
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

  const isServiceModeEnabled = serviceManager.serviceModeEnabled === true
  const canReadServiceStatus = serviceManager.query.isSuccess
  const canReadSettings = serviceManager.settingsQuery.isSuccess
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
    : serviceManager.query.isPending
      ? '正在检查服务'
      : serviceManager.query.isError
        ? '服务状态不可用'
        : serviceManager.settingsQuery.isPending
          ? '正在读取设置'
          : serviceManager.settingsQuery.isError
            ? '服务模式状态不可用'
            : !serviceManager.isServiceInstalled
              ? '安装服务并启用'
              : isServiceModeEnabled
                ? '服务模式已启用'
                : '启用服务模式'
  const startActionLabel = !serviceManager.isServiceInstalled
    ? '启动服务'
    : !canReadSettings
      ? '服务模式状态不可用'
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
  const serviceStatusLabel = serviceManager.query.isError
    ? '读取失败'
    : serviceManager.query.isPending && !serviceManager.query.data
      ? '正在检查'
      : serviceManager.serviceStatus === 'running'
        ? '运行中'
        : serviceManager.serviceStatus === 'stopped'
          ? '已停止'
          : serviceManager.serviceStatus === 'not_installed'
            ? '未安装'
            : '状态未知'
  const serviceModeLabel = !canReadSettings
    ? serviceManager.settingsQuery.isError
      ? '模式读取失败'
      : '正在读取模式'
    : isServiceModeEnabled
      ? '模式已启用'
      : '模式未启用'
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
      buttonLabel: primaryActionLabel,
      variant: 'contained' as const,
      color: 'primary' as const,
      handleClick: handleInstallService,
      disabled:
        !isInTauri ||
        serviceManager.isInstalling ||
        !canReadServiceStatus ||
        !canReadSettings ||
        (serviceManager.isServiceInstalled && isServiceModeEnabled),
    },
    {
      key: 'start',
      buttonLabel: startActionLabel,
      variant: 'outlined' as const,
      color: 'primary' as const,
      handleClick: handleStartService,
      disabled:
        !isInTauri ||
        serviceManager.isInstalling ||
        !canReadServiceStatus ||
        !canReadSettings ||
        !serviceManager.isServiceInstalled ||
        !isServiceModeEnabled ||
        serviceManager.serviceStatus === 'running',
    },
    {
      key: 'stop',
      buttonLabel: stopActionLabel,
      variant: 'outlined' as const,
      color: 'primary' as const,
      handleClick: handleStopService,
      disabled:
        !isInTauri ||
        serviceManager.isInstalling ||
        !canReadServiceStatus ||
        !serviceManager.isServiceInstalled ||
        serviceManager.serviceStatus !== 'running',
    },
    {
      key: 'uninstall',
      buttonLabel: uninstallActionLabel,
      variant: 'outlined' as const,
      color: 'error' as const,
      handleClick: handleUninstallService,
      disabled:
        !isInTauri ||
        serviceManager.isInstalling ||
        !canReadServiceStatus ||
        !serviceManager.isServiceInstalled,
    },
  ]

  return (
    <>
      <BaseCard label={t('System Service')}>
        <Box display="flex" flexDirection="column" gap={1}>
          <SettingSummaryPanel columns={2}>
            <SettingSummaryItem label="服务状态" value={serviceStatusLabel} />
            <SettingSummaryItem label="服务模式" value={serviceModeLabel} />
          </SettingSummaryPanel>
          {!isInTauri && (
            <Alert
              severity="info"
              sx={{
                py: 0.5,
                '& .MuiAlert-message': {
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                },
              }}
            >
              该功能仅在桌面端可用（Tauri WebView）。浏览器 Dev
              模式无法调用系统服务。
            </Alert>
          )}

          {(message || serviceManager.lastError) && (
            <Alert
              severity={feedbackSeverity}
              sx={{
                py: 0.5,
                '& .MuiAlert-message': {
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                },
              }}
            >
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

          {(serviceManager.serviceStatusError ||
            serviceManager.settingsQuery.isError) && (
            <Alert
              severity="error"
              sx={{
                py: 0.5,
                '& .MuiAlert-message': {
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                },
              }}
            >
              {serviceManager.serviceStatusError}
              {serviceManager.settingsQuery.isError && (
                <>
                  {serviceManager.serviceStatusError && <br />}
                  服务模式设置读取失败：
                  {String(serviceManager.settingsQuery.error)}
                </>
              )}
            </Alert>
          )}

          <Box
            sx={{
              display: 'grid',
              gap: 0.75,
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
            }}
          >
            {actionItems.map((item) => (
              <Button
                key={item.key}
                variant={item.variant}
                size="medium"
                color={item.color}
                onClick={item.handleClick}
                disabled={item.disabled}
                fullWidth
                sx={{
                  fontWeight: 700,
                  minHeight: 38,
                  lineHeight: 1.2,
                  whiteSpace: 'normal',
                }}
              >
                {item.buttonLabel}
              </Button>
            ))}
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
