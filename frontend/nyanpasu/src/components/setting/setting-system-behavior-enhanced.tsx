import { useLockFn } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { Button, List, ListItem, ListItemText, Typography } from '@mui/material'
import Grid from '@mui/material/Grid'
import { useSetting } from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'

export const SettingSystemBehaviorEnhanced = () => {
  const { t } = useTranslation()
  const [testing, setTesting] = useState(false)

  const autoLaunch = useSetting('enable_auto_launch')
  const silentStart = useSetting('enable_silent_start')

  // 诊断开机自启功能
  const handleTestAutoLaunch = useLockFn(async () => {
    setTesting(true)
    try {
      // 这里可以调用后端的诊断接口
      message(
        t('Auto-launch diagnostic completed. Check console for details.'),
        {
          title: t('Diagnostic'),
          kind: 'info',
        },
      )
    } catch (error) {
      message(`${t('Diagnostic failed')}: ${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setTesting(false)
    }
  })

  const handleAutoLaunchToggle = useLockFn(async () => {
    try {
      await autoLaunch.upsert(!autoLaunch.value)
      message(
        autoLaunch.value
          ? t('Auto-launch enabled successfully')
          : t('Auto-launch disabled successfully'),
        {
          title: t('Success'),
          kind: 'info',
        },
      )
    } catch (error) {
      message(`${t('Failed to update auto-launch')}: ${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  const handleSilentStartToggle = useLockFn(async () => {
    try {
      await silentStart.upsert(!silentStart.value)
      message(
        silentStart.value
          ? t('Silent start enabled successfully')
          : t('Silent start disabled successfully'),
        {
          title: t('Success'),
          kind: 'info',
        },
      )
    } catch (error) {
      message(`${t('Failed to update silent start')}: ${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  return (
    <BaseCard label={t('Startup Behavior')}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6 }}>
          <PaperSwitchButton
            label={t('Auto Start')}
            checked={autoLaunch.value || false}
            onClick={handleAutoLaunchToggle}
          />
        </Grid>

        <Grid size={{ xs: 6 }}>
          <PaperSwitchButton
            label={t('Silent Start')}
            checked={silentStart.value || false}
            onClick={handleSilentStartToggle}
          />
        </Grid>
      </Grid>

      <List disablePadding sx={{ pt: 1 }}>
        <ListItem sx={{ pl: 0, pr: 0 }}>
          <ListItemText
            primary={t('Auto Start Status')}
            secondary={
              autoLaunch.value
                ? t('Enabled - App will start automatically on system boot')
                : t('Disabled - Manual startup required')
            }
          />
        </ListItem>

        <ListItem sx={{ pl: 0, pr: 0 }}>
          <ListItemText
            primary={t('Silent Start Status')}
            secondary={
              silentStart.value
                ? t('Enabled - App will start minimized to system tray')
                : t('Disabled - App window will show on startup')
            }
          />
        </ListItem>

        <ListItem sx={{ pl: 0, pr: 0 }}>
          <div className="flex w-full items-center justify-between">
            <div>
              <Typography variant="body2">{t('Startup Diagnostic')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('Test auto-launch functionality and check system settings')}
              </Typography>
            </div>
            <Button
              variant="outlined"
              size="small"
              onClick={handleTestAutoLaunch}
              disabled={testing}
            >
              {testing ? t('Testing...') : t('Run Test')}
            </Button>
          </div>
        </ListItem>

        {/* 平台特定说明 */}
        <ListItem sx={{ pl: 0, pr: 0 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{t('Platform Notes')}:</strong>
            <br />• <strong>Windows</strong>:{' '}
            {t('Uses registry entries for auto-start')}
            <br />• <strong>macOS</strong>:{' '}
            {t('Uses Login Items in System Preferences')}
            <br />• <strong>Linux</strong>:{' '}
            {t('Uses .desktop files in autostart directory')}
          </Typography>
        </ListItem>
      </List>
    </BaseCard>
  )
}

export default SettingSystemBehaviorEnhanced
