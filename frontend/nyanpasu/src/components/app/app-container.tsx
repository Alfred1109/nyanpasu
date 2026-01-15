import getSystem from '@/utils/get-system'
import { Box } from '@mui/material'
import Paper from '@mui/material/Paper'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import 'allotment/dist/style.css'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { ReactNode, useEffect, useRef } from 'react'
import { atomIsDrawerOnlyIcon } from '@/store'
import { alpha, cn } from '@nyanpasu/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TauriEvent, UnlistenFn } from '@tauri-apps/api/event'
import { LayoutControl } from '../layout/layout-control'
import styles from './app-container.module.scss'
import AppDrawer from './app-drawer'
import DrawerContent from './drawer-content'

const isInTauri = typeof window !== 'undefined' && '__TAURI__' in window
const appWindow = isInTauri ? getCurrentWebviewWindow() : null

const OS = getSystem()

export const AppContainer = ({
  children,
  isDrawer,
}: {
  children?: ReactNode
  isDrawer?: boolean
}) => {
  const { data: isMaximized = false } = useQuery({
    queryKey: ['isMaximized'],
    queryFn: async () => {
      if (!appWindow) return false
      return appWindow.isMaximized()
    },
    enabled: !!appWindow,
    initialData: false,
  })
  const queryClient = useQueryClient()
  const unlistenRef = useRef<UnlistenFn | null>(null)
  const onlyIcon = useAtomValue(atomIsDrawerOnlyIcon)

  useEffect(() => {
    if (!appWindow) return

    appWindow
      .listen(TauriEvent.WINDOW_RESIZED, () => {
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
  }, [queryClient])

  return (
    <Paper
      square
      elevation={0}
      className={styles.layout}
      onPointerDown={(e: React.PointerEvent) => {
        if ((e.target as HTMLElement)?.dataset?.windrag) {
          appWindow?.startDragging()
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
      }}
    >
      {isDrawer && <AppDrawer data-tauri-drag-region />}

      {!isDrawer && (
        <div className={cn(onlyIcon ? 'w-24' : 'w-64')}>
          <DrawerContent data-tauri-drag-region onlyIcon={onlyIcon} />
        </div>
      )}

      <div className={styles.container}>
        {OS === 'windows' && appWindow && (
          <LayoutControl className="z-top! fixed top-2 right-4" />
        )}
        <AnimatePresence>
          {OS === 'macos' && !isMaximized && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <Box
                className="z-top fixed top-1.5 left-3 h-7 w-18 rounded-full"
                sx={(theme) => ({
                  backgroundColor: alpha(theme.vars.palette.primary.main, 0.1),
                })}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={OS === 'macos' ? 'h-11' : 'h-9'}
          data-tauri-drag-region
        />

        {children}
      </div>
    </Paper>
  )
}

export default AppContainer
