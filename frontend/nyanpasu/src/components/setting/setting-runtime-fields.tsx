import { useState } from 'react'
import { formatError } from '@/utils'
import { Tune } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  useManagedRuntimeSettings,
  type ManagedBool,
  type ManagedRuntimeFields,
} from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { isInTauri } from '@nyanpasu/utils'
import {
  SettingSummaryItem,
  SettingSummaryPanel,
} from './setting-summary-panel'

const fieldValue = (field: ManagedBool = { kind: 'unmanaged' }) =>
  field.kind === 'unmanaged' ? 'profile' : field.value ? 'enabled' : 'disabled'
const parseField = (value: string): ManagedBool =>
  value === 'profile'
    ? { kind: 'unmanaged' }
    : { kind: 'managed', value: value === 'enabled' }

const FIELD_INFO = [
  {
    key: 'unified_delay',
    label: '统一延迟计算',
    effectiveKey: 'effective_unified_delay',
  },
  {
    key: 'tcp_concurrent',
    label: 'TCP 并发连接',
    effectiveKey: 'effective_tcp_concurrent',
  },
] as const

const ownershipLabel = (field: ManagedBool | undefined) => {
  const value = fieldValue(field)
  return value === 'profile'
    ? '跟随订阅'
    : value === 'enabled'
      ? '应用开启'
      : '应用关闭'
}

const effectiveLabel = (value: boolean | null | undefined) =>
  value == null ? '内核默认' : value ? '已开启' : '已关闭'

const fieldsEqual = (
  left: ManagedRuntimeFields | null,
  right: ManagedRuntimeFields | null,
) =>
  FIELD_INFO.every(
    ({ key }) => fieldValue(left?.[key]) === fieldValue(right?.[key]),
  )

export default function SettingRuntimeFields() {
  const { query, upsert } = useManagedRuntimeSettings()
  const [draft, setDraft] = useState<ManagedRuntimeFields | null>(null)
  const [initial, setInitial] = useState<ManagedRuntimeFields | null>(null)
  const [discardPrompt, setDiscardPrompt] = useState(false)
  const [feedback, setFeedback] = useState<{
    error: boolean
    text: string
  } | null>(null)
  const desktop = isInTauri()
  const settings = query.data
  const fields = settings?.fields
  const dirty = !fieldsEqual(draft, initial)

  const openEditor = () => {
    if (!fields) return
    const next = { ...fields }
    setDraft(next)
    setInitial(next)
    setFeedback(null)
  }

  const requestClose = () => {
    if (upsert.isPending) return
    if (dirty) setDiscardPrompt(true)
    else {
      setDraft(null)
      setInitial(null)
    }
  }

  const discardChanges = () => {
    setDiscardPrompt(false)
    setDraft(null)
    setInitial(null)
    setFeedback(null)
  }

  const save = async () => {
    if (!draft) return
    setFeedback(null)
    try {
      await upsert.mutateAsync(draft)
      setDraft(null)
      setInitial(null)
      setFeedback({ error: false, text: '运行字段已保存并应用。' })
    } catch (error) {
      setFeedback({ error: true, text: `保存失败：${formatError(error)}` })
    }
  }

  return (
    <>
      <BaseCard label="运行字段">
        <Stack spacing={1.25}>
          {!desktop && (
            <Typography variant="caption" color="text.secondary">
              网页预览不读取或修改本地运行配置。
            </Typography>
          )}
          {query.isError && (
            <Alert severity="error" sx={{ py: 0.5 }}>
              运行字段状态读取失败：{formatError(query.error)}
            </Alert>
          )}
          {desktop && query.isPending && !fields && (
            <Typography variant="body2" color="text.secondary">
              正在读取运行字段…
            </Typography>
          )}
          {!query.isError && desktop && !query.isPending && !fields && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              暂无运行字段数据，请刷新后重试。
            </Alert>
          )}
          {fields && settings && (
            <>
              <SettingSummaryPanel columns={2}>
                {FIELD_INFO.map(({ key, label, effectiveKey }) => (
                  <SettingSummaryItem
                    key={key}
                    label={label}
                    value={
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto',
                            alignItems: 'baseline',
                            gap: 1,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            控制方式
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            textAlign="right"
                            sx={{ overflowWrap: 'anywhere' }}
                          >
                            {ownershipLabel(fields[key])}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto',
                            alignItems: 'baseline',
                            gap: 1,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            当前生效
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            textAlign="right"
                            sx={{ overflowWrap: 'anywhere' }}
                          >
                            {effectiveLabel(settings[effectiveKey])}
                          </Typography>
                        </Box>
                      </Stack>
                    }
                  />
                ))}
              </SettingSummaryPanel>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  {settings.core_running
                    ? '显示当前生成配置的生效值'
                    : '核心未运行，配置将在启动后生效'}
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Tune />}
                  onClick={openEditor}
                  aria-label="编辑运行字段"
                  disabled={!desktop || query.isFetching || query.isError}
                  sx={{ ml: 'auto' }}
                >
                  编辑
                </Button>
              </Stack>
            </>
          )}
          {feedback && draft === null && (
            <Alert severity={feedback.error ? 'error' : 'success'}>
              {feedback.text}
            </Alert>
          )}
        </Stack>
      </BaseCard>

      <Dialog
        open={draft !== null}
        onClose={requestClose}
        maxWidth="sm"
        fullWidth
        aria-labelledby="runtime-fields-dialog-title"
      >
        <DialogTitle id="runtime-fields-dialog-title">
          编辑运行字段{dirty && ' · 未保存'}
        </DialogTitle>
        {draft && (
          <>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ pt: 0.5 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  选择跟随订阅与增强配置，或由应用统一指定。切换订阅后仍保留控制方式。
                </Typography>
                {FIELD_INFO.map(({ key, label, effectiveKey }) => (
                  <TextField
                    key={key}
                    select
                    fullWidth
                    label={label}
                    value={fieldValue(draft[key])}
                    disabled={upsert.isPending}
                    onChange={(event) => {
                      setDraft({
                        ...draft,
                        [key]: parseField(event.target.value),
                      })
                      setFeedback(null)
                    }}
                    helperText={`当前生成配置：${effectiveLabel(query.data?.[effectiveKey])}`}
                  >
                    <MenuItem value="profile">跟随订阅与增强配置</MenuItem>
                    <MenuItem value="enabled">应用统一开启</MenuItem>
                    <MenuItem value="disabled">应用统一关闭</MenuItem>
                  </TextField>
                ))}
                {feedback && (
                  <Alert severity={feedback.error ? 'error' : 'success'}>
                    {feedback.text}
                  </Alert>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={requestClose} disabled={upsert.isPending}>
                取消
              </Button>
              <Button
                variant="contained"
                onClick={save}
                disabled={!desktop || !dirty || upsert.isPending}
              >
                {upsert.isPending ? '正在保存…' : '保存并应用'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={discardPrompt}
        onClose={() => setDiscardPrompt(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>放弃未保存的运行字段？</DialogTitle>
        <DialogContent>修改尚未生效，放弃后会保留原来的配置。</DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardPrompt(false)}>继续编辑</Button>
          <Button color="warning" onClick={discardChanges}>
            放弃修改
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
