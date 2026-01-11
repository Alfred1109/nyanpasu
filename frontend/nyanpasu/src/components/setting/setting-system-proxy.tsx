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
  InputAdornment,
  List,
  ListItem,
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
import { PermissionDialog } from './modules/permission-dialog'
import { PaperSwitchButton } from './modules/system-proxy'

const TunModeButton = () => {
  const { t } = useTranslation()
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)

  const tunMode = useSetting('enable_tun_mode')
  const serviceMode = useSetting('enable_service_mode')

  const handleTunMode = useLockFn(async () => {
    // 如果要启用TUN模式且不在服务模式下，先检查权限
    if (!tunMode.value && !serviceMode.value) {
      setShowPermissionDialog(true)
      return
    }

    try {
      await toggleTunMode()
    } catch (error) {
      message(`Activation TUN Mode failed! \n Error: ${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  const handlePermissionConfirm = useLockFn(async () => {
    setShowPermissionDialog(false)
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
      <PermissionDialog
        open={showPermissionDialog}
        onClose={() => setShowPermissionDialog(false)}
        onConfirm={handlePermissionConfirm}
        permissionType="tun"
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
    <PaperSwitchButton
      label={t('System Proxy')}
      checked={Boolean(systemProxy.value)}
      onClick={handleSystemProxy}
    />
  )
}

const ProxyGuardSwitch = () => {
  const { t } = useTranslation()

  const proxyGuard = useSetting('enable_proxy_guard')

  const handleProxyGuard = useLockFn(async () => {
    try {
      await proxyGuard.upsert(!proxyGuard.value)
    } catch (error) {
      message(`Activation Proxy Guard failed!`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  return (
    <SwitchItem
      label={t('Proxy Guard')}
      checked={Boolean(proxyGuard.value)}
      onClick={handleProxyGuard}
    />
  )
}

const ProxyGuardInterval = () => {
  const { t } = useTranslation()

  const proxyGuardInterval = useSetting('proxy_guard_interval')

  return (
    <NumberItem
      label={t('Guard Interval')}
      value={proxyGuardInterval.value || 0}
      checkEvent={(input) => input <= 0}
      checkLabel={t('The interval must be greater than 0 second')}
      onApply={(value) => {
        proxyGuardInterval.upsert(value)
      }}
      textFieldProps={{
        inputProps: {
          'aria-autocomplete': 'none',
        },
        InputProps: {
          endAdornment: (
            <InputAdornment position="end">{t('seconds')}</InputAdornment>
          ),
        },
      }}
    />
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
          // 输入为空 → 重置为默认规则
          systemProxyBypass.upsert(DEFAULT_BYPASS)
        } else {
          // 正常写入用户配置
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

      {Object.entries(data ?? []).map(([key, value], index) => {
        return (
          <div key={index} className="flex w-full leading-8">
            <div className="w-28 capitalize">{key}:</div>

            <div className="text-warp flex-1 break-all">{String(value)}</div>
          </div>
        )
      })}
    </ListItem>
  )
}

export const SettingSystemProxy = () => {
  const { t } = useTranslation()

  const [expand, setExpand] = useState(false)

  const { query, upsert: serviceUpsert } = useSystemService()
  const serviceMode = useSetting('enable_service_mode')
  const isServiceInstalled = query.data?.status !== 'not_installed'
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [serviceActionPending, setServiceActionPending] = useState(false)
  const [installAction, setInstallAction] = useState<
    'enable_service_mode' | 'start_service' | 'install_service'
  >('enable_service_mode')

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
    switch (query.data?.status) {
      case 'running':
        return t('running')
      case 'stopped':
        return t('stopped')
      default:
        return t(query.data?.status || 'unknown')
    }
  }

  const handleServiceModeToggle = useLockFn(async () => {
    if (!serviceMode.value && !isServiceInstalled) {
      setInstallAction('enable_service_mode')
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
      setServiceActionPending(true)
      await serviceUpsert.mutateAsync('install')

      if (
        installAction === 'enable_service_mode' ||
        installAction === 'start_service'
      ) {
        await serviceUpsert.mutateAsync('start')
      }

      if (installAction === 'enable_service_mode') {
        await serviceMode.upsert(true)
      }
    } catch (error) {
      message(
        `${t('Failed to install system service')}\n${formatError(error)}`,
        {
          title: t('Error'),
          kind: 'error',
        },
      )
    } finally {
      setServiceActionPending(false)
    }
  })

  const handleServiceControlClick = useLockFn(async () => {
    if (!isServiceInstalled) {
      setInstallAction('start_service')
      setShowInstallDialog(true)
      return
    }

    const status = query.data?.status
    if (status !== 'running' && status !== 'stopped') return

    try {
      setServiceActionPending(true)
      await serviceUpsert.mutateAsync(status === 'running' ? 'stop' : 'start')
    } catch (error) {
      message(`${t('Error')}: ${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setServiceActionPending(false)
    }
  })

  const getInstallDialogContent = () => {
    switch (installAction) {
      case 'start_service':
        return t(
          'The system service is not installed. Do you want to install and start it now?',
        )
      case 'install_service':
        return t('The system service is not installed. Do you want to install it now?')
      case 'enable_service_mode':
      default:
        return t(
          'The system service is not installed. Do you want to install it now to enable service mode?',
        )
    }
  }

  return (
    <BaseCard
      label={t('System Settings')}
      labelChildren={
        <ExpandMore expand={expand} onClick={() => setExpand(!expand)} />
      }
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 6 }}>
          <SystemProxyButton />
        </Grid>

        <Grid size={{ xs: 6 }}>
          <TunModeButton />
        </Grid>
      </Grid>

      {/* 服务模式部分 */}
      <List disablePadding sx={{ pt: 1 }}>
        <SwitchItem
          label={t('Service Mode')}
          disabled={false}
          checked={serviceMode.value || false}
          onChange={handleServiceModeToggle}
        />

        <ListItem sx={{ pl: 0, pr: 0 }}>
          <div className="text-base leading-10">{t('Status')}</div>
          <div className="ml-auto">
            <span
              style={{ color: getStatusColor() }}
              className="text-sm font-medium"
            >
              {getStatusText()}
            </span>
          </div>
        </ListItem>

        <ListItem sx={{ pl: 0, pr: 0 }}>
          <div className="ml-auto flex gap-2">
            {!isServiceInstalled && (
              <Button
                variant="contained"
                onClick={() => {
                  setInstallAction('install_service')
                  setShowInstallDialog(true)
                }}
                disabled={serviceActionPending || query.isLoading}
              >
                {t('install')}
              </Button>
            )}

            <Button
              variant="contained"
              onClick={handleServiceControlClick}
              disabled={serviceActionPending || query.isLoading}
            >
              {query.data?.status === 'running' ? t('stop') : t('start')}
            </Button>
          </div>
        </ListItem>

        {!isServiceInstalled && (
          <ListItem sx={{ pl: 0, pr: 0 }}>
            <div className="text-sm text-gray-500">
              {t(
                'Install system service to enable service mode and avoid permission issues',
              )}
            </div>
          </ListItem>
        )}
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
            {getInstallDialogContent()}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInstallDialog(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleInstallConfirm}
            variant="contained"
            disabled={serviceActionPending || query.isLoading}
          >
            {t('Install')}
          </Button>
        </DialogActions>
      </Dialog>

      <Expand open={expand}>
        <List disablePadding sx={{ pt: 1 }}>
          <ProxyGuardSwitch />

          <ProxyGuardInterval />

          <SystemProxyBypass />

          <CurrentSystemProxy />
        </List>
      </Expand>
    </BaseCard>
  )
}

export default SettingSystemProxy
