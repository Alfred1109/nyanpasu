import { useLockFn } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { IS_IN_TAURI } from '@/utils/tauri'
import { Launch, RocketLaunch } from '@mui/icons-material'
import { Alert, Box, Stack, Switch, Typography } from '@mui/material'
import { commands, unwrapResult, useSettings } from '@nyanpasu/interface'
import { SettingControlRow } from './setting-control-row'
import { getOnOffLabel } from './setting-status'

export default function SettingAutoLaunch() {
  const { t } = useTranslation()
  const settings = useSettings()
  const [pending, setPending] = useState(false)
  const [operationError, setOperationError] = useState<string>()

  const config = settings.query.data
  const enabled = config?.enable_auto_launch
  const silentEnabled = config?.enable_silent_start
  const hasKnownValues =
    typeof enabled === 'boolean' && typeof silentEnabled === 'boolean'
  const canWrite =
    IS_IN_TAURI &&
    hasKnownValues &&
    !settings.query.isLoading &&
    !settings.query.isError &&
    !pending &&
    !settings.upsert.isPending

  const handleAutoLaunchToggle = useLockFn(async () => {
    if (!canWrite || typeof enabled !== 'boolean') return
    setOperationError(undefined)
    setPending(true)
    try {
      if (!enabled) {
        const hasPermission = unwrapResult(
          await commands.checkAutostartPermission(),
        )
        if (!hasPermission) {
          unwrapResult(await commands.grantAutostartPermission())
        }
      }
      await settings.upsert.mutateAsync({ enable_auto_launch: !enabled })
    } catch (error) {
      const detail = formatError(error)
      setOperationError(detail)
      await message(`开机启动设置失败\n${detail}`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setPending(false)
    }
  })

  const handleSilentStartToggle = useLockFn(async () => {
    if (!canWrite || typeof silentEnabled !== 'boolean') return
    setOperationError(undefined)
    setPending(true)
    try {
      await settings.upsert.mutateAsync({ enable_silent_start: !silentEnabled })
    } catch (error) {
      const detail = formatError(error)
      setOperationError(detail)
      await message(`静默启动设置失败\n${detail}`, {
        title: t('Error'),
        kind: 'error',
      })
    } finally {
      setPending(false)
    }
  })

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        {!IS_IN_TAURI && (
          <Typography variant="caption" color="text.secondary">
            浏览器模式不可读写自启动设置，请在桌面应用中操作。
          </Typography>
        )}
        {settings.query.isLoading && IS_IN_TAURI && (
          <Typography variant="caption" color="text.secondary">
            正在读取设置；读取完成前不会发送修改。
          </Typography>
        )}
        {settings.query.isError && IS_IN_TAURI && (
          <Alert severity="error" sx={{ py: 0 }}>
            自启动设置读取失败：{formatError(settings.query.error)}
          </Alert>
        )}
        {!settings.query.isLoading &&
          !settings.query.isError &&
          IS_IN_TAURI &&
          !hasKnownValues && (
            <Alert severity="warning" sx={{ py: 0 }}>
              配置未返回开机启动状态，已禁用修改。
            </Alert>
          )}

        <SettingControlRow
          icon={<RocketLaunch fontSize="small" color="action" />}
          title={t('Auto Start')}
          description="随系统登录启动"
          status={
            pending
              ? '正在应用'
              : typeof enabled === 'boolean'
                ? getOnOffLabel(enabled)
                : '状态未知'
          }
          control={
            <Switch
              size="small"
              checked={enabled === true}
              disabled={!canWrite}
              onChange={() => handleAutoLaunchToggle()}
              inputProps={{ 'aria-label': t('Auto Start') }}
            />
          }
        />

        <SettingControlRow
          icon={<Launch fontSize="small" color="action" />}
          title={t('Silent Start')}
          description="启动时不显示窗口"
          status={
            pending
              ? '正在应用'
              : typeof silentEnabled === 'boolean'
                ? getOnOffLabel(silentEnabled)
                : '状态未知'
          }
          disabled={enabled === false}
          control={
            <Switch
              size="small"
              checked={silentEnabled === true}
              disabled={!canWrite || enabled === false}
              onChange={() => handleSilentStartToggle()}
              inputProps={{ 'aria-label': t('Silent Start') }}
            />
          }
        />
        {enabled === false && IS_IN_TAURI && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 3.5 }}>
            先开启开机自启，静默启动才会生效。
          </Typography>
        )}
        {operationError && <Alert severity="error">{operationError}</Alert>}
      </Stack>
    </Box>
  )
}
