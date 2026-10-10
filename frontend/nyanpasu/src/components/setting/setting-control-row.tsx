import type { ReactNode } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'

export interface SettingControlRowProps {
  title: ReactNode
  description?: ReactNode
  status?: ReactNode
  icon?: ReactNode
  control: ReactNode
  controlPlacement?: 'end' | 'below'
  disabled?: boolean
  details?: ReactNode
  expanded?: boolean
  sx?: SxProps<Theme>
}

/** Shared text and control columns keep every setting aligned, including wrapped content. */
export function SettingControlRow({
  title,
  description,
  status,
  icon,
  control,
  controlPlacement = 'end',
  disabled = false,
  details,
  expanded = false,
  sx,
}: SettingControlRowProps) {
  return (
    <Box
      sx={[
        {
          display: 'grid',
          gridTemplateColumns: '20px minmax(0, 1fr) auto',
          columnGap: 1,
          rowGap: 0.5,
          alignItems: 'start',
          minWidth: 0,
          minHeight: 38,
          opacity: disabled ? 0.68 : 1,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box
        sx={{
          width: 20,
          pt: 0.5,
          display: 'flex',
          justifyContent: 'center',
          '& .MuiSvgIcon-root': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box
        sx={{
          minWidth: 0,
          pt: 0.5,
          gridColumn: controlPlacement === 'below' ? '2 / -1' : '2',
        }}
      >
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ lineHeight: 1.5, overflowWrap: 'anywhere' }}
        >
          {title}
        </Typography>
        {(status || description) && (
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ lineHeight: 1.5, mt: 0.25, overflowWrap: 'anywhere' }}
          >
            {status && (
              <Box component="span" sx={{ fontWeight: 500 }}>
                {status}
              </Box>
            )}
            {status && description ? ' · ' : null}
            {description}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          gridColumn: controlPlacement === 'below' ? '2 / -1' : '3',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {control}
      </Box>
      {details && (
        <Collapse
          in={expanded}
          unmountOnExit
          sx={{ gridColumn: '2 / -1', minWidth: 0 }}
        >
          <Box pt={0.5}>{details}</Box>
        </Collapse>
      )}
    </Box>
  )
}
