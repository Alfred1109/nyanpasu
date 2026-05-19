import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { IS_IN_TAURI } from '@/utils/tauri'
import { Dns as ProxyIcon } from '@mui/icons-material'
import { Alert, Box, Chip, Divider, Typography } from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import {
  commands,
  unwrapResult,
  useSetting,
  useSystemProxy,
} from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'

const getSurfacePanelStyles =
  (emphasized = false) =>
  (theme: Theme) => ({
    p: 1,
    borderRadius: 2.5,
    border: '1px solid',
    borderColor: emphasized
      ? alpha(theme.palette.primary.main, 0.18)
      : alpha(theme.palette.primary.main, 0.12),
    backgroundColor: emphasized
      ? alpha(theme.palette.primary.main, 0.06)
      : alpha(theme.palette.primary.main, 0.04),
  })

const getStatusSummaryItems = (
  enabled: boolean,
  systemProxyLoading: boolean,
  systemProxyActive: boolean,
  isStatusMismatched: boolean,
) => [
  { label: '应用开关', value: enabled ? '已启用' : '已关闭' },
  {
    label: '系统状态',
    value: systemProxyLoading
      ? '读取中'
      : systemProxyActive
        ? '已开启'
        : '已关闭',
  },
  {
    label: '同步情况',
    value: isStatusMismatched ? '待同步' : '一致',
  },
]

const getProxyDetailItems = (
  systemProxyActive: boolean,
  currentProxy?: { server?: string | null; bypass?: string | null } | null,
) => [
  {
    label: systemProxyActive ? '当前地址' : '保留地址',
    value: currentProxy?.server || '未设置',
  },
  {
    label: '绕过列表',
    value: currentProxy?.bypass || '未设置',
  },
]

export default function SettingSystemProxy() {
  const { t } = useTranslation()
  const systemProxyEnabled = useSetting('enable_system_proxy')
  const systemProxy = useSystemProxy()
  const [pending, setPending] = useState(false)

  const isInTauri = IS_IN_TAURI
  const enabled = Boolean(systemProxyEnabled.value)

  const handleToggle = async () => {
    if (!isInTauri) {
      await message('该功能仅在桌面端可用。', {
        title: t('System Proxy'),
        kind: 'info',
      })
      return
    }

    if (pending || systemProxyEnabled.isPending) {
      return
    }

    setPending(true)
    try {
      if (!enabled) {
        const hasPermission = unwrapResult(
          await commands.checkProxyPermission(),
        )

        if (!hasPermission) {
          await unwrapResult(await commands.grantProxyPermission())
        }
      }

      await systemProxyEnabled.upsert(!enabled)
      await systemProxy.refetch()
    } catch (error) {
      await message(`系统代理设置失败\n${formatError(error)}`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setPending(false)
    }
  }

  const currentProxy = systemProxy.data
  const systemProxyActive = Boolean(currentProxy?.enable)
  const hasStoredProxyConfig = Boolean(currentProxy?.server)
  const isStatusMismatched =
    currentProxy !== undefined && enabled !== systemProxyActive
  const headerTone = systemProxyActive
    ? 'success'
    : enabled
      ? 'warning'
      : 'default'
  const statusSummaryItems = getStatusSummaryItems(
    enabled,
    systemProxy.isLoading,
    systemProxyActive,
    isStatusMismatched,
  )
  const proxyDetailItems = getProxyDetailItems(systemProxyActive, currentProxy)

  return (
    <BaseCard
      label={t('System Proxy')}
      labelChildren={
        <Chip
          size="small"
          color={headerTone}
          variant="filled"
          label={
            systemProxy.isLoading
              ? '读取中'
              : systemProxyActive
                ? '已接管'
                : enabled
                  ? '等待同步'
                  : '未接管'
          }
          sx={(theme) => ({
            fontWeight: 800,
            ...(headerTone === 'default'
              ? {
                  color: theme.palette.text.secondary,
                  backgroundColor: alpha(theme.palette.text.primary, 0.06),
                  border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                }
              : {}),
          })}
        />
      }
    >
      <Box display="flex" flexDirection="column" gap={1.5}>
        <Typography variant="body2" color="text.secondary">
          控制是否把当前 Clash 代理写入系统网络代理设置。
        </Typography>

        <Box
          sx={(theme) => ({
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 0.75,
            ...getSurfacePanelStyles(true)(theme),
          })}
        >
          {statusSummaryItems.map((item) => (
            <Box key={item.label}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                {item.label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.25 }}>
                {item.value}
              </Typography>
            </Box>
          ))}
        </Box>

        {!isInTauri && (
          <Alert severity="info">
            该功能仅在桌面端可用，浏览器模式下无法修改系统网络代理。
          </Alert>
        )}

        <PaperSwitchButton
          checked={enabled}
          loading={pending || systemProxyEnabled.isPending}
          label={t('System Proxy')}
          onClick={handleToggle}
          statusText={enabled ? '已启用' : '已关闭'}
        >
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            color={enabled ? 'primary.contrastText' : 'text.primary'}
          >
            <ProxyIcon fontSize="small" />
            <Typography
              variant="body2"
              color="inherit"
              sx={{ fontWeight: 500 }}
            >
              {enabled ? '系统流量将按当前代理设置接管' : '当前不修改系统代理'}
            </Typography>
          </Box>
        </PaperSwitchButton>

        <Divider />

        <Box display="flex" flexDirection="column" gap={0.75}>
          <Typography variant="caption" color="text.secondary">
            {t('Current System Proxy')}
          </Typography>

          {systemProxy.isLoading ? (
            <Typography variant="body2" color="text.secondary">
              正在读取系统代理状态...
            </Typography>
          ) : systemProxy.isError ? (
            <Typography variant="body2" color="error.main">
              读取系统代理状态失败
            </Typography>
          ) : (
            <>
              <Box
                sx={(theme) => ({
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                  },
                  gap: 0.75,
                })}
              >
                {proxyDetailItems.map((item) => (
                  <Box key={item.label} sx={getSurfacePanelStyles()}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600 }}
                    >
                      {item.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.25, fontWeight: 700, wordBreak: 'break-all' }}
                    >
                      {item.value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {isStatusMismatched && (
                <Alert severity="warning" sx={{ mt: 0.5 }}>
                  应用设置与系统当前状态暂时不一致。通常是系统设置尚未刷新，或系统仍保留了上次代理配置。
                </Alert>
              )}

              {!systemProxyActive && hasStoredProxyConfig && (
                <Typography variant="caption" color="text.secondary">
                  系统代理关闭时，操作系统仍可能保留上次写入的地址和绕过列表；这不代表当前仍在接管流量。
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    </BaseCard>
  )
}
