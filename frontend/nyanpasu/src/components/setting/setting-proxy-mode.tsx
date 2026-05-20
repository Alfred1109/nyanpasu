import { useLockFn } from 'ahooks'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { getThemePaletteTokens, tokenAlpha } from '@/utils/theme'
import {
  Route as DirectIcon,
  ExpandLess,
  ExpandMore,
  Public as GlobalIcon,
  Language as RuleIcon,
} from '@mui/icons-material'
import {
  Box,
  Chip,
  Collapse,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useClashConfig, useProxyMode } from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'
import {
  SettingSummaryItem,
  SettingSummaryPanel,
} from './setting-summary-panel'

const RULE_MODE_COUNTRIES = [
  { code: 'CN', label: '中国' },
  { code: 'HK', label: '中国香港' },
  { code: 'TW', label: '中国台湾' },
  { code: 'JP', label: '日本' },
  { code: 'KR', label: '韩国' },
  { code: 'SG', label: '新加坡' },
  { code: 'US', label: '美国' },
  { code: 'GB', label: '英国' },
  { code: 'DE', label: '德国' },
  { code: 'FR', label: '法国' },
  { code: 'CA', label: '加拿大' },
  { code: 'AU', label: '澳大利亚' },
] as const

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
  const clashConfig = useClashConfig()

  const ruleModeGeoipCode = useMemo(() => {
    const rawValue = clashConfig.query.data?.geoip_code?.trim().toUpperCase()
    return rawValue || 'CN'
  }, [clashConfig.query.data?.geoip_code])

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

  const handleGeoipCodeChange = useLockFn(async (geoipCode: string) => {
    try {
      await clashConfig.upsert.mutateAsync({ geoip_code: geoipCode })
    } catch (error) {
      await message(`规则模式国家切换失败\n${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  return (
    <BaseCard
      label="代理模式"
      labelChildren={
        <Chip
          size="small"
          color="primary"
          variant="filled"
          label={`当前: ${
            proxyMode.rule ? '规则' : proxyMode.global ? '全局' : '直连'
          }`}
          sx={{ fontWeight: 700 }}
        />
      }
    >
      <Box display="flex" flexDirection="column" gap={1.5}>
        <Typography variant="body2" color="text.secondary">
          在这里切换代理模式，并查看当前 GeoIP 国家。
        </Typography>

        <SettingSummaryPanel>
          {[
            {
              label: '活跃模式',
              value: proxyMode.rule
                ? '规则模式'
                : proxyMode.global
                  ? '全局模式'
                  : '直连模式',
            },
            { label: '规则国家', value: ruleModeGeoipCode },
            { label: '切换方式', value: '即时生效' },
          ].map((item) => (
            <SettingSummaryItem
              key={item.label}
              label={item.label}
              value={item.value}
            />
          ))}
        </SettingSummaryPanel>

        <Stack spacing={1}>
          {(Object.keys(MODE_META) as Array<keyof typeof MODE_META>).map(
            (mode) => {
              const checked = Boolean(proxyMode[mode])
              const meta = MODE_META[mode]
              const Icon = meta.icon

              return (
                <Box key={mode}>
                  <PaperSwitchButton
                    checked={checked}
                    label={meta.title}
                    onClick={() => handleSwitchMode(mode)}
                    statusText={
                      mode === 'rule' && checked
                        ? `当前模式 · ${ruleModeGeoipCode}`
                        : checked
                          ? '当前模式'
                          : '点击切换'
                    }
                  >
                    <Box
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1}
                      color={checked ? 'primary.contrastText' : 'text.primary'}
                    >
                      <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        minWidth={0}
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

                      {mode === 'rule' &&
                        (checked ? (
                          <ExpandLess fontSize="small" />
                        ) : (
                          <ExpandMore fontSize="small" />
                        ))}
                    </Box>
                  </PaperSwitchButton>

                  {mode === 'rule' && (
                    <Collapse in={checked} timeout="auto" unmountOnExit>
                      <Box
                        mt={1}
                        px={1.25}
                        py={1.25}
                        borderRadius={2.5}
                        border="1px solid"
                        sx={(theme) => ({
                          backgroundColor: tokenAlpha(
                            getThemePaletteTokens(theme).primary.main,
                            0.08,
                          ),
                          borderColor: tokenAlpha(
                            getThemePaletteTokens(theme).text.primary,
                            0.1,
                          ),
                        })}
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, mb: 0.75 }}
                        >
                          国家地区
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 1 }}
                        >
                          规则模式使用的 GeoIP 国家代码。
                        </Typography>

                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={ruleModeGeoipCode}
                          onChange={(event) => {
                            handleGeoipCodeChange(event.target.value)
                          }}
                        >
                          {RULE_MODE_COUNTRIES.map((country) => (
                            <MenuItem key={country.code} value={country.code}>
                              {country.label} ({country.code})
                            </MenuItem>
                          ))}
                        </TextField>
                      </Box>
                    </Collapse>
                  )}
                </Box>
              )
            },
          )}
        </Stack>
      </Box>
    </BaseCard>
  )
}
