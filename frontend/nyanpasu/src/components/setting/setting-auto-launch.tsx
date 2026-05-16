import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { IS_IN_TAURI } from '@/utils/tauri'
import { Launch, RocketLaunch } from '@mui/icons-material'
import { Alert, Box, Divider, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { commands, unwrapResult, useSetting } from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'

export default function SettingAutoLaunch() {
  const { t } = useTranslation()
  const autoLaunch = useSetting('enable_auto_launch')
  const silentStart = useSetting('enable_silent_start')
  const [pending, setPending] = useState(false)
  const [silentPending, setSilentPending] = useState(false)

  const isInTauri = IS_IN_TAURI
  const enabled = Boolean(autoLaunch.value)
  const silentEnabled = Boolean(silentStart.value)

  const handleToggle = async () => {
    if (!isInTauri) {
      await message('该功能仅在桌面端可用。', {
        title: t('Auto Start'),
        kind: 'info',
      })
      return
    }

    if (pending || autoLaunch.isPending) {
      return
    }

    setPending(true)
    try {
      if (!enabled) {
        const hasPermission = unwrapResult(
          await commands.checkAutostartPermission(),
        )

        if (!hasPermission) {
          await unwrapResult(await commands.grantAutostartPermission())
        }
      }

      await autoLaunch.upsert(!enabled)
    } catch (error) {
      await message(`开机启动设置失败\n${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setPending(false)
    }
  }

  const handleSilentToggle = async () => {
    if (!isInTauri) {
      await message('该功能仅在桌面端可用。', {
        title: t('Silent Start'),
        kind: 'info',
      })
      return
    }

    if (silentPending || silentStart.isPending) {
      return
    }

    setSilentPending(true)
    try {
      await silentStart.upsert(!silentEnabled)
    } catch (error) {
      await message(`静默启动设置失败\n${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setSilentPending(false)
    }
  }

  return (
    <BaseCard label={t('Auto Start')}>
      <Box display="flex" flexDirection="column" gap={2}>
        <Typography variant="body2" color="text.secondary">
          控制 Clash Nyanpasu
          的启动行为，包括随系统启动和启动时是否直接显示窗口。
        </Typography>

        {!isInTauri && (
          <Alert severity="info">
            该功能仅在桌面端可用，浏览器模式下不会写入系统自启动项。
          </Alert>
        )}

        <PaperSwitchButton
          checked={enabled}
          loading={pending || autoLaunch.isPending}
          label={t('Auto Start')}
          onClick={handleToggle}
          statusText={enabled ? '已启用' : '已关闭'}
        >
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            color={enabled ? 'primary.contrastText' : 'text.secondary'}
          >
            <RocketLaunch fontSize="small" />
            <Typography
              variant="body2"
              color="inherit"
              sx={{ fontWeight: 500 }}
            >
              {enabled ? '系统登录后自动启动应用' : '当前不会随系统启动'}
            </Typography>
          </Box>
        </PaperSwitchButton>

        <Box
          sx={(theme) => ({
            ml: { xs: 0, sm: 2 },
            pl: 2,
            borderLeft: '2px solid',
            borderColor: enabled ? 'primary.main' : 'divider',
            backgroundColor: alpha(
              enabled
                ? theme.vars.palette.primary.main
                : theme.vars.palette.action.hover,
              enabled ? 0.08 : 0.04,
            ),
            borderRadius: 3,
            py: 1.5,
            pr: 1.5,
          })}
        >
          <Box mb={1.5}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t('Silent Start')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              这是开机启动后的附加行为，用于控制启动时是否直接显示主窗口。
            </Typography>
          </Box>

          <Divider sx={{ mb: 1.5 }} />

          <PaperSwitchButton
            checked={silentEnabled}
            loading={silentPending || silentStart.isPending}
            onClick={handleSilentToggle}
            statusText={silentEnabled ? '已启用' : '已关闭'}
            sxPaper={{
              opacity: enabled ? 1 : 0.8,
            }}
          >
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              color={silentEnabled ? 'primary.contrastText' : 'text.secondary'}
            >
              <Launch fontSize="small" />
              <Typography
                variant="body2"
                color="inherit"
                sx={{ fontWeight: 500 }}
              >
                {silentEnabled
                  ? '启动应用时不主动显示主窗口'
                  : '启动应用时正常显示主窗口'}
              </Typography>
            </Box>
          </PaperSwitchButton>
        </Box>
      </Box>
    </BaseCard>
  )
}
