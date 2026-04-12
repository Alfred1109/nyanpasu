import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Notice } from '@/components/base'
import { formatError } from '@/utils'
import { ClearRounded, ContentCopyRounded, Download } from '@mui/icons-material'
import {
  CircularProgress,
  FilledInputProps,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material'
import { useProfile } from '@nyanpasu/interface'
import { alpha } from '@nyanpasu/ui'
import { readText } from '@tauri-apps/plugin-clipboard-manager'

const getQuickImportErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error)
  const normalized = raw.toLowerCase()

  if (
    normalized.includes('401 unauthorized') ||
    normalized.includes('403 forbidden') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return '订阅链接无效、已过期，或当前 token 未授权访问。'
  }

  if (normalized.includes('timed out') || normalized.includes('timeout')) {
    return '下载订阅超时，请检查网络连接后重试。'
  }

  if (
    normalized.includes('dns') ||
    normalized.includes('connection refused') ||
    normalized.includes('failed to connect') ||
    normalized.includes('network')
  ) {
    return '无法连接到订阅服务器，请检查网络或代理设置。'
  }

  if (
    normalized.includes('failed to parse the url') ||
    normalized.includes('relative url') ||
    normalized.includes('invalid url')
  ) {
    return '订阅链接格式不正确，请检查后重新导入。'
  }

  if (
    normalized.includes('failed to build a remote profile') ||
    normalized.includes('subscribe failed')
  ) {
    return `订阅导入失败：${formatError(error)}`
  }

  return `订阅导入失败：${formatError(error)}`
}

export const QuickImport = () => {
  const { t } = useTranslation()

  const [url, setUrl] = useState('')

  const [loading, setLoading] = useState(false)

  const { create } = useProfile()

  const onCopyLink = async () => {
    const text = await readText()

    if (text) {
      setUrl(text.trim())
    }
  }

  const endAdornment = () => {
    if (loading) {
      return <CircularProgress size={20} />
    }

    if (url) {
      return (
        <>
          <Tooltip title={t('Clear')}>
            <IconButton size="small" onClick={() => setUrl('')}>
              <ClearRounded fontSize="inherit" />
            </IconButton>
          </Tooltip>

          <Tooltip title={t('Download')}>
            <IconButton size="small" onClick={handleImport}>
              <Download fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </>
      )
    }

    return (
      <Tooltip title={t('Paste')}>
        <IconButton size="small" onClick={onCopyLink}>
          <ContentCopyRounded fontSize="inherit" />
        </IconButton>
      </Tooltip>
    )
  }

  const handleImport = async () => {
    const normalizedUrl = url.trim()
    if (!normalizedUrl) return

    try {
      setLoading(true)

      await create.mutateAsync({
        type: 'url',
        data: {
          url: normalizedUrl,
          option: {
            user_agent: null,
            with_proxy: null,
            self_proxy: null,
            update_interval: null,
          },
        },
      })

      setUrl('')
      Notice.success('订阅导入成功')
    } catch (error) {
      console.error('Quick import failed:', error)
      Notice.error(getQuickImportErrorMessage(error), 4500)
    } finally {
      setLoading(false)
    }
  }

  const inputProps: Partial<FilledInputProps> = {
    sx: (theme) => ({
      borderRadius: 7,
      backgroundColor: alpha(theme.vars.palette.primary.main, 0.1),

      fieldset: {
        border: 'none',
      },
    }),
    endAdornment: endAdornment(),
  }

  return (
    <TextField
      hiddenLabel
      fullWidth
      autoComplete="off"
      spellCheck="false"
      value={url}
      placeholder={t('Profile URL')}
      onChange={(e) => setUrl(e.target.value)}
      onKeyDown={(e) =>
        url.trim() !== '' && e.key === 'Enter' && handleImport()
      }
      sx={{ input: { py: 1, px: 2 } }}
      slotProps={{
        input: inputProps,
      }}
    />
  )
}
