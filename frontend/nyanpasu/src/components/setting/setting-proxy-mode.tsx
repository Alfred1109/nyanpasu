import { useLockFn } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import {
  Route as DirectIcon,
  Public as GlobalIcon,
  Language as RuleIcon,
} from '@mui/icons-material'
import { Box, Stack, Typography } from '@mui/material'
import { useProxyMode } from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'

const MODE_META = {
  rule: {
    icon: RuleIcon,
    title: '规则模式',
    description: '按规则分流，适合日常使用。',
  },
  global: {
    icon: GlobalIcon,
    title: '全局模式',
    description: '所有流量统一走当前选择的代理。',
  },
  direct: {
    icon: DirectIcon,
    title: '直连模式',
    description: '不经过代理，直接连接网络。',
  },
} as const

export default function SettingProxyMode() {
  const { t } = useTranslation()
  const { value: proxyMode, upsert } = useProxyMode()

  const handleSwitchMode = useLockFn(async (mode: keyof typeof MODE_META) => {
    try {
      await upsert(mode)
    } catch (error) {
      await message(`代理模式切换失败\n${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  return (
    <BaseCard label="代理模式">
      <Box display="flex" flexDirection="column" gap={2}>
        <Typography variant="body2" color="text.secondary">
          在这里快速切换规则、全局和直连模式。
        </Typography>

        <Stack spacing={1.5}>
          {(Object.keys(MODE_META) as Array<keyof typeof MODE_META>).map(
            (mode) => {
              const checked = Boolean(proxyMode[mode])
              const meta = MODE_META[mode]
              const Icon = meta.icon

              return (
                <PaperSwitchButton
                  key={mode}
                  checked={checked}
                  label={meta.title}
                  onClick={() => handleSwitchMode(mode)}
                  statusText={checked ? '当前模式' : '点击切换'}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    color={checked ? 'primary.contrastText' : 'text.secondary'}
                  >
                    <Icon fontSize="small" />
                    <Typography
                      variant="body2"
                      color="inherit"
                      sx={{ fontWeight: 500 }}
                    >
                      {meta.description}
                    </Typography>
                  </Box>
                </PaperSwitchButton>
              )
            },
          )}
        </Stack>
      </Box>
    </BaseCard>
  )
}
