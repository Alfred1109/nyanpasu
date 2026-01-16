import { useLockFn } from 'ahooks'
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
} from '@nyanpasu/interface'
import {
  BaseCard,
  Expand,
  ExpandMore,
  NumberItem,
  SwitchItem,
  TextItem,
} from '@nyanpasu/ui'
import { ServiceInstallDialog } from './modules/service-install-dialog'
import {
  ServerManualPromptDialogWrapper,
  useServerManualPromptDialog,
} from './modules/service-manual-prompt-dialog'
import { PaperSwitchButton } from './modules/system-proxy'

type ModeAction = 'system_proxy' | 'tun'

const TunModeButton = ({
  serviceStatus,
  onRequireInstall,
  disabled,
}: {
  serviceStatus?: string
  onRequireInstall: (action: ModeAction) => void
  disabled?: boolean
}) => {
  const { t } = useTranslation()

  const tunMode = useSetting('enable_tun_mode')

  const handleTunMode = useLockFn(async () => {
    if (!tunMode.value && serviceStatus === 'not_installed') {
      onRequireInstall('tun')
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

  return (
    <PaperSwitchButton
      label={t('TUN Mode')}
      checked={Boolean(tunMode.value)}
      onClick={handleTunMode}
      disabled={disabled}
    />
  )
}

const SystemProxyButton = ({
  serviceStatus,
  onRequireInstall,
  disabled,
}: {
  serviceStatus?: string
  onRequireInstall: (action: ModeAction) => void
  disabled?: boolean
}) => {
  const { t } = useTranslation()

  const systemProxy = useSetting('enable_system_proxy')

  const handleSystemProxy = useLockFn(async () => {
    if (!systemProxy.value && serviceStatus === 'not_installed') {
      onRequireInstall('system_proxy')
      return
    }
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
      disabled={disabled}
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

  const isInTauri = typeof window !== 'undefined' && '__TAURI__' in window

  const [expand, setExpand] = useState(false)

  // 使用统一的服务管理 hook
  const serviceManager = useServiceManager()
  const systemProxy = useSetting('enable_system_proxy')
  const tunMode = useSetting('enable_tun_mode')
  const promptDialog = useServerManualPromptDialog()

  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [showUninstallDialog, setShowUninstallDialog] = useState(false)
  const [pendingModeAction, setPendingModeAction] = useState<ModeAction | null>(
    null,
  )

  const getStatusColor = () => {
    switch (serviceManager.serviceStatus) {
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
    if (serviceManager.query.isLoading) {
      return t('loading')
    }
    if (serviceManager.query.isError) {
      return t('Error')
    }
    if (!serviceManager.serviceStatus) {
      return t('unknown')
    }
    if (!serviceManager.isServiceInstalled) {
      return t('Not Installed')
    }
    switch (serviceManager.serviceStatus) {
      case 'running':
        return t('running')
      case 'stopped':
        return t('stopped')
      default:
        return t(serviceManager.serviceStatus || 'unknown')
    }
  }

  const handleRequireInstall = (action: ModeAction) => {
    setPendingModeAction(action)
    setShowInstallDialog(true)
  }

  const handleInstallConfirm = useLockFn(async () => {
    setShowInstallDialog(false)

    try {
      // 使用统一的服务安装流程
      await serviceManager.installService({
        autoStart: true,
        onConfigureProxy:
          pendingModeAction === 'system_proxy'
            ? async () => {
                await toggleSystemProxy()
              }
            : undefined,
        onConfigureTun:
          pendingModeAction === 'tun'
            ? async () => {
                await toggleTunMode()
              }
            : undefined,
      })

      message(t('Service installed successfully'), {
        title: t('Success'),
        kind: 'info',
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'service_not_installed') {
        message(t('Failed to install system service'), {
          title: t('Error'),
          kind: 'error',
        })
        promptDialog.show('install')
      } else {
        message(
          `${t('Failed to install system service')}\n${formatError(error)}`,
          {
            title: t('Error'),
            kind: 'error',
          },
        )
        promptDialog.show('install')
      }
    } finally {
      setPendingModeAction(null)
    }
  })

  const handleUninstallConfirm = useLockFn(async () => {
    setShowUninstallDialog(false)
    try {
      // 先关闭系统代理和TUN模式
      if (systemProxy.value) {
        await toggleSystemProxy()
      }
      if (tunMode.value) {
        await toggleTunMode()
      }

      // 使用统一的服务卸载流程
      await serviceManager.uninstallService()

      message(t('Service uninstalled successfully'), {
        title: t('Success'),
        kind: 'info',
      })
    } catch (error) {
      message(`${t('Error')}: ${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
      promptDialog.show('uninstall')
    }
  })

  return (
    <BaseCard
      label={t('System Settings')}
      labelChildren={
        <ExpandMore expand={expand} onClick={() => setExpand(!expand)} />
      }
    >
      <ServerManualPromptDialogWrapper />

      {/* 统一的服务安装进度 Dialog */}
      <ServiceInstallDialog
        open={serviceManager.isInstalling}
        installStage={serviceManager.installStage}
        canCancel={serviceManager.canCancel}
        handleCancel={serviceManager.cancelInstallation}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 6 }}>
          <SystemProxyButton
            serviceStatus={serviceManager.serviceStatus}
            onRequireInstall={handleRequireInstall}
            disabled={!isInTauri || serviceManager.isInstalling}
          />
        </Grid>

        <Grid size={{ xs: 6 }}>
          <TunModeButton
            serviceStatus={serviceManager.serviceStatus}
            onRequireInstall={handleRequireInstall}
            disabled={!isInTauri || serviceManager.isInstalling}
          />
        </Grid>
      </Grid>

      {/* 服务模式部分 */}
      <List disablePadding sx={{ pt: 1 }}>
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

        {isInTauri && !serviceManager.isServiceInstalled && (
          <ListItem sx={{ pl: 0, pr: 0 }}>
            <div className="text-sm text-gray-500">
              {t(
                'Install system service to enable service mode and avoid permission issues',
              )}
            </div>
          </ListItem>
        )}

        {isInTauri && serviceManager.serviceStatus === 'not_installed' && (
          <ListItem sx={{ pl: 0, pr: 0 }}>
            <div className="ml-auto">
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setPendingModeAction(null)
                  setShowInstallDialog(true)
                }}
                disabled={serviceManager.isInstalling}
              >
                {t('install')}
              </Button>
            </div>
          </ListItem>
        )}

        {isInTauri &&
          serviceManager.serviceStatus === 'stopped' &&
          !systemProxy.value &&
          !tunMode.value && (
            <ListItem sx={{ pl: 0, pr: 0 }}>
              <div className="ml-auto">
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => setShowUninstallDialog(true)}
                  disabled={serviceManager.isInstalling}
                >
                  {t('uninstall')}
                </Button>
              </div>
            </ListItem>
          )}
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
            onClick={handleInstallConfirm}
            variant="contained"
            disabled={serviceManager.isInstalling}
          >
            {t('Install')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 卸载确认 Dialog */}
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
            disabled={serviceManager.isInstalling}
          >
            {t('uninstall')}
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
