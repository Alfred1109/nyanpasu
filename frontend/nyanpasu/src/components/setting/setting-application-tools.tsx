import { useState } from 'react'
import { KeyboardOutlined, PaletteOutlined } from '@mui/icons-material'
import { Button, Stack } from '@mui/material'
import HotkeyDialog from './modules/hotkey-dialog'
import TrayIconDialog from './modules/tray-icon-dialog'
import { SettingControlRow } from './setting-control-row'

export default function SettingApplicationTools() {
  const [dialog, setDialog] = useState<'hotkeys' | 'tray' | null>(null)
  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      {(
        [
          ['hotkeys', '快捷键'],
          ['tray', '托盘图标'],
        ] as const
      ).map(([id, title]) => (
        <SettingControlRow
          key={id}
          title={title}
          icon={
            id === 'hotkeys' ? (
              <KeyboardOutlined color="action" />
            ) : (
              <PaletteOutlined color="action" />
            )
          }
          control={
            <Button
              size="small"
              onClick={() => setDialog(id)}
              aria-label={`设置${title}`}
            >
              设置
            </Button>
          }
        />
      ))}
      <HotkeyDialog
        open={dialog === 'hotkeys'}
        onClose={() => setDialog(null)}
      />
      <TrayIconDialog
        open={dialog === 'tray'}
        onClose={() => setDialog(null)}
      />
    </Stack>
  )
}
