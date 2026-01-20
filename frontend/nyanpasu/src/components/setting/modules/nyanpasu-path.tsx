import { memo, ReactNode } from 'react'
// mergeSxProps removed in extreme cleanup
import {
  ButtonBase,
  ButtonBaseProps,
  Paper,
  Typography,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
// alpha removed in extreme cleanup

export interface PaperButtonProps extends ButtonBaseProps {
  label?: string
  children?: ReactNode
  sxPaper?: SxProps<Theme>
  sxButton?: SxProps<Theme>
}

export const PaperButton = memo(function PaperButton({
  label,
  children,
  sxPaper,
  sxButton,
  sx: sxProp,
  ...props
}: PaperButtonProps) {
  const normalizeSx = (sx?: SxProps<Theme>) => (Array.isArray(sx) ? sx : sx ? [sx] : [])

  const mergedPaperSx = [
    {
      borderRadius: 6,
      backgroundColor: 'background.paper',
    },
    ...normalizeSx(sxPaper),
  ] as SxProps<Theme>

  const mergedSx = [
    {
      borderRadius: 6,
      width: '100%',
      textAlign: 'start',
      padding: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      '&.Mui-disabled': {
        pointerEvents: 'auto',
        cursor: 'not-allowed',
      },
    },
    ...normalizeSx(sxButton),
    ...normalizeSx(sxProp as SxProps<Theme> | undefined),
  ] as SxProps<Theme>

  return (
    <Paper
      elevation={0}
      sx={mergedPaperSx}
    >
      <ButtonBase
        sx={mergedSx}
        {...props}
      >
        {label && (
          <Typography
            noWrap
            component="p"
            sx={{
              fontWeight: 700,
              flex: 1,
              minWidth: 0,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            {label}
          </Typography>
        )}

        {children}
      </ButtonBase>
    </Paper>
  )
})
