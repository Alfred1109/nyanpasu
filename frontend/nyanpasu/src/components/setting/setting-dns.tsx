import { useState } from 'react'
import { formatError } from '@/utils'
import {
  Dns,
  ExpandLess,
  ExpandMore,
  Refresh,
  Settings,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import {
  useDnsSettings,
  useSetting,
  type DnsConfig,
  type JsonValue,
} from '@nyanpasu/interface'
import { BaseCard } from '@nyanpasu/ui'
import { isInTauri } from '@nyanpasu/utils'
import { dnsListText, parseDnsDraft, parseDnsList } from './dns-form'
import {
  SettingSummaryItem,
  SettingSummaryPanel,
} from './setting-summary-panel'

const LIST_FIELDS = [
  {
    key: 'nameserver',
    label: '上游 DNS',
    help: '每行一个地址，支持 IP、DoH、DoT 等内核支持的格式。',
  },
  {
    key: 'default-nameserver',
    label: '引导 DNS',
    help: '用于解析上游 DNS 的域名，每行一个地址。',
  },
  {
    key: 'fallback',
    label: '后备 DNS',
    help: '配合 fallback-filter 使用；留空表示无后备服务器。',
  },
  {
    key: 'proxy-server-nameserver',
    label: '代理节点 DNS',
    help: '用于解析代理节点域名；仅适用于支持此字段的内核。',
  },
  {
    key: 'direct-nameserver',
    label: '直连 DNS',
    help: '用于直连出口解析；仅适用于支持此字段的内核。',
  },
  {
    key: 'fake-ip-filter',
    label: 'Fake-IP 排除域名',
    help: '每行一个域名或匹配规则，保留需要真实 IP 的域名。',
  },
] as const

type EditorState = {
  custom: boolean
  text: string
  initialCustom: boolean
  initialText: string
  tab: number
}

export default function SettingDns() {
  const { query, upsert } = useDnsSettings()
  const tunMode = useSetting('enable_tun_mode')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [feedback, setFeedback] = useState<{
    error: boolean
    text: string
  } | null>(null)
  const [discardPrompt, setDiscardPrompt] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const desktop = isInTauri()
  const data = query.data
  const effective = data?.effective
  const enabled = effective?.enable === true
  const status = query.isError
    ? '读取失败'
    : !data
      ? '尚未读取'
      : !data.core_running
        ? '核心未运行'
        : !effective
          ? '未配置'
          : enabled
            ? '已开启'
            : '已关闭'
  const parsed = parseDnsDraft(editor?.text ?? '{}')
  const dirty = Boolean(
    editor &&
    (editor.custom !== editor.initialCustom ||
      (editor.custom && editor.text !== editor.initialText)),
  )

  const fieldsDisabled =
    !editor?.custom || upsert.isPending || Boolean(parsed.error)

  const openEditor = () => {
    const text = JSON.stringify(data?.overrides ?? {}, null, 2)
    const custom = data?.overrides != null
    setEditor({
      custom,
      text,
      initialCustom: custom,
      initialText: text,
      tab: 0,
    })
    setFeedback(null)
  }

  const requestClose = () => {
    if (upsert.isPending) return
    if (dirty) setDiscardPrompt(true)
    else setEditor(null)
  }

  const valueFor = (key: string): JsonValue | undefined =>
    parsed.value &&
    Object.hasOwn(parsed.value, key) &&
    parsed.value[key] !== null
      ? parsed.value[key]
      : effective?.[key]

  const changeField = (key: string, value: JsonValue) => {
    if (!editor || !parsed.value) return
    setFeedback(null)
    setEditor({
      ...editor,
      text: JSON.stringify({ ...parsed.value, [key]: value }, null, 2),
    })
  }

  const save = async () => {
    if (!editor || (editor.custom && !parsed.value)) return
    setFeedback(null)
    try {
      const saved = await upsert.mutateAsync(
        editor.custom ? (parsed.value as DnsConfig) : null,
      )
      setEditor(null)
      setFeedback({
        error: false,
        text: saved?.core_running
          ? editor.custom
            ? 'DNS 设置已保存并加载到核心。'
            : '已恢复跟随订阅和增强配置，并加载到核心。'
          : 'DNS 设置已保存并校验通过，核心启动后生效。',
      })
    } catch (error) {
      setFeedback({
        error: true,
        text: `DNS 设置未能保存：${formatError(error)}`,
      })
    }
  }

  return (
    <>
      <BaseCard label="DNS 配置">
        <Stack spacing={1.25}>
          {!desktop && (
            <Typography variant="caption" color="text.secondary">
              网页预览不读取或修改本地 DNS 配置。
            </Typography>
          )}
          {query.isError && (
            <Alert severity="error" sx={{ py: 0.5 }}>
              DNS 状态读取失败：{formatError(query.error)}
            </Alert>
          )}
          {desktop && query.isPending && !data && (
            <Typography variant="body2" color="text.secondary">
              正在读取 DNS 状态…
            </Typography>
          )}
          {!query.isError && desktop && !query.isPending && !data && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              暂无 DNS 状态数据，请刷新后重试。
            </Alert>
          )}
          <SettingSummaryPanel columns={3}>
            <SettingSummaryItem
              label="配置来源"
              value={
                !data
                  ? '尚未读取'
                  : data.overrides
                    ? '全局自定义'
                    : '订阅与增强配置'
              }
            />
            <SettingSummaryItem
              label={data?.core_running ? '当前模式' : '生成模式'}
              value={
                typeof effective?.['enhanced-mode'] === 'string'
                  ? effective['enhanced-mode']
                  : '未指定'
              }
            />
            <SettingSummaryItem label="DNS 状态" value={status} />
          </SettingSummaryPanel>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={0.5}
            useFlexGap
          >
            <Button
              size="small"
              onClick={() => setDetailsExpanded((value) => !value)}
              endIcon={detailsExpanded ? <ExpandLess /> : <ExpandMore />}
              disabled={!effective || query.isError}
              aria-expanded={detailsExpanded}
              sx={{ px: 0.5, minWidth: 0 }}
            >
              查看生效 DNS 详情
            </Button>
            {tunMode.value && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                TUN 开启时会强制启用 DNS
              </Typography>
            )}
          </Stack>
          <Collapse in={detailsExpanded && Boolean(effective)}>
            {effective && (
              <Stack spacing={1} sx={{ pt: 0.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    {data?.core_running ? '当前上游 DNS' : '生成配置的上游 DNS'}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      mt: 0.25,
                    }}
                  >
                    {dnsListText(effective.nameserver) || '未指定'}
                  </Typography>
                </Box>
                <SettingSummaryPanel columns={2}>
                  <SettingSummaryItem
                    label="IPv6"
                    value={effective.ipv6 === true ? '开启' : '关闭'}
                  />
                  <SettingSummaryItem
                    label="监听地址"
                    value={
                      typeof effective.listen === 'string'
                        ? effective.listen
                        : '未指定'
                    }
                  />
                </SettingSummaryPanel>
              </Stack>
            )}
          </Collapse>
          {feedback && !editor && (
            <Alert severity={feedback.error ? 'error' : 'success'}>
              {feedback.text}
            </Alert>
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              startIcon={<Settings />}
              onClick={openEditor}
              size="small"
              aria-label="编辑 DNS 配置"
              disabled={!desktop || !data || query.isFetching || query.isError}
            >
              编辑
            </Button>
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={() => query.refetch()}
              disabled={!desktop || query.isFetching}
            >
              {query.isFetching ? '读取中…' : '刷新状态'}
            </Button>
          </Stack>
        </Stack>
      </BaseCard>

      <Dialog
        open={editor !== null}
        onClose={requestClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
        aria-labelledby="dns-dialog-title"
      >
        <DialogTitle id="dns-dialog-title">
          <Stack direction="row" alignItems="center" gap={1}>
            <Dns />
            DNS 配置
            {dirty && <Chip size="small" color="warning" label="未保存" />}
          </Stack>
        </DialogTitle>
        {editor && (
          <>
            <DialogContent dividers>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={editor.custom}
                      disabled={upsert.isPending}
                      onChange={(_, checked) => {
                        setEditor({ ...editor, custom: checked })
                        setFeedback(null)
                      }}
                    />
                  }
                  label="使用全局自定义 DNS 配置"
                />
                <Alert severity="info">
                  {editor.custom
                    ? '只覆盖你修改的字段，其他字段继续跟随订阅和增强配置。保存前会由当前核心校验配置。'
                    : '保存后移除全局 DNS 覆盖，恢复订阅和增强配置提供的 DNS；TUN 仍会启用所需的 DNS。'}
                </Alert>
                {tunMode.value && editor.custom && (
                  <Alert severity="warning">
                    TUN 已开启，最终 DNS 状态会保持开启。
                  </Alert>
                )}
                <Tabs
                  value={editor.tab}
                  onChange={(_, tab: number) => setEditor({ ...editor, tab })}
                  aria-label="DNS 编辑方式"
                >
                  <Tab label="常用设置" />
                  <Tab label="高级配置" />
                </Tabs>
                {editor.tab === 0 ? (
                  <Stack spacing={2}>
                    {parsed.error && (
                      <Alert severity="error">
                        {parsed.error} 请在高级配置中修正。
                      </Alert>
                    )}
                    <Box
                      component="fieldset"
                      disabled={
                        !editor.custom ||
                        upsert.isPending ||
                        Boolean(parsed.error)
                      }
                      sx={{
                        border: 0,
                        p: 0,
                        m: 0,
                        minWidth: 0,
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: 'minmax(0, 1fr)',
                          sm: 'repeat(2, minmax(0, 1fr))',
                        },
                        gap: 2,
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            disabled={fieldsDisabled}
                            checked={valueFor('enable') === true}
                            onChange={(_, checked) =>
                              changeField('enable', checked)
                            }
                          />
                        }
                        label="启用 DNS"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            disabled={fieldsDisabled}
                            checked={valueFor('ipv6') === true}
                            onChange={(_, checked) =>
                              changeField('ipv6', checked)
                            }
                          />
                        }
                        label="解析 IPv6 地址"
                      />
                      <TextField
                        select
                        disabled={fieldsDisabled}
                        label="解析模式"
                        value={valueFor('enhanced-mode') ?? ''}
                        onChange={(event) =>
                          changeField('enhanced-mode', event.target.value)
                        }
                        helperText="未修改的字段继续使用当前配置。"
                      >
                        <MenuItem value="" disabled>
                          未指定
                        </MenuItem>
                        <MenuItem value="fake-ip">Fake-IP</MenuItem>
                        <MenuItem value="redir-host">Redir-Host</MenuItem>
                      </TextField>
                      <TextField
                        disabled={fieldsDisabled}
                        label="监听地址"
                        placeholder="127.0.0.1:1053"
                        value={valueFor('listen') ?? ''}
                        onChange={(event) =>
                          changeField('listen', event.target.value)
                        }
                        helperText="填写地址与端口，避免与系统 DNS 端口冲突。"
                      />
                      {LIST_FIELDS.slice(0, 3).map(({ key, label, help }) => (
                        <TextField
                          key={key}
                          disabled={fieldsDisabled}
                          label={label}
                          defaultValue={dnsListText(valueFor(key))}
                          onChange={(event) =>
                            changeField(key, parseDnsList(event.target.value))
                          }
                          multiline
                          minRows={3}
                          helperText={help}
                          sx={
                            key === 'nameserver'
                              ? { gridColumn: '1 / -1' }
                              : undefined
                          }
                        />
                      ))}
                    </Box>
                  </Stack>
                ) : (
                  <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                      高级 JSON
                      仅列出全局覆盖字段。删除某个键即可恢复该字段跟随订阅；支持
                      nameserver-policy、fallback-filter
                      等复杂规则，并保留其他内核字段。
                    </Typography>
                    <TextField
                      label="DNS 覆盖配置（JSON）"
                      value={editor.text}
                      onChange={(event) => {
                        setEditor({ ...editor, text: event.target.value })
                        setFeedback(null)
                      }}
                      disabled={!editor.custom || upsert.isPending}
                      multiline
                      minRows={10}
                      maxRows={22}
                      error={editor.custom && Boolean(parsed.error)}
                      helperText={
                        editor.custom
                          ? (parsed.error ??
                            '字段名使用核心配置格式，例如 enhanced-mode、nameserver-policy。')
                          : '开启自定义配置后可编辑。'
                      }
                      slotProps={{
                        input: {
                          sx: { fontFamily: 'monospace', fontSize: 13 },
                        },
                      }}
                    />
                    {parsed.value && (
                      <Box
                        component="fieldset"
                        disabled={!editor.custom || upsert.isPending}
                        sx={{
                          border: 0,
                          p: 0,
                          m: 0,
                          minWidth: 0,
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: 'minmax(0, 1fr)',
                            sm: 'repeat(2, minmax(0, 1fr))',
                          },
                          gap: 2,
                        }}
                      >
                        <TextField
                          disabled={fieldsDisabled}
                          label="Fake-IP 地址范围"
                          value={valueFor('fake-ip-range') ?? ''}
                          onChange={(event) =>
                            changeField('fake-ip-range', event.target.value)
                          }
                          placeholder="198.18.0.1/16"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              disabled={fieldsDisabled}
                              checked={valueFor('use-hosts') === true}
                              onChange={(_, checked) =>
                                changeField('use-hosts', checked)
                              }
                            />
                          }
                          label="使用 hosts"
                        />
                        {LIST_FIELDS.slice(3).map(({ key, label, help }) => (
                          <TextField
                            key={key}
                            disabled={fieldsDisabled}
                            label={label}
                            defaultValue={dnsListText(valueFor(key))}
                            onChange={(event) =>
                              changeField(key, parseDnsList(event.target.value))
                            }
                            multiline
                            minRows={3}
                            helperText={help}
                          />
                        ))}
                      </Box>
                    )}
                  </Stack>
                )}
                {feedback && (
                  <Alert severity={feedback.error ? 'error' : 'success'}>
                    {feedback.text}
                  </Alert>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
              <Button
                onClick={() => {
                  setEditor({ ...editor, custom: false })
                  setFeedback(null)
                }}
                disabled={upsert.isPending || !editor.custom}
                sx={{ mr: 'auto' }}
              >
                恢复跟随订阅
              </Button>
              <Button onClick={requestClose} disabled={upsert.isPending}>
                取消
              </Button>
              <Button
                variant="contained"
                onClick={save}
                disabled={
                  !desktop ||
                  !data ||
                  !dirty ||
                  upsert.isPending ||
                  (editor.custom && Boolean(parsed.error))
                }
              >
                {upsert.isPending ? '校验并保存中…' : '保存并应用'}
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
        <DialogTitle>放弃未保存的 DNS 设置？</DialogTitle>
        <DialogContent>修改尚未生效，放弃后会保留原来的配置。</DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardPrompt(false)}>继续编辑</Button>
          <Button
            color="warning"
            onClick={() => {
              setDiscardPrompt(false)
              setEditor(null)
              setFeedback(null)
            }}
          >
            放弃修改
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
