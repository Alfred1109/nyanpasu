import { useMemoizedFn } from 'ahooks'
import { useEffect, useRef, useState } from 'react'
import {
  CloseRounded,
  CropSquareRounded,
  FilterNoneRounded,
  HorizontalRuleRounded,
  PushPin,
  PushPinOutlined,
} from '@mui/icons-material'
import { Button, ButtonProps } from '@mui/material'
import { saveWindowSizeState, useSetting } from '@nyanpasu/interface'
import { alpha, cn } from '@nyanpasu/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listen, TauriEvent, UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { IS_IN_TAURI } from '@/utils/tauri'

// Check if we're in Tauri environment before calling Tauri APIs
const isInTauri = IS_IN_TAURI

// Get app window instance, but don't let it be null in Tauri environment
let appWindow: ReturnType<typeof getCurrentWebviewWindow> | null = null
if (isInTauri) {
  try {
    appWindow = getCurrentWebviewWindow()
  } catch (error) {
    console.warn('Failed to get current webview window:', error)
  }
}

// Safe platform detection function
const getSafePlatform = async (): Promise<string> => {
  if (!isInTauri) {
    // Browser fallback - detect from user agent
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('win')) return 'windows'
    if (ua.includes('mac')) return 'macos'
    if (ua.includes('linux')) return 'linux'
    return 'unknown'
  }

  try {
    const { platform } = await import('@tauri-apps/plugin-os')
    return platform() || 'unknown'
  } catch {
    return 'unknown'
  }
}

const CtrlButton = (props: ButtonProps) => {
  return (
    <Button
      className="size-8! min-w-0!"
      sx={(theme) => ({
        backgroundColor: alpha(theme.vars.palette.primary.main, 0.1),
        svg: { transform: 'scale(0.9)' },
      })}
      {...props}
    />
  )
}

export const LayoutControl = ({ className }: { className?: string }) => {
  const { value: alwaysOnTop, upsert } = useSetting('always_on_top')
  const [currentAppWindow, setCurrentAppWindow] = useState<ReturnType<
    typeof getCurrentWebviewWindow
  > | null>(appWindow)

  const { data: isMaximized = false } = useQuery({
    queryKey: ['isMaximized'],
    queryFn: async () => {
      if (!currentAppWindow) return false
      return currentAppWindow.isMaximized()
    },
    enabled: !!currentAppWindow,
    initialData: false,
  })

  const queryClient = useQueryClient()
  const unlistenRef = useRef<UnlistenFn | null>(null)
  const [platform, setPlatform] = useState<string>('unknown')

  useEffect(() => {
    // Initialize platform detection
    getSafePlatform().then(setPlatform)

    // Try to initialize window in useEffect for better timing
    if (isInTauri && !currentAppWindow) {
      try {
        const window = getCurrentWebviewWindow()
        setCurrentAppWindow(window)
      } catch (error) {
        console.error('Failed to get window in useEffect:', error)
      }
    }
  }, [currentAppWindow])

  useEffect(() => {
    if (!currentAppWindow) return

    listen(TauriEvent.WINDOW_RESIZED, () => {
      queryClient.invalidateQueries({ queryKey: ['isMaximized'] })
    })
      .then((unlisten) => {
        unlistenRef.current = unlisten
      })
      .catch((error) => {
        console.error(error)
      })
    return () => {
      unlistenRef.current?.()
    }
  }, [queryClient, currentAppWindow])

  const toggleAlwaysOnTop = useMemoizedFn(async () => {
    if (!currentAppWindow) return
    await upsert(!alwaysOnTop)
    await currentAppWindow.setAlwaysOnTop(!alwaysOnTop)
  })

  return (
    <div className={cn('flex gap-1', className)} data-tauri-drag-region>
      <CtrlButton onClick={toggleAlwaysOnTop}>
        {alwaysOnTop ? (
          <PushPin fontSize="small" style={{ transform: 'rotate(15deg)' }} />
        ) : (
          <PushPinOutlined
            fontSize="small"
            style={{ transform: 'rotate(15deg)' }}
          />
        )}
      </CtrlButton>

      <CtrlButton
        disabled={!isInTauri || !currentAppWindow}
        onClick={async () => {
          if (!currentAppWindow) return
          try {
            await currentAppWindow.minimize()
          } catch (error) {
            console.error('Error minimizing window:', error)
          }
        }}
      >
        <HorizontalRuleRounded fontSize="small" />
      </CtrlButton>

      <CtrlButton
        disabled={!isInTauri || !currentAppWindow}
        onClick={async () => {
          if (!currentAppWindow) return
          try {
            await currentAppWindow.toggleMaximize()
            queryClient.invalidateQueries({ queryKey: ['isMaximized'] })
          } catch (error) {
            console.error('Error toggling maximize:', error)
          }
        }}
      >
        {isMaximized ? (
          <FilterNoneRounded
            fontSize="small"
            style={{
              transform: 'rotate(180deg) scale(0.8)',
            }}
          />
        ) : (
          <CropSquareRounded fontSize="small" />
        )}
      </CtrlButton>

      <CtrlButton
        disabled={!isInTauri || !currentAppWindow}
        onClick={async () => {
          if (!currentAppWindow) return
          try {
            if (platform === 'windows') {
              await saveWindowSizeState()
            }
            await currentAppWindow.close()
          } catch (error) {
            console.error('Error closing window:', error)
          }
        }}
      >
        <CloseRounded fontSize="small" />
      </CtrlButton>
    </div>
  )
}
