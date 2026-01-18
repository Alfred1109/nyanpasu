import { useLockFn } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai'
import { message } from '@tauri-apps/plugin-dialog'
import { Chip, Grid, Paper } from '@mui/material'
import { SettingsEthernet } from '@mui/icons-material'
import {
  toggleTunMode,
  useSetting,
} from '@nyanpasu/interface'
import { atomIsDrawer } from '@/store'
import { PaperSwitchButton } from '../setting/modules/system-proxy'

const TitleComp = () => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between">
      <div className="text-lg font-bold">{t('Proxy')}</div>

      <Chip
        size="small"
        variant="outlined"
        color="default"
        label={t('TUN Mode')}
      />
    </div>
  )
}

export const ProxyShortcuts = () => {
  const { t } = useTranslation()

  const isDrawer = useAtomValue(atomIsDrawer)

  const tunMode = useSetting('enable_tun_mode')

  const handleTunMode = useLockFn(async () => {
    try {
      const result = await toggleTunMode()
      
      // 如果后端返回了消息（比如服务未安装/未启动的提示），显示给用户
      if (result && typeof result === 'object' && 'message' in result && result.message) {
        message(result.message, {
          title: t('TUN Mode'),
          kind: 'success' in result && result.success ? 'info' : 'warning',
        })
      }
    } catch (error) {
      const isCurrentlyEnabled = Boolean(tunMode.value)
      const action = isCurrentlyEnabled ? 'Deactivation' : 'Activation'
      message(`${action} TUN Mode failed!`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  return (
    <Grid
      size={{
        sm: isDrawer ? 6 : 12,
        md: 6,
        lg: 4,
        xl: 3,
      }}
    >
      <Paper className="flex !h-full flex-col justify-between gap-2 !rounded-3xl p-3">
        <TitleComp />

        <div className="flex gap-3">
          <div className="!w-full">
            <PaperSwitchButton
              checked={tunMode.value || false}
              onClick={handleTunMode}
            >
              <div className="flex flex-col gap-2">
                <SettingsEthernet />

                <div>{t('TUN Mode')}</div>
              </div>
            </PaperSwitchButton>
          </div>
        </div>
      </Paper>
    </Grid>
  )
}

export default ProxyShortcuts
