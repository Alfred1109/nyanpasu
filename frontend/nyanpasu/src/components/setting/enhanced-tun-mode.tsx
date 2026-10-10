import { useLockFn } from 'ahooks'
import { useState } from 'react'
import type { UseServiceManagerReturn } from '@/hooks/use-service-manager'
import { formatError } from '@/utils'
import { IS_IN_TAURI } from '@/utils/tauri'
import { ShieldOutlined } from '@mui/icons-material'
import {
  Alert,
  Button,
  CircularProgress,
  Collapse,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { toggleTunMode, useClashConfig, useSetting } from '@nyanpasu/interface'
import { SettingControlRow } from './setting-control-row'

function tunRequirement(service: UseServiceManagerReturn) {
  if (!IS_IN_TAURI) return '请在桌面应用中修改'
  if (service.query.isError)
    return `服务状态读取失败：${formatError(service.query.error)}`
  if (service.settingsQuery.isError)
    return `服务模式读取失败：${formatError(service.settingsQuery.error)}`
  if (service.settingsQuery.isPending && !service.settingsQuery.data)
    return '正在读取服务模式'
  if (service.availabilityQuery.isError)
    return `服务连接读取失败：${formatError(service.availabilityQuery.error)}`
  if (service.serviceStatusError)
    return `服务状态读取失败：${service.serviceStatusError}`
  if (service.serviceStatus === undefined) return '正在读取服务状态'
  if (service.serviceStatus === 'not_installed') return '需要安装系统服务'
  if (!service.serviceModeEnabled) return '需要启用服务模式'
  if (service.serviceStatus !== 'running') return '需要启动系统服务'
  if (!service.serviceConnected) return '等待服务连接就绪'
  return null
}

export default function EnhancedTunModeCard({
  serviceManager,
  onManageService,
}: {
  serviceManager: UseServiceManagerReturn
  onManageService?: () => void
}) {
  const tun = useSetting('enable_tun_mode')
  const coreConfig = useClashConfig()
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<{
    error: boolean
    text: string
  } | null>(null)
  const [details, setDetails] = useState(false)
  const requirement = tunRequirement(serviceManager)
  const enabled = tun.value === true
  const effective = coreConfig.query.data?.tun?.enable
  const state = !IS_IN_TAURI
    ? '桌面端可用'
    : tun.isError
      ? '读取失败'
      : tun.value === undefined
        ? '读取中'
        : enabled
          ? '配置已开启'
          : '配置已关闭'
  const effectiveState = coreConfig.query.isError
    ? '内核状态读取失败'
    : typeof effective !== 'boolean'
      ? '内核状态待确认'
      : effective
        ? '内核已开启'
        : '内核已关闭'
  const toggle = useLockFn(async () => {
    if (requirement || pending || tun.value === undefined || tun.isError) return
    setPending(true)
    setFeedback(null)
    try {
      const result = await toggleTunMode()
      if (
        result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === false
      ) {
        throw new Error(
          'message' in result ? String(result.message) : 'TUN 配置未应用',
        )
      }
      const refreshed = await coreConfig.query.refetch()
      await tun.query.refetch()
      setFeedback({
        error: refreshed.isError,
        text: refreshed.isError
          ? `配置已提交，内核状态读取失败：${formatError(refreshed.error)}`
          : 'TUN 配置已应用。',
      })
    } catch (error) {
      setFeedback({ error: true, text: formatError(error) })
    } finally {
      setPending(false)
    }
  })
  return (
    <Stack spacing={0.5} sx={{ px: 2, py: 1.25 }}>
      <SettingControlRow
        title="TUN 模式"
        icon={<ShieldOutlined color="action" />}
        description={requirement ?? undefined}
        status={pending ? '正在应用…' : `${state} · ${effectiveState}`}
        control={
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {pending && <CircularProgress size={16} />}
            <Switch
              size="small"
              checked={enabled}
              onChange={toggle}
              disabled={
                Boolean(requirement) ||
                pending ||
                serviceManager.isInstalling ||
                tun.value === undefined ||
                tun.isError
              }
              slotProps={{ input: { 'aria-label': '切换 TUN 模式' } }}
            />
          </Stack>
        }
      />
      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ pl: 3.5 }}>
        {IS_IN_TAURI && requirement && (
          <Button size="small" onClick={onManageService}>
            管理服务与权限
          </Button>
        )}
        <Button
          size="small"
          onClick={() => setDetails((value) => !value)}
          aria-expanded={details}
          aria-controls="tun-mode-details"
          aria-label={details ? '收起 TUN 模式说明' : '查看 TUN 模式说明'}
          sx={{ px: 0.5, minWidth: 0, minHeight: 28 }}
        >
          {details ? '收起' : '说明'}
        </Button>
      </Stack>
      <Collapse id="tun-mode-details" in={details} sx={{ pl: 3.5 }}>
        <Typography variant="body2" color="text.secondary">
          TUN
          通过虚拟网络接口接管流量，需要系统服务及管理员权限。系统代理由应用选择是否使用系统代理，TUN
          可接管更多网络流量；两项可分别配置。
        </Typography>
      </Collapse>
      {tun.isError && <Alert severity="error">{formatError(tun.error)}</Alert>}
      {feedback && (
        <Alert
          severity={feedback.error ? 'error' : 'success'}
          sx={{ overflowWrap: 'anywhere' }}
        >
          {feedback.text}
        </Alert>
      )}
    </Stack>
  )
}
