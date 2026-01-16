import { useMemoizedFn } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useServiceManager } from '@/hooks/use-service-manager'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import { useSetting } from '@nyanpasu/interface'
import { BaseCard, SwitchItem } from '@nyanpasu/ui'
import { ServiceInstallDialog } from './modules/service-install-dialog'
import {
  ServerManualPromptDialogWrapper,
  useServerManualPromptDialog,
} from './modules/service-manual-prompt-dialog'

export const SettingSystemService = () => {
  const { t } = useTranslation()

  // 使用统一的服务管理 hook
  const serviceManager = useServiceManager()
  const serviceMode = useSetting('enable_service_mode')
  const promptDialog = useServerManualPromptDialog()

  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [installAction, setInstallAction] = useState<
    'enable_service_mode' | 'start_service'
  >('enable_service_mode')

  const getInstallButtonString = () => {
    switch (serviceManager.serviceStatus) {
      case 'stopped': {
        return t('uninstall')
      }

      case 'not_installed': {
        return t('install')
      }

      default: {
        return t('install')
      }
    }
  }

  const isDisabled = serviceManager.serviceStatus === 'not_installed'

  const handleInstallClick = useMemoizedFn(async () => {
    try {
      const isInstall = serviceManager.serviceStatus === 'not_installed'

      if (isInstall) {
        // 安装服务
        await serviceManager.installService()

        message(t('Service installed successfully'), {
          kind: 'info',
          title: t('Success'),
        })
      } else {
        // 卸载服务
        await serviceManager.uninstallService()

        message(t('Service uninstalled successfully'), {
          kind: 'info',
          title: t('Success'),
        })
      }
    } catch (e) {
      const errorMessage = `${
        serviceManager.serviceStatus === 'not_installed'
          ? t('Failed to install')
          : t('Failed to uninstall')
      }: ${formatError(e)}`

      message(errorMessage, {
        kind: 'error',
        title: t('Error'),
      })

      // 如果安装/卸载失败，提示用户手动操作
      promptDialog.show(
        serviceManager.serviceStatus === 'not_installed'
          ? 'install'
          : 'uninstall',
      )
    }
  })

  const handleInstallForAction = useMemoizedFn(async () => {
    try {
      // 安装服务
      const success = await serviceManager.installService({
        autoStart: installAction === 'enable_service_mode',
      })

      if (!success) {
        return
      }

      // 如果需要启用服务模式
      if (installAction === 'enable_service_mode') {
        try {
          await serviceMode.upsert(true)
          message(t('Service mode enabled successfully'), {
            kind: 'info',
            title: t('Success'),
          })
        } catch (e) {
          message(`${t('Failed to enable service mode')}: ${formatError(e)}`, {
            kind: 'error',
            title: t('Error'),
          })
        }
      }
    } catch (e) {
      const errorMessage = `${t('Failed to install')}: ${formatError(e)}`
      message(errorMessage, {
        kind: 'error',
        title: t('Error'),
      })
      promptDialog.show('install')
    }
  })

  const handleServiceModeToggle = useMemoizedFn(() => {
    if (!serviceMode.value && isDisabled) {
      setInstallAction('enable_service_mode')
      setShowInstallDialog(true)
      return
    }
    serviceMode.upsert(!serviceMode.value)
  })

  return (
    <BaseCard label={t('System Service')}>
      <ServerManualPromptDialogWrapper />

      {/* 统一的服务安装进度 Dialog */}
      <ServiceInstallDialog
        open={serviceManager.isInstalling}
        installStage={serviceManager.installStage}
        canCancel={serviceManager.canCancel}
        handleCancel={serviceManager.cancelInstallation}
      />

      <List disablePadding>
        <SwitchItem
          label={t('Service Mode')}
          disabled={false}
          checked={serviceMode.value || false}
          onChange={handleServiceModeToggle}
        />

        {isDisabled && (
          <ListItem sx={{ pl: 0, pr: 0 }}>
            <Typography>
              {t(
                'Information: To enable service mode, make sure the Clash Nyanpasu service is installed and started',
              )}
            </Typography>
          </ListItem>
        )}

        <ListItem sx={{ pl: 0, pr: 0 }}>
          <ListItemText
            primary={t('Current Status', {
              status: t(`${serviceManager.serviceStatus}`),
            })}
          />
          <div className="flex gap-2">
            {(serviceManager.serviceStatus === 'not_installed' ||
              serviceManager.serviceStatus === 'stopped') && (
              <Button
                variant="contained"
                onClick={handleInstallClick}
                disabled={serviceManager.isInstalling}
              >
                {getInstallButtonString()}
              </Button>
            )}

            {import.meta.env.DEV && (
              <Button
                variant="contained"
                onClick={() => promptDialog.show('install')}
              >
                {t('Prompt')}
              </Button>
            )}
          </div>
        </ListItem>
      </List>

      {/* 安装确认 Dialog */}
      <Dialog
        open={showInstallDialog}
        onClose={() => setShowInstallDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('Install system service')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(
              'The system service is not installed. Do you want to install it now to enable service mode?',
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInstallDialog(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => {
              setShowInstallDialog(false)
              handleInstallForAction()
            }}
            variant="contained"
            disabled={serviceManager.isInstalling}
          >
            {t('Install')}
          </Button>
        </DialogActions>
      </Dialog>
    </BaseCard>
  )
}

export default SettingSystemService
