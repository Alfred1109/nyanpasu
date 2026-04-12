import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useServiceManager } from '@/hooks/use-service-manager'
import { IS_IN_TAURI } from '@/utils/tauri'
import { Alert, Box, Button, Typography } from '@mui/material'
import { useSetting } from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import ServiceInstallDialog from './modules/service-install-dialog'

export default function SettingSystemService() {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const isInTauri = IS_IN_TAURI

  const serviceManager = useServiceManager()
  const serviceMode = useSetting('enable_service_mode')
  const isServiceModeEnabled = Boolean(serviceMode.value)
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
          wasInstalled ? '启用服务模式被取消或超时' : '服务安装被取消或超时',
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

  return (
    <>
      <BaseCard label={t('System Service')}>
        <Box display="flex" flexDirection="column" gap={2}>
          <Typography variant="body2" color="text.secondary">
            {t('Install system service for better TUN mode support')}
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

          {/* Service status display */}
          {serviceManager.serviceStatus && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                服务状态:{' '}
                {serviceManager.serviceStatus === 'running'
                  ? '运行中'
                  : serviceManager.serviceStatus === 'stopped'
                    ? '已停止'
                    : '未安装'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                服务模式: {isServiceModeEnabled ? '已启用' : '未启用'}
              </Typography>
            </Box>
          )}

          <Box display="flex" gap={1} flexWrap="wrap">
            <Button
              variant="contained"
              size="small"
              onClick={handleInstallService}
              disabled={
                !isInTauri ||
                serviceManager.isInstalling ||
                (serviceManager.isServiceInstalled && isServiceModeEnabled)
              }
            >
              {primaryActionLabel}
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={handleStartService}
              disabled={
                !isInTauri ||
                serviceManager.isInstalling ||
                !serviceManager.isServiceInstalled ||
                !isServiceModeEnabled ||
                serviceManager.serviceStatus === 'running'
              }
            >
              {startActionLabel}
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={handleStopService}
              disabled={
                !isInTauri ||
                serviceManager.isInstalling ||
                !serviceManager.isServiceInstalled ||
                serviceManager.serviceStatus !== 'running'
              }
            >
              {stopActionLabel}
            </Button>

            <Button
              variant="outlined"
              size="small"
              color="error"
              onClick={handleUninstallService}
              disabled={
                !isInTauri ||
                serviceManager.isInstalling ||
                !serviceManager.isServiceInstalled
              }
            >
              {uninstallActionLabel}
            </Button>
          </Box>
        </Box>
      </BaseCard>

      {/* 6-stage progress dialog */}
      <ServiceInstallDialog
        open={serviceManager.isInstalling}
        operation={serviceManager.currentOperation || 'install'}
        installStage={serviceManager.installStage}
        canCancel={serviceManager.canCancel}
        handleCancel={serviceManager.cancelInstallation}
      />
    </>
  )
}
