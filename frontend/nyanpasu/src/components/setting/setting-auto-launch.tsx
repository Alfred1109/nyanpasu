import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { IS_IN_TAURI } from '@/utils/tauri'
import {
  getDefaultChipStyles,
  getThemePaletteTokens,
  tokenAlpha,
} from '@/utils/theme'
import { Launch, RocketLaunch } from '@mui/icons-material'
import { Alert, Box, Chip, Divider, Typography } from '@mui/material'
import { commands, unwrapResult, useSetting } from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'
import { getOnOffLabel } from './setting-status'
import {
  SettingSummaryItem,
  SettingSummaryPanel,
} from './setting-summary-panel'

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
    <BaseCard
      label={t('Auto Start')}
      labelChildren={
        <Chip
          size="small"
          color={enabled ? 'primary' : 'default'}
          variant="filled"
          label={getOnOffLabel(enabled)}
          sx={(theme) => ({
            fontWeight: 800,
            ...(enabled ? {} : getDefaultChipStyles(theme)),
          })}
        />
      }
    >
      <Box display="flex" flexDirection="column" gap={1.5}>
        <Typography variant="body2" color="text.secondary">
          控制应用是否随系统启动，以及启动时是否直接显示窗口。
        </Typography>

        <SettingSummaryPanel>
          {[
            { label: '开机启动', value: getOnOffLabel(enabled) },
            { label: '静默启动', value: getOnOffLabel(silentEnabled) },
            { label: '运行环境', value: isInTauri ? '桌面端' : '浏览器' },
          ].map((item) => (
            <SettingSummaryItem
              key={item.label}
              label={item.label}
              value={item.value}
            />
          ))}
        </SettingSummaryPanel>

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
          statusText={getOnOffLabel(enabled)}
        >
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            color={enabled ? 'primary.contrastText' : 'text.primary'}
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
            ...(() => {
              const tokens = getThemePaletteTokens(theme)

              return {
                backgroundColor: enabled
                  ? tokenAlpha(tokens.primary.main, 0.1)
                  : tokenAlpha(tokens.background.paper, 0.88),
              }
            })(),
            ml: { xs: 0, sm: 2 },
            pl: 1.5,
            borderLeft: '2px solid',
            borderColor: enabled ? 'primary.main' : 'divider',
            borderRadius: 2.5,
            py: 1.25,
            pr: 1.25,
          })}
        >
          <Box mb={1}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t('Silent Start')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              这是开机启动后的附加选项，用来控制是否直接显示主窗口。
            </Typography>
          </Box>

          <Divider sx={{ mb: 1 }} />

          <PaperSwitchButton
            checked={silentEnabled}
            loading={silentPending || silentStart.isPending}
            onClick={handleSilentToggle}
            statusText={getOnOffLabel(silentEnabled)}
            sxPaper={{
              opacity: enabled ? 1 : 0.8,
            }}
          >
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              color={silentEnabled ? 'primary.contrastText' : 'text.primary'}
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

          {!enabled && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              静默启动只有在开启开机启动后才会参与系统启动流程。
            </Typography>
          )}
        </Box>
      </Box>
    </BaseCard>
  )
}
