import SettingsEthernet from '~icons/material-symbols/settings-ethernet-rounded'
import { useBlockTask } from '@/components/providers/block-task-provider'
import { Button, ButtonProps } from '@/components/ui/button'
import { CircularProgress } from '@/components/ui/progress'
import { useTranslation } from 'react-i18next'
import {
  toggleTunMode,
  useSetting,
} from '@nyanpasu/interface'
import { cn } from '@nyanpasu/ui'

const ProxyButton = ({
  className,
  isActive,
  loading,
  children,
  ...props
}: ButtonProps & {
  isActive?: boolean
}) => {
  return (
    <Button
      className={cn(
        'group h-16 rounded-3xl font-bold',
        'flex items-center justify-between gap-2',
        'data-[active=false]:bg-white dark:data-[active=false]:bg-black',
        className,
      )}
      data-active={String(Boolean(isActive))}
      data-loading={String(Boolean(loading))}
      disabled={loading}
      variant="fab"
      {...props}
    >
      <div className="flex items-center gap-3 [&_svg]:size-7">{children}</div>

      {loading && (
        <CircularProgress
          className={cn(
            'size-6 transition-opacity',
            'group-data-[loading=false]:opacity-0 group-data-[loading=true]:opacity-100',
          )}
          indeterminate
        />
      )}
    </Button>
  )
}


export const TunModeButton = (
  props: Omit<ButtonProps, 'children' | 'loading'>,
) => {
  const { t } = useTranslation()
  const tunMode = useSetting('enable_tun_mode')

  const { execute, isPending } = useBlockTask('tun-mode', async () => {
    const isCurrentlyEnabled = Boolean(tunMode.value)
    
    // 只在开启TUN模式时检查服务状态，关闭时不检查
    if (!isCurrentlyEnabled) {
      // TODO: 需要获取服务状态进行检查
      console.log('TUN Mode enabling - should check service status here')
    }
    
    await toggleTunMode()
  })

  return (
    <ProxyButton
      {...props}
      loading={isPending}
      onClick={execute}
      isActive={Boolean(tunMode.value)}
    >
      <SettingsEthernet />
      <span>{t('TUN Mode')}</span>
    </ProxyButton>
  )
}
