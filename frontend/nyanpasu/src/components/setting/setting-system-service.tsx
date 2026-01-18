import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Button, Typography, Box, Alert } from '@mui/material'
import { IS_IN_TAURI } from '@/utils/tauri'
import { BaseCard } from '@nyanpasu/ui'
import { useServiceManager } from '@/hooks/use-service-manager'
import ServiceInstallDialog from './modules/service-install-dialog'

export default function SettingSystemService() {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const isInTauri = IS_IN_TAURI
  
  const serviceManager = useServiceManager()
  
  console.log('SettingSystemService render - using full service manager with 6-stage progress')

  const handleInstallService = async () => {
    if (!isInTauri) {
      setMessage('该功能仅在桌面端可用，请使用 tauri dev 或安装版 exe 测试。')
      return
    }
    setMessage('')
    try {
      const success = await serviceManager.installService({ autoStart: false })
      if (success) {
        setMessage('服务安装成功！')
      } else {
        setMessage('服务安装被取消或超时')
      }
    } catch (error) {
      console.error('Service install error:', error)
      setMessage(`服务安装失败: ${error}`)
    }
  }

  const handleStartService = async () => {
    if (!isInTauri) {
      setMessage('该功能仅在桌面端可用，请使用 tauri dev 或安装版 exe 测试。')
      return
    }
    setMessage('')
    try {
      // Use installService with autoStart to properly start the service
      const success = await serviceManager.installService({ autoStart: true })
      if (success) {
        setMessage('服务启动成功！')
      } else {
        setMessage('服务启动被取消或超时')
      }
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
      const success = await serviceManager.uninstallService()
      if (success) {
        setMessage('服务卸载成功！')
      } else {
        setMessage('服务卸载失败')
      }
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
      // For stop, we need to implement it in the service manager or use a different approach
      setMessage('服务停止功能开发中...')
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
              该功能仅在桌面端可用（Tauri WebView）。浏览器 Dev 模式无法调用系统服务。
            </Alert>
          )}
          
          {message && (
            <Alert severity={message.includes('失败') ? 'error' : 'success'} sx={{ mt: 1 }}>
              {message}
            </Alert>
          )}

          {/* Service status display */}
          {serviceManager.serviceStatus && (
            <Typography variant="body2" color="text.secondary">
              服务状态: {serviceManager.serviceStatus === 'running' ? '运行中' : 
                        serviceManager.serviceStatus === 'stopped' ? '已停止' : '未安装'}
            </Typography>
          )}
          
          <Box display="flex" gap={1} flexWrap="wrap">
            <Button
              variant="contained"
              size="small"
              onClick={handleInstallService}
              disabled={!isInTauri || serviceManager.isInstalling || serviceManager.isServiceInstalled}
            >
              {serviceManager.isInstalling ? '安装中...' : '安装服务'}
            </Button>
            
            <Button
              variant="outlined"
              size="small"
              onClick={handleStartService}
              disabled={!isInTauri || serviceManager.isInstalling || !serviceManager.isServiceInstalled || serviceManager.serviceStatus === 'running'}
            >
              启动服务
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={handleStopService}
              disabled={!isInTauri || serviceManager.isInstalling || !serviceManager.isServiceInstalled || serviceManager.serviceStatus !== 'running'}
            >
              停止服务
            </Button>

            <Button
              variant="outlined"
              size="small" 
              color="error"
              onClick={handleUninstallService}
              disabled={!isInTauri || serviceManager.isInstalling || !serviceManager.isServiceInstalled}
            >
              卸载服务
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
        onManualUacConfirm={() => {
          console.log('✓ Manual UAC confirmation received - proceeding with installation')
          // 手动确认UAC权限，继续安装流程
          // 这个按钮应该在WAITING_UAC阶段显示
        }}
      />
    </>
  )
}
