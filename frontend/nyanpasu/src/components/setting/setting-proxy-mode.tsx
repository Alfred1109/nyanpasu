import { useLockFn } from 'ahooks'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { IS_IN_TAURI } from '@/utils/tauri'
import {
  Route as DirectIcon,
  ExpandLess,
  ExpandMore,
  Public as GlobalIcon,
  Language as RuleIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Collapse,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useClashConfig, useProxyMode } from '@nyanpasu/interface'
import { SettingControlRow } from './setting-control-row'

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
  rule: { icon: <RuleIcon fontSize="small" />, title: '规则' },
  global: { icon: <GlobalIcon fontSize="small" />, title: '全局' },
  direct: { icon: <DirectIcon fontSize="small" />, title: '直连' },
} as const

type ProxyModeName = keyof typeof MODE_META

export default function SettingProxyMode() {
  const { t } = useTranslation()
  const proxyMode = useProxyMode()
  const clashConfig = useClashConfig()
  const [geoipExpanded, setGeoipExpanded] = useState(false)
  const [operationError, setOperationError] = useState<string>()
  const [cleanupWarning, setCleanupWarning] = useState<string>()

  const ruleModeGeoipCode = useMemo(() => {
    const rawValue = clashConfig.query.data?.geoip_code?.trim().toUpperCase()
    return rawValue || 'CN'
  }, [clashConfig.query.data?.geoip_code])

  const currentMode = (Object.keys(MODE_META) as ProxyModeName[]).find(
    (mode) => proxyMode.value[mode],
  )
  const modeReady =
    IS_IN_TAURI && Boolean(proxyMode.query.data) && !proxyMode.query.isError
  const canWrite = modeReady && !proxyMode.isPending

  const handleSwitchMode = useLockFn(async (mode: ProxyModeName) => {
    setOperationError(undefined)
    setCleanupWarning(undefined)
    try {
      const result = await proxyMode.upsert(mode)
      if (result.cleanupError) {
        const detail = formatError(result.cleanupError)
        setCleanupWarning(`模式已切换，旧连接清理失败：${detail}`)
      }
    } catch (error) {
      const detail = formatError(error)
      setOperationError(detail)
      await message(`代理模式切换失败\n${detail}`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  const handleGeoipCodeChange = useLockFn(async (geoipCode: string) => {
    setOperationError(undefined)
    try {
      await clashConfig.upsert.mutateAsync({ geoip_code: geoipCode })
    } catch (error) {
      const detail = formatError(error)
      setOperationError(detail)
      await message(`规则模式国家切换失败\n${detail}`, {
        title: t('Error'),
        kind: 'error',
      })
    }
  })

  const modeStatus = !IS_IN_TAURI
    ? '仅桌面端可修改'
    : proxyMode.query.isLoading
      ? '正在读取'
      : proxyMode.query.isError
        ? '读取失败'
        : currentMode
          ? `当前：${MODE_META[currentMode].title}模式`
          : '配置未提供模式'

  return (
    <Stack spacing={1} sx={{ px: 2, py: 1.25 }}>
      {proxyMode.query.isError && IS_IN_TAURI && (
        <Alert severity="error" sx={{ py: 0 }}>
          代理模式读取失败：{formatError(proxyMode.query.error)}
        </Alert>
      )}
      {!proxyMode.query.isLoading &&
        !proxyMode.query.isError &&
        IS_IN_TAURI &&
        !currentMode && (
          <Alert severity="warning" sx={{ py: 0 }}>
            当前配置未返回有效模式，已禁用切换。
          </Alert>
        )}

      <SettingControlRow
        title="代理模式"
        icon={<GlobalIcon color="action" />}
        status={modeStatus}
        controlPlacement="below"
        control={
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={currentMode ?? null}
            disabled={!canWrite}
            onChange={(_, value: ProxyModeName | null) => {
              if (value) handleSwitchMode(value)
            }}
            aria-label="代理模式"
            sx={{
              '& .MuiToggleButton-root': {
                flex: 1,
                minWidth: 0,
                px: 0.5,
                py: 0.5,
              },
            }}
          >
            {(Object.keys(MODE_META) as ProxyModeName[]).map((mode) => (
              <ToggleButton
                key={mode}
                value={mode}
                aria-label={`${MODE_META[mode].title}模式`}
              >
                <Box display="flex" alignItems="center" gap={0.5}>
                  {MODE_META[mode].icon}
                  <Typography variant="caption" fontWeight={650}>
                    {MODE_META[mode].title}
                  </Typography>
                </Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
      />

      {operationError && <Alert severity="error">{operationError}</Alert>}
      {cleanupWarning && <Alert severity="warning">{cleanupWarning}</Alert>}

      {currentMode === 'rule' && (
        <SettingControlRow
          title="规则国家"
          icon={<RuleIcon color="action" />}
          description="GeoIP 匹配"
          status={ruleModeGeoipCode}
          control={
            <Button
              size="small"
              variant="text"
              endIcon={geoipExpanded ? <ExpandLess /> : <ExpandMore />}
              onClick={() => setGeoipExpanded((expanded) => !expanded)}
              aria-expanded={geoipExpanded}
              aria-label={geoipExpanded ? '收起规则国家选择' : '修改规则国家'}
            >
              {geoipExpanded ? '收起' : '修改国家'}
            </Button>
          }
          details={
            <Box id="proxy-mode-geoip-details">
              <TextField
                select
                fullWidth
                size="small"
                label="GeoIP 国家或地区"
                helperText="按此国家代码匹配 GeoIP 规则"
                value={ruleModeGeoipCode}
                disabled={
                  !IS_IN_TAURI ||
                  clashConfig.query.isLoading ||
                  clashConfig.query.isError ||
                  clashConfig.upsert.isPending
                }
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
          }
          expanded={geoipExpanded}
          sx={{ border: 0, px: 0, py: 0 }}
        />
      )}

      {geoipExpanded && clashConfig.query.isError && (
        <Collapse in>
          <Alert severity="error">GeoIP 配置读取失败，无法修改。</Alert>
        </Collapse>
      )}
    </Stack>
  )
}
