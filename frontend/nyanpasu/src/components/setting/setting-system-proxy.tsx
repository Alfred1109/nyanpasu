import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { IS_IN_TAURI } from '@/utils/tauri'
import { Dns as ProxyIcon } from '@mui/icons-material'
import { Alert, Box, Divider, Typography } from '@mui/material'
import {
  commands,
  unwrapResult,
  useSetting,
  useSystemProxy,
} from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { PaperSwitchButton } from './modules/system-proxy'

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

  return (
    <BaseCard label={t('System Proxy')}>
      <Box display="flex" flexDirection="column" gap={2}>
        <Typography variant="body2" color="text.secondary">
          控制是否把当前 Clash 代理写入系统网络代理设置。
        </Typography>

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
            color={enabled ? 'primary.contrastText' : 'text.secondary'}
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
              <Typography variant="body2">
                状态：{currentProxy?.enable ? '已开启' : '已关闭'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                地址：{currentProxy?.server || '未设置'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                绕过：{currentProxy?.bypass || '未设置'}
              </Typography>
            </>
          )}
        </Box>
      </Box>
    </BaseCard>
  )
}
