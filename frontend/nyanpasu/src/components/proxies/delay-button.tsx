import { useDebounceFn, useLockFn } from 'ahooks'
import { useAtom } from 'jotai'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MAX_PROXY_TEST_TIMEOUT_MS,
  MIN_PROXY_TEST_TIMEOUT_MS,
  normalizeProxyTestTimeout,
  proxyTestTimeoutAtom,
} from '@/store/proxies'
import { Bolt, Done, ErrorOutline, Settings } from '@mui/icons-material'
import {
  Button,
  CircularProgress,
  IconButton,
  Popover,
  Slider,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, cn } from '@nyanpasu/ui'

export const DelayButton = memo(function DelayButton({
  onClick,
}: {
  onClick: (timeout: number) => Promise<void>
}) {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [testTimeout, setTestTimeout] = useAtom(proxyTestTimeoutAtom)
  const [draftTimeout, setDraftTimeout] = useState(testTimeout)
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null)

  const [mounted, setMounted] = useState(false)

  const { run: runMounted, cancel: cancelMounted } = useDebounceFn(
    () => setMounted(false),
    { wait: 1000 },
  )

  const handleClick = useLockFn(async () => {
    try {
      setLoading(true)
      setFailed(false)
      setMounted(true)
      cancelMounted()

      await onClick(normalizeProxyTestTimeout(testTimeout))
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
      runMounted()
    }
  })

  const isSuccess = mounted && !loading && !failed

  return (
    <div className="fixed right-8 bottom-8 z-10 flex items-center gap-1">
      <Tooltip title={failed ? t('Latency test failed') : t('Latency check')}>
        <Button
          className="size-16 rounded-2xl! backdrop-blur"
          sx={(theme) => ({
            boxShadow: 8,
            color: isSuccess
              ? theme.palette.success.contrastText
              : theme.palette.primary.main,
            backgroundColor: isSuccess
              ? alpha(theme.palette.success.main, 0.82)
              : alpha(theme.palette.background.paper, 0.92),
            border: '1px solid',
            borderColor: isSuccess
              ? alpha(theme.palette.success.main, 0.32)
              : alpha(theme.palette.primary.main, 0.16),

            '&:hover': {
              backgroundColor: isSuccess
                ? alpha(theme.palette.success.main, 0.88)
                : alpha(theme.palette.primary.main, 0.1),
              borderColor: isSuccess
                ? alpha(theme.palette.success.main, 0.4)
                : alpha(theme.palette.primary.main, 0.24),
            },

            '&.MuiButton-loading': {
              backgroundColor: alpha(theme.palette.background.paper, 0.88),
            },
          })}
          onClick={handleClick}
        >
          <Bolt
            className={cn(
              'size-8!',
              'transition-opacity!',
              mounted ? 'opacity-0' : 'opacity-100',
            )}
          />

          {mounted && (
            <CircularProgress
              size={32}
              className={cn(
                'transition-opacity',
                'absolute',
                loading ? 'opacity-100' : 'opacity-0',
              )}
            />
          )}

          <Done
            color="success"
            className={cn(
              'size-8!',
              'absolute',
              'transition-opacity!',
              isSuccess ? 'opacity-100' : 'opacity-0',
            )}
          />
          <ErrorOutline
            color="error"
            className={cn(
              'size-8!',
              'absolute',
              'transition-opacity!',
              failed ? 'opacity-100' : 'opacity-0',
            )}
          />
        </Button>
      </Tooltip>
      <Tooltip title={t('Latency timeout')}>
        <IconButton
          aria-label={t('Latency timeout')}
          onClick={(event) => {
            setDraftTimeout(testTimeout)
            setSettingsAnchor(event.currentTarget)
          }}
          className="size-10 rounded-xl! backdrop-blur"
          sx={(theme) => ({
            color: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.background.paper, 0.92),
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.16),
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
            },
          })}
        >
          <Settings fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(settingsAnchor)}
        anchorEl={settingsAnchor}
        onClose={() => setSettingsAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <div className="w-64 px-4 py-3">
          <Typography variant="subtitle2" className="mb-2">
            {t('Latency timeout')}: {(draftTimeout / 1000).toFixed(0)} s
          </Typography>
          <Slider
            aria-label={t('Latency timeout')}
            value={draftTimeout / 1000}
            min={MIN_PROXY_TEST_TIMEOUT_MS / 1000}
            max={MAX_PROXY_TEST_TIMEOUT_MS / 1000}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value} s`}
            onChange={(_, value) => {
              if (typeof value === 'number') setDraftTimeout(value * 1000)
            }}
            onChangeCommitted={(_, value) => {
              if (typeof value === 'number') {
                const normalized = normalizeProxyTestTimeout(value * 1000)
                setDraftTimeout(normalized)
                setTestTimeout(normalized)
              }
            }}
          />
        </div>
      </Popover>
    </div>
  )
})
