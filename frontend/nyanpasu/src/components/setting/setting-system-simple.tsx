import { useLockFn } from 'ahooks'
import { useState } from 'react'
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
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  toggleSystemProxy,
  toggleTunMode,
  useSetting,
  useSystemService,
} from '@nyanpasu/interface'
import { BaseCard, SwitchItem } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'

const SystemProxyButton = () => {
  const { t } = useTranslation()

  const systemProxy = useSetting('enable_system_proxy')

  const handleSystemProxy = useLockFn(async () => {
    try {
      await toggleSystemProxy()
    } catch (error) {
      message(`Activation System Proxy failed!`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  return (
    <>
      <PaperSwitchButton
        label={t('System Proxy')}
        checked={Boolean(systemProxy.value)}
        onClick={handleSystemProxy}
      />
    </>
  )
}

const TunModeButton = () => {
  const { t } = useTranslation()

  const tunMode = useSetting('enable_tun_mode')

  const handleTunMode = useLockFn(async () => {
    try {
      await toggleTunMode()
    } catch (error) {
      message(`Activation TUN Mode failed! \n Error: ${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  return (
    <>
      <PaperSwitchButton
        label={t('TUN Mode')}
        checked={Boolean(tunMode.value)}
        onClick={handleTunMode}
      />
    </>
  )
}

export const SettingSystemSimple = () => {
  const { t } = useTranslation()
  const { query, upsert: serviceUpsert } = useSystemService()
  const serviceMode = useSetting('enable_service_mode')
  const [showInstallDialog, setShowInstallDialog] = useState(false)

  const isServiceInstalled = query.data?.status !== 'not_installed'

  const handleServiceModeToggle = useLockFn(async () => {
    if (!serviceMode.value && !isServiceInstalled) {
      setShowInstallDialog(true)
      return
    }

    try {
      await serviceMode.upsert(!serviceMode.value)
    } catch (error) {
      message(`Service Mode toggle failed! \n Error: ${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  const handleInstallConfirm = useLockFn(async () => {
    setShowInstallDialog(false)
    try {
      await serviceUpsert.mutateAsync('install')
      await serviceUpsert.mutateAsync('start')
      await serviceMode.upsert(true)
    } catch (error) {
      message(
        `${t('Failed to install system service')}\n${formatError(error)}`,
        {
          title: t('Error'),
          kind: 'error',
        },
      )
    }
  })

  const getStatusColor = () => {
    switch (query.data?.status) {
      case 'running':
        return 'success.main'
      case 'stopped':
        return 'warning.main'
      case 'not_installed':
        return 'error.main'
      default:
        return 'text.secondary'
    }
  }

  const getStatusText = () => {
    if (!isServiceInstalled) {
      return t('Not Installed')
    }
    return serviceMode.value
      ? `${t('Service Mode')} - ${t(query.data?.status || 'unknown')}`
      : t('Normal Mode')
  }

  return (
    <BaseCard label={t('System Settings')}>
      {/* 代理模式选择 */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6 }}>
          <SystemProxyButton />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TunModeButton />
        </Grid>
      </Grid>

      <List disablePadding sx={{ pt: 1 }}>
        {/* 服务模式 */}
        <SwitchItem
          label={t('Service Mode')}
          disabled={false}
          checked={serviceMode.value || false}
          onChange={handleServiceModeToggle}
        />

        {/* 状态显示 */}
        <ListItem sx={{ pl: 0, pr: 0 }}>
          <ListItemText
            primary={
              <div className="flex items-center gap-2">
                <span>{t('Status')}</span>
                <span
                  style={{ color: getStatusColor() }}
                  className="text-sm font-medium"
                >
                  {getStatusText()}
                </span>
              </div>
            }
            secondary={
              !isServiceInstalled
                ? t(
                    'Install system service to enable service mode and avoid permission issues',
                  )
                : serviceMode.value
                  ? t('Running with elevated privileges')
                  : t('Running in normal mode')
            }
          />
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
          <Button onClick={handleInstallConfirm} variant="contained">
            {t('Install')}
          </Button>
        </DialogActions>
      </Dialog>
    </BaseCard>
  )
}

export default SettingSystemSimple
