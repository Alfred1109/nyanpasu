import { useLockFn } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { IS_IN_TAURI } from '@/utils/tauri'
import { ExpandLess, ExpandMore, Dns as ProxyIcon } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Collapse,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import {
  commands,
  unwrapResult,
  useSettings,
  useSystemProxy,
} from '@nyanpasu/interface'
import { SettingControlRow } from './setting-control-row'
import { getOnOffLabel, getTakeoverLabel } from './setting-status'

export default function SettingSystemProxy() {
  const { t } = useTranslation()
  const settings = useSettings()
  const systemProxy = useSystemProxy()
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [pending, setPending] = useState(false)
  const [operationError, setOperationError] = useState<string>()

  const config = settings.query.data
  const enabled = config?.enable_system_proxy
  const currentProxy = systemProxy.data
  const systemProxyActive = currentProxy?.enable
  const hasKnownSetting = typeof enabled === 'boolean'
  const hasKnownSystemState = typeof systemProxyActive === 'boolean'
  const mismatch =
    hasKnownSetting && hasKnownSystemState && enabled !== systemProxyActive
  const canWrite =
    IS_IN_TAURI &&
    hasKnownSetting &&
    !settings.query.isLoading &&
    !settings.query.isError &&
    !systemProxy.isError &&
    hasKnownSystemState &&
    !pending &&
    !settings.upsert.isPending &&
    !systemProxy.isLoading

  const handleToggle = useLockFn(async () => {
    if (!canWrite || typeof enabled !== 'boolean') return
    setOperationError(undefined)
    setPending(true)
    try {
      if (!enabled) {
        const hasPermission = unwrapResult(
          await commands.checkProxyPermission(),
        )
        if (!hasPermission) {
          unwrapResult(await commands.grantProxyPermission())
        }
      }
      await settings.upsert.mutateAsync({ enable_system_proxy: !enabled })
      const refreshed = await systemProxy.refetch()
      if (refreshed.isError) {
        const detail = formatError(refreshed.error)
        setOperationError(`配置已提交，实际系统状态读取失败：${detail}`)
        await message(`配置已提交，实际系统状态读取失败\n${detail}`, {
          title: t('Error'),
          kind: 'error',
        })
      }
    } catch (error) {
      const detail = formatError(error)
      setOperationError(detail)
      await message(`系统代理设置失败\n${detail}`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setPending(false)
    }
  })

  const settingStatus = !IS_IN_TAURI
    ? '浏览器模式不可修改'
    : settings.query.isLoading
      ? '配置读取中'
      : settings.query.isError
        ? '配置读取失败'
        : !hasKnownSetting
          ? '配置未提供开关状态'
          : getOnOffLabel(enabled === true)

  const systemStatus = !IS_IN_TAURI
    ? '桌面端可查看'
    : systemProxy.isLoading
      ? '系统状态读取中'
      : systemProxy.isError
        ? '系统状态读取失败'
        : !hasKnownSystemState
          ? '系统未返回状态'
          : getTakeoverLabel(systemProxyActive === true)

  return (
    <Stack spacing={0.75} sx={{ px: 2, py: 1.25 }}>
      {settings.query.isError && IS_IN_TAURI && (
        <Alert severity="error" sx={{ py: 0 }}>
          设置读取失败：{formatError(settings.query.error)}
        </Alert>
      )}
      {systemProxy.isError && IS_IN_TAURI && (
        <Alert severity="error" sx={{ py: 0 }}>
          系统代理状态读取失败：{formatError(systemProxy.error)}
        </Alert>
      )}

      <SettingControlRow
        icon={<ProxyIcon fontSize="small" color="action" />}
        title="系统代理"
        status={`应用 ${pending ? '正在应用' : settingStatus} · 系统 ${systemStatus}`}
        control={
          <Switch
            size="small"
            checked={enabled === true}
            disabled={!canWrite}
            onChange={() => handleToggle()}
            inputProps={{ 'aria-label': '系统代理' }}
          />
        }
      />

      {mismatch && (
        <Alert severity="warning" sx={{ py: 0 }}>
          应用开关与系统实际状态不同：应用为{getOnOffLabel(enabled === true)}
          ，系统为
          {getTakeoverLabel(systemProxyActive === true)}。
        </Alert>
      )}
      {operationError && <Alert severity="error">{operationError}</Alert>}

      <Box sx={{ pl: 3.5 }}>
        <Button
          size="small"
          disabled={!IS_IN_TAURI}
          endIcon={detailsExpanded ? <ExpandLess /> : <ExpandMore />}
          onClick={() => setDetailsExpanded((value) => !value)}
          aria-expanded={detailsExpanded}
          aria-controls="system-proxy-details"
          sx={{ px: 0.5, minWidth: 0, minHeight: 28 }}
        >
          代理详情
        </Button>
        <Collapse id="system-proxy-details" in={detailsExpanded} unmountOnExit>
          <Box display="grid" gap={0.5} pb={0.75}>
            <Button
              size="small"
              disabled={!IS_IN_TAURI || systemProxy.isFetching}
              onClick={() => systemProxy.refetch()}
              sx={{ justifySelf: 'start', minHeight: 26 }}
            >
              {systemProxy.isFetching ? '读取中' : '刷新系统状态'}
            </Button>
            {currentProxy ? (
              <>
                <ProxyDetail label="代理地址" value={currentProxy.server} />
                <ProxyDetail label="绕过列表" value={currentProxy.bypass} />
              </>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {systemProxy.isError
                  ? '系统代理状态读取失败，可刷新后重试。'
                  : '尚无系统代理详情。'}
              </Typography>
            )}
          </Box>
        </Collapse>
      </Box>
    </Stack>
  )
}

function ProxyDetail({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <Box display="flex" justifyContent="space-between" gap={1} minWidth={0}>
      <Typography variant="caption" color="text.secondary" flexShrink={0}>
        {label}
      </Typography>
      <Typography
        variant="caption"
        textAlign="right"
        sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {value || '未设置'}
      </Typography>
    </Box>
  )
}
