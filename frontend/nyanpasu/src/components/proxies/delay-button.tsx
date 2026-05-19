import { useDebounceFn, useLockFn } from 'ahooks'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bolt, Done } from '@mui/icons-material'
import { Button, CircularProgress, Tooltip } from '@mui/material'
import { alpha, cn } from '@nyanpasu/ui'

export const DelayButton = memo(function DelayButton({
  onClick,
}: {
  onClick: () => Promise<void>
}) {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)

  const [mounted, setMounted] = useState(false)

  const { run: runMounted, cancel: cancelMounted } = useDebounceFn(
    () => setMounted(false),
    { wait: 1000 },
  )

  const handleClick = useLockFn(async () => {
    try {
      setLoading(true)
      setMounted(true)
      cancelMounted()

      await onClick()
    } finally {
      setLoading(false)
      runMounted()
    }
  })

  const isSuccess = mounted && !loading

  return (
    <Tooltip title={t('Latency check')}>
      <Button
        className="fixed! right-8 bottom-8 z-10 size-16 rounded-2xl! backdrop-blur"
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
      </Button>
    </Tooltip>
  )
})
