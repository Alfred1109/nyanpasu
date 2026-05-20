import { ReactNode } from 'react'
import { getTokenSurfaceStyles } from '@/utils/theme'
import { Box, Typography } from '@mui/material'

export function SettingSummaryPanel({
  children,
  columns = 3,
}: {
  children: ReactNode
  columns?: 2 | 3
}) {
  return (
    <Box
      sx={(theme) => ({
        ...getTokenSurfaceStyles(theme, { elevated: true }),
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: `repeat(${columns}, minmax(0, 1fr))`,
        },
        gap: 0.75,
        p: 1,
        borderRadius: 2.5,
        border: '1px solid',
      })}
    >
      {children}
    </Box>
  )
}

export function SettingSummaryItem({
  label,
  value,
}: {
  label: ReactNode
  value: ReactNode
}) {
  return (
    <Box minWidth={0}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, mt: 0.25, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  )
}
