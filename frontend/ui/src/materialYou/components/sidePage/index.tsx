import { useSize } from 'ahooks'
import { motion } from 'framer-motion'
import { FC, ReactNode, Ref, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils'
import { Close, MenuOpen } from '@mui/icons-material'
import { Box, Button, Drawer, IconButton } from '@mui/material'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { BaseErrorBoundary } from '../basePage/baseErrorBoundary'
import Header from '../basePage/header'
import style from './style.module.scss'

interface Props {
  title?: ReactNode
  header?: ReactNode
  children?: ReactNode
  sideBar?: ReactNode
  side?: ReactNode
  sideTitle?: ReactNode
  onSideClose?: () => void
  sideOpenKey?: string | number | null
  sideSelectionKey?: string | number | null
  sideClassName?: string
  portalRightRoot?: ReactNode
  noChildrenScroll?: boolean
  flexReverse?: boolean
  leftViewportRef?: Ref<HTMLDivElement>
  rightViewportRef?: Ref<HTMLDivElement>
}

export const SidePage: FC<Props> = ({
  title,
  header,
  children,
  sideBar,
  side,
  sideTitle = title,
  onSideClose,
  sideOpenKey,
  sideSelectionKey,
  sideClassName,
  portalRightRoot,
  flexReverse,
  leftViewportRef,
  rightViewportRef,
}) => {
  const { t } = useTranslation()
  const closePanel = () => {
    setPanelOpen(false)
    onSideClose?.()
  }
  const containerRef = useRef<HTMLDivElement>(null)
  const size = useSize(containerRef)
  const compact = (size?.width ?? 0) < 640
  const [panelOpen, setPanelOpen] = useState(false)
  const previousSelection = useRef(sideSelectionKey)

  useEffect(() => {
    if (sideOpenKey !== undefined && sideOpenKey !== null) setPanelOpen(true)
  }, [sideOpenKey])

  useEffect(() => {
    if (previousSelection.current !== sideSelectionKey) setPanelOpen(false)
    previousSelection.current = sideSelectionKey
  }, [sideSelectionKey])

  const sideBarStyle = {
    height: sideBar ? 'calc(100% - 56px)' : '100%',
  }

  const sideContent = (
    <>
      {sideBar && <div className="mb-4 min-h-10">{sideBar}</div>}
      <ScrollArea.Viewport
        className={cn(
          style['Container-common'],
          'relative w-full [&>div]:block!',
          sideClassName,
        )}
        style={sideBarStyle}
        ref={leftViewportRef}
      >
        {side}
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        className={cn(
          'flex touch-none py-6 pr-1.5 select-none',
          sideBar && 'top-14!',
        )}
        orientation="vertical"
        style={sideBarStyle}
      >
        <ScrollArea.Thumb
          className={cn(
            style['ScrollArea-Thumb'],
            'relative flex w-1.5! flex-1 rounded-full',
          )}
        />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner />
    </>
  )

  return (
    <BaseErrorBoundary>
      <div
        ref={containerRef}
        className={style['MDYSidePage-Main']}
        data-tauri-drag-region
      >
        <Header title={title} header={header} />
        {compact && Boolean(side) && (
          <Button
            className="mb-2! self-start!"
            size="small"
            variant="outlined"
            startIcon={<MenuOpen />}
            onClick={() => setPanelOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={panelOpen}
          >
            {sideTitle}
          </Button>
        )}

        <div className={style['MDYSidePage-Container']}>
          <div
            className={cn(
              'flex h-full w-full',
              flexReverse && 'flex-row-reverse',
            )}
          >
            {compact ? (
              <Drawer
                open={Boolean(side) && panelOpen}
                onClose={closePanel}
                anchor={flexReverse ? 'right' : 'left'}
                slotProps={{
                  paper: {
                    sx: { width: 'min(360px, 100vw)', p: 2 },
                    role: 'dialog',
                    'aria-label':
                      typeof sideTitle === 'string' ? sideTitle : undefined,
                  },
                }}
              >
                <Box className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-lg font-medium">{sideTitle}</div>
                  <IconButton aria-label={t('Close')} onClick={closePanel}>
                    <Close />
                  </IconButton>
                </Box>
                <ScrollArea.Root className="relative min-h-0 flex-1 overflow-hidden">
                  {sideContent}
                </ScrollArea.Root>
              </Drawer>
            ) : (
              <ScrollArea.Root asChild>
                <motion.div
                  className="relative h-full w-1/3 shrink-0"
                  initial={false}
                  animate={side ? 'open' : 'closed'}
                  variants={{
                    open: {
                      opacity: 1,
                      maxWidth: '348px',
                      minWidth: '192px',
                      display: 'block',
                      marginLeft: flexReverse ? '16px' : 0,
                      marginRight: flexReverse ? 0 : '16px',
                    },
                    closed: {
                      opacity: 0.5,
                      maxWidth: 0,
                      minWidth: 0,
                      marginLeft: 0,
                      marginRight: 0,
                      transitionEnd: { display: 'none' },
                    },
                  }}
                >
                  {sideContent}
                </motion.div>
              </ScrollArea.Root>
            )}

            <ScrollArea.Root
              className={cn(style['Container-common'], 'min-w-0 flex-1')}
            >
              {portalRightRoot}

              <ScrollArea.Viewport
                className={cn('relative h-full w-full [&>div]:block!')}
                ref={rightViewportRef}
              >
                {children}
              </ScrollArea.Viewport>

              <ScrollArea.Scrollbar
                className="flex touch-none py-6 pr-1.5 select-none"
                orientation="vertical"
              >
                <ScrollArea.Thumb className="bg-scroller! relative flex w-1.5! flex-1 rounded-full" />
              </ScrollArea.Scrollbar>

              <ScrollArea.Corner className="ScrollAreaCorner" />
            </ScrollArea.Root>
          </div>
        </div>
      </div>
    </BaseErrorBoundary>
  )
}
