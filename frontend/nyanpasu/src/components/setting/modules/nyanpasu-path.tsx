import { memo, ReactNode } from 'react'
// mergeSxProps removed in extreme cleanup
import {
  ButtonBase,
  ButtonBaseProps,
  Paper,
  SxProps,
  Theme,
  Typography,
} from '@mui/material'
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
  ...props
}: PaperButtonProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 6,
        backgroundColor: 'background.paper',
        ...sxPaper,
      }}
    >
      <ButtonBase
        sx={{
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
          ...sxButton,
        }}
        {...props}
      >
        {label && (
          <Typography
            noWrap
            component="p"
            width="100%"
            sx={{
              fontWeight: 700,
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
