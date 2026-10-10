import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Close, MenuOpen } from '@mui/icons-material'
import { Drawer, IconButton } from '@mui/material'
import { alpha, cn, getSystem } from '@nyanpasu/ui'
import AnimatedLogo from '../layout/animated-logo'
import DrawerContent from './drawer-content'

const OS = getSystem()

const AppDrawer = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          'fixed z-10 flex items-center gap-2',
          OS === 'macos' ? 'top-3 right-14 left-24' : 'top-1.5 right-40 left-4',
        )}
        data-tauri-drag-region
      >
        <IconButton
          className="size-8! min-w-0! shrink-0"
          aria-label={t('Menu')}
          aria-haspopup="dialog"
          aria-expanded={open}
          sx={(theme) => ({
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
          })}
          onClick={() => setOpen(true)}
        >
          <MenuOpen />
        </IconButton>
        <div className="size-5 shrink-0" data-tauri-drag-region>
          <AnimatedLogo className="h-full w-full" data-tauri-drag-region />
        </div>
        <div
          className="min-w-0 truncate text-lg"
          title="Clash Nyanpasu"
          data-tauri-drag-region
        >
          Clash Nyanpasu
        </div>
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            sx: { width: 256, maxWidth: '100vw' },
            role: 'dialog',
            'aria-label': t('Menu'),
          },
        }}
      >
        <IconButton
          className="absolute! top-2 right-2 z-10"
          aria-label={t('Close')}
          onClick={() => setOpen(false)}
        >
          <Close />
        </IconButton>
        <div
          className="h-full"
          onClick={(event) => {
            if (
              (event.target as HTMLElement).closest('.MuiListItemButton-root')
            )
              setOpen(false)
          }}
        >
          <DrawerContent />
        </div>
      </Drawer>
    </>
  )
}

export default AppDrawer
