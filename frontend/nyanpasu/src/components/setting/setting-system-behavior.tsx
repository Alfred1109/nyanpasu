import { useLockFn } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { List, ListItem, ListItemText } from '@mui/material'
import Grid from '@mui/material/Grid'
import { useSetting } from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'

export const SettingSystemBehavior = () => {
  const { t } = useTranslation()

  const autoLaunch = useSetting('enable_auto_launch')
  const silentStart = useSetting('enable_silent_start')

  const handleAutoLaunchToggle = useLockFn(async () => {
    try {
      await autoLaunch.upsert(!autoLaunch.value)
      message(
        autoLaunch.value
          ? t('Auto-launch disabled. Changes take effect after restart.')
          : t(
              'Auto-launch enabled. App will start automatically on system boot.',
            ),
        {
          title: t('Auto-launch Updated'),
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
          ? t('Silent start disabled. App window will show on next startup.')
          : t('Silent start enabled. App will start minimized to tray.'),
        {
          title: t('Silent Start Updated'),
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
    <BaseCard label={t('Initiating Behavior')}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6 }}>
          <PaperSwitchButton
            label={t('Auto Start')}
            checked={autoLaunch.value || false}
            onClick={handleAutoLaunchToggle}
          />
        </Grid>

        <Grid
          size={{
            xs: 6,
          }}
        >
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
            primary={t('Status Information')}
            secondaryTypographyProps={{ component: 'div' }}
            secondary={
              <div>
                <div>
                  {t('Auto Start')}:{' '}
                  {autoLaunch.value
                    ? t('✓ Enabled - App will start on system boot')
                    : t('✗ Disabled - Manual startup required')}
                </div>
                <div>
                  {t('Silent Start')}:{' '}
                  {silentStart.value
                    ? t('✓ Enabled - Starts minimized to tray')
                    : t('✗ Disabled - Window shows on startup')}
                </div>
              </div>
            }
          />
        </ListItem>
      </List>
    </BaseCard>
  )
}

export default SettingSystemBehavior
