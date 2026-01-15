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
  Divider,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  toggleSystemProxy,
  toggleTunMode,
  useSetting,
  useSystemProxy,
  useSystemService,
} from '@nyanpasu/interface'
import {
  BaseCard,
  Expand,
  ExpandMore,
  NumberItem,
  SwitchItem,
  TextItem,
} from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'

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

const ServiceModeSection = () => {
  const { t } = useTranslation()
  const { query, upsert: serviceUpsert } = useSystemService()
  const serviceMode = useSetting('enable_service_mode')
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [showUninstallDialog, setShowUninstallDialog] = useState(false)
  const [serviceActionPending, setServiceActionPending] = useState(false)

  const serviceStatus = query.data?.status
  const isServiceInstalled =
    !!serviceStatus && serviceStatus !== 'not_installed'

  const handleServiceModeToggle = useLockFn(async () => {
    if (!serviceMode.value && !isServiceInstalled) {
      setShowInstallDialog(true)
      return
    }

    try {
      setServiceActionPending(true)

      if (!serviceMode.value) {
        const status = query.data?.status
        if (isServiceInstalled && status === 'stopped') {
          await serviceUpsert.mutateAsync('start')
        }
        await serviceMode.upsert(true)
      } else {
        const status = query.data?.status
        if (isServiceInstalled && status === 'running') {
          await serviceUpsert.mutateAsync('stop')
        }
        await serviceMode.upsert(false)
      }
    } catch (error) {
      message(`Service Mode toggle failed!`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setServiceActionPending(false)
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

  const handleUninstallConfirm = useLockFn(async () => {
    setShowUninstallDialog(false)
    try {
      setServiceActionPending(true)

      const status = query.data?.status
      if (isServiceInstalled && status === 'running') {
        await serviceUpsert.mutateAsync('stop')
      }

      if (serviceMode.value) {
        await serviceMode.upsert(false)
      }

      await serviceUpsert.mutateAsync('uninstall')
    } catch (error) {
      message(`${t('Error')}: ${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setServiceActionPending(false)
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
    if (query.isLoading) {
      return t('loading')
    }
    if (query.isError) {
      return t('Error')
    }
    if (!query.data?.status) {
      return t('unknown')
    }
    return t(`${query.data?.status || 'unknown'}`)
  }

  return (
    <>
      <SwitchItem
        label={t('Service Mode')}
        disabled={
          !(typeof window !== 'undefined' && '__TAURI__' in window) ||
          serviceActionPending ||
          query.isLoading
        }
        checked={serviceMode.value || false}
        onChange={handleServiceModeToggle}
      />

      <ListItem sx={{ pl: 0, pr: 0 }}>
        <ListItemText
          primary={
            <div className="flex items-center gap-2">
              <span>{t('Service Status')}</span>
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
              ? t('Service mode provides better stability and permissions')
              : t('Service is running with elevated privileges')
          }
        />
      </ListItem>

      {typeof window !== 'undefined' &&
        '__TAURI__' in window &&
        !isServiceInstalled && (
          <ListItem sx={{ pl: 0, pr: 0 }}>
            <Typography variant="body2" color="text.secondary">
              {t(
                'Install the system service to enable service mode and avoid permission issues',
              )}
            </Typography>
          </ListItem>
        )}

      {typeof window !== 'undefined' &&
        '__TAURI__' in window &&
        isServiceInstalled &&
        !serviceMode.value &&
        query.data?.status === 'stopped' && (
          <ListItem sx={{ pl: 0, pr: 0 }}>
            <div className="ml-auto">
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => setShowUninstallDialog(true)}
                disabled={serviceActionPending || query.isLoading}
              >
                {t('uninstall')}
              </Button>
            </div>
          </ListItem>
        )}

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
              'Install system service to enable service mode and avoid permission issues',
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

      <Dialog
        open={showUninstallDialog}
        onClose={() => setShowUninstallDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('uninstall')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(
              'Are you sure you want to uninstall the system service? This will disable service mode.',
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUninstallDialog(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleUninstallConfirm}
            variant="contained"
            color="error"
            disabled={serviceActionPending || query.isLoading}
          >
            {t('uninstall')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

const ProxyGuardSection = () => {
  const { t } = useTranslation()
  const proxyGuard = useSetting('enable_proxy_guard')
  const proxyGuardInterval = useSetting('proxy_guard_interval')

  return (
    <>
      <SwitchItem
        label={t('Proxy Guard')}
        checked={Boolean(proxyGuard.value)}
        onChange={() => proxyGuard.upsert(!proxyGuard.value)}
      />

      {proxyGuard.value && (
        <NumberItem
          label={t('Guard Interval')}
          value={proxyGuardInterval.value || 10}
          checkEvent={(input) => input <= 0}
          checkLabel={t('The interval must be greater than 0 second')}
          onApply={(value) => proxyGuardInterval.upsert(value)}
          textFieldProps={{
            InputProps: {
              endAdornment: (
                <InputAdornment position="end">{t('seconds')}</InputAdornment>
              ),
            },
          }}
        />
      )}
    </>
  )
}

const DEFAULT_BYPASS =
  'localhost;127.;192.168.;10.;172.16.;172.17.;172.18.;172.19.;172.20.;172.21.;172.22.;172.23.;172.24.;172.25.;172.26.;172.27.;172.28.;172.29.;172.30.;172.31.*'

const SystemProxyBypass = () => {
  const { t } = useTranslation()
  const systemProxyBypass = useSetting('system_proxy_bypass')

  return (
    <TextItem
      label={t('Proxy Bypass')}
      value={systemProxyBypass.data || ''}
      onApply={(value) => {
        if (!value || value.trim() === '') {
          systemProxyBypass.upsert(DEFAULT_BYPASS)
        } else {
          systemProxyBypass.upsert(value)
        }
      }}
    />
  )
}

const CurrentSystemProxy = () => {
  const { t } = useTranslation()
  const { data } = useSystemProxy()

  return (
    <ListItem
      className="w-full! flex-col! items-start! select-text"
      sx={{ pl: 0, pr: 0 }}
    >
      <div className="text-base leading-10">{t('Current System Proxy')}</div>
      {Object.entries(data ?? []).map(([key, value], index) => (
        <div key={index} className="flex w-full leading-8">
          <div className="w-28 capitalize">{key}:</div>
          <div className="text-warp flex-1 break-all">{String(value)}</div>
        </div>
      ))}
    </ListItem>
  )
}

export const SettingSystemUnified = () => {
  const { t } = useTranslation()
  const [expand, setExpand] = useState(false)

  return (
    <BaseCard
      label={t('System Settings')}
      labelChildren={
        <ExpandMore expand={expand} onClick={() => setExpand(!expand)} />
      }
    >
      {/* 代理模式选择 */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6 }}>
          <SystemProxyButton />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TunModeButton />
        </Grid>
      </Grid>

      <Expand open={expand}>
        <List disablePadding sx={{ pt: 1 }}>
          {/* 服务模式部分 */}
          <ServiceModeSection />

          <Divider sx={{ my: 1 }} />

          {/* 代理守护部分 */}
          <ProxyGuardSection />

          <Divider sx={{ my: 1 }} />

          {/* 代理绕过规则 */}
          <SystemProxyBypass />

          {/* 当前系统代理状态 */}
          <CurrentSystemProxy />
        </List>
      </Expand>
    </BaseCard>
  )
}

export default SettingSystemUnified
