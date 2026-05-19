import { memo, useState } from 'react'
import { Bolt } from '@mui/icons-material'
import { CircularProgress } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { cn } from '@nyanpasu/ui'
import FeatureChip from './feature-chip'

const DelayChip = memo(function DelayChip({
  className,
  delay,
  onClick,
}: {
  className?: string
  delay: number
  onClick: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    try {
      setLoading(true)

      await onClick()
    } finally {
      setLoading(false)
    }
  }

  return (
    <FeatureChip
      className={cn(className, loading && 'visible!')}
      sx={(theme) => ({
        ml: 'auto',
        color:
          delay === -1
            ? theme.palette.text.secondary
            : delay > 1000
              ? theme.palette.error.main
              : theme.palette.success.main,
        backgroundColor:
          delay === -1
            ? alpha(theme.palette.text.primary, 0.08)
            : delay > 1000
              ? alpha(theme.palette.error.main, 0.12)
              : alpha(theme.palette.success.main, 0.12),
        borderColor:
          delay === -1
            ? alpha(theme.palette.divider, 0.8)
            : delay > 1000
              ? alpha(theme.palette.error.main, 0.22)
              : alpha(theme.palette.success.main, 0.22),
      })}
      label={
        <>
          <span
            className={cn(
              'flex items-center px-px transition-opacity',
              loading ? 'opacity-0' : 'opacity-100',
            )}
          >
            {delay === -1 ? (
              <Bolt className="scale-[0.6]" />
            ) : !!delay && delay < 10000 ? (
              `${delay} ms`
            ) : (
              'timeout'
            )}
          </span>

          <CircularProgress
            size={12}
            className={cn(
              'transition-opacity',
              'absolute',
              'animate-spin',
              'top-0',
              'bottom-0',
              'left-0',
              'right-0',
              'm-auto',
              loading ? 'opacity-100' : 'opacity-0',
            )}
          />
        </>
      }
      variant="filled"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleClick()
      }}
    />
  )
})

export default DelayChip
