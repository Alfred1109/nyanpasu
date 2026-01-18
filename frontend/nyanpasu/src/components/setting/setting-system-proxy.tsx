import { useLockFn } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { IS_IN_TAURI } from '@/utils/tauri'
import { message } from '@tauri-apps/plugin-dialog'
import { toggleTunMode, useSetting } from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'

const TunModeButton = ({
  serviceStatus,
  disabled,
}: {
  serviceStatus?: string
  disabled?: boolean
}) => {
  const { t } = useTranslation()

  const tunMode = useSetting('enable_tun_mode')

  const handleTunMode = useLockFn(async () => {
    try {
      const result = await toggleTunMode()
      
      // 如果后端返回了消息（比如服务未安装/未启动的提示），显示给用户
      if (result && result.message) {
        message(result.message, {
          title: t('TUN Mode'),
          kind: result.success ? 'info' : 'warning',
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

  const isDisabled = disabled

  return (
    <PaperSwitchButton
      label={t('TUN Mode')}
      checked={Boolean(tunMode.value)}
      onClick={handleTunMode}
      disabled={isDisabled}
    />
  )
}

export default function SettingSystemProxy() {
  const { t } = useTranslation()
  const isInTauri = IS_IN_TAURI

  return (
    <BaseCard label={t('TUN Mode')}>
      <TunModeButton
        serviceStatus="running"
        disabled={!isInTauri}
      />
    </BaseCard>
  )
}
