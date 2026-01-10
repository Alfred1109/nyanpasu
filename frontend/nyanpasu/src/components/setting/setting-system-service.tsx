import { useMemoizedFn } from 'ahooks'
import { useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
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
import {
  restartSidecar,
  useSetting,
  useSystemService,
} from '@nyanpasu/interface'
import { BaseCard, SwitchItem } from '@nyanpasu/ui'
import {
  ServerManualPromptDialogWrapper,
  useServerManualPromptDialog,
} from './modules/service-manual-prompt-dialog'

export const SettingSystemService = () => {
  const { t } = useTranslation()

  const { query, upsert } = useSystemService()

  const serviceMode = useSetting('enable_service_mode')
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [installAction, setInstallAction] = useState<
    'enable_service_mode' | 'start_service'
  >('enable_service_mode')

  const getInstallButtonString = () => {
    switch (query.data?.status) {
      case 'running':
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
  const getControlButtonString = () => {
    switch (query.data?.status) {
      case 'running': {
        return t('stop')
      }

      case 'stopped': {
        return t('start')
      }

      case 'not_installed': {
        return t('start')
      }

      default: {
        return ''
      }
    }
  }

  const isDisabled = query.data?.status === 'not_installed'
  const canControl =
    query.data?.status === 'running' ||
    query.data?.status === 'stopped' ||
    query.data?.status === 'not_installed'
  const isLoading = query.isLoading

  const promptDialog = useServerManualPromptDialog()

  const [installOrUninstallPending, startInstallOrUninstall] = useTransition()
  const handleInstallClick = useMemoizedFn(() => {
    startInstallOrUninstall(async () => {
      try {
        switch (query.data?.status) {
          case 'running':
          case 'stopped':
            await upsert.mutateAsync('uninstall')
            break

          case 'not_installed':
            await upsert.mutateAsync('install')
            break

          default:
            break
        }
        await restartSidecar()
      } catch (e) {
        const errorMessage = `${
          query.data?.status === 'not_installed'
            ? t('Failed to install')
            : t('Failed to uninstall')
        }: ${formatError(e)}`

        message(errorMessage, {
          kind: 'error',
          title: t('Error'),
        })
        // If the installation fails, prompt the user to manually install the service
        promptDialog.show(
          query.data?.status === 'not_installed' ? 'install' : 'uninstall',
        )
      }
    })
  })

  const handleInstallForAction = useMemoizedFn(() => {
    startInstallOrUninstall(async () => {
      try {
        await upsert.mutateAsync('install')
        await restartSidecar()

        if (installAction === 'enable_service_mode') {
          await serviceMode.upsert(true)
          return
        }

        try {
          await upsert.mutateAsync('start')
          await restartSidecar()
        } catch (e) {
          message(`Start failed: ${formatError(e)}`, {
            kind: 'error',
            title: t('Error'),
          })
          promptDialog.show('start')
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
  })

  const [serviceControlPending, startServiceControl] = useTransition()
  const handleControlClick = useMemoizedFn(() => {
    startServiceControl(async () => {
      try {
        switch (query.data?.status) {
          case 'running':
            await upsert.mutateAsync('stop')
            break

          case 'stopped':
            await upsert.mutateAsync('start')
            break

          case 'not_installed':
            setInstallAction('start_service')
            setShowInstallDialog(true)
            return

          default:
            break
        }
        await restartSidecar()
      } catch (e) {
        const errorMessage =
          query.data?.status === 'running'
            ? `Stop failed: ${formatError(e)}`
            : `Start failed: ${formatError(e)}`

        message(errorMessage, {
          kind: 'error',
          title: t('Error'),
        })
        // If start failed show a prompt to user to start the service manually
        promptDialog.show(query.data?.status === 'running' ? 'stop' : 'start')
      }
    })
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
              status: t(`${query.data?.status}`),
            })}
          />
          <div className="flex gap-2">
            {canControl && (
              <Button
                variant="contained"
                onClick={handleControlClick}
                loading={serviceControlPending}
                disabled={
                  isLoading ||
                  installOrUninstallPending ||
                  serviceControlPending
                }
              >
                {getControlButtonString()}
              </Button>
            )}

            <Button
              variant="contained"
              onClick={handleInstallClick}
              loading={installOrUninstallPending}
              disabled={
                isLoading || installOrUninstallPending || serviceControlPending
              }
            >
              {getInstallButtonString()}
            </Button>

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
            disabled={
              isLoading || installOrUninstallPending || serviceControlPending
            }
          >
            {t('Install')}
          </Button>
        </DialogActions>
      </Dialog>
    </BaseCard>
  )
}

export default SettingSystemService
