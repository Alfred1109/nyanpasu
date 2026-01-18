import { useControllableValue } from 'ahooks'
import { memo, ReactNode } from 'react'
// mergeSxProps removed in extreme cleanup
import { CircularProgress, Switch, Box, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
// alpha removed in extreme cleanup
import { PaperButton, PaperButtonProps } from './nyanpasu-path'

export interface PaperSwitchButtonProps extends PaperButtonProps {
  label?: string
  checked: boolean
  loading?: boolean
  disableLoading?: boolean
  children?: ReactNode
  onClick?: () => Promise<void> | void
  sxPaper?: SxProps<Theme>
}

export const PaperSwitchButton = memo(function PaperSwitchButton({
  label,
  checked,
  loading,
  disableLoading,
  children,
  onClick,
  sxPaper,
  ...props
}: PaperSwitchButtonProps) {
  const [pending, setPending] = useControllableValue<boolean>(
    { loading },
    {
      defaultValue: false,
    },
  )

  const handleClick = async () => {
    if (onClick) {
      if (disableLoading) {
        return onClick()
      }

      setPending(true)
      await onClick()
      setPending(false)
    }
  }

  return (
    <PaperButton
      label={label}
      sxPaper={{
        backgroundColor: checked 
          ? 'primary.main' 
          : 'background.paper',
        border: checked 
          ? '2px solid' 
          : '1px solid',
        borderColor: checked 
          ? 'primary.main' 
          : 'divider',
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: checked 
            ? 'primary.dark' 
            : 'action.hover',
        },
      }}
      sxButton={{
        flexDirection: 'column',
        alignItems: 'start',
        gap: 0.5,
        position: 'relative',
      }}
      onClick={handleClick}
      {...props}
    >
      {/* Switch indicator */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
        }}
      >
        <Switch
          checked={checked}
          size="small"
          sx={{
            pointerEvents: 'none',
            '& .MuiSwitch-thumb': {
              backgroundColor: checked ? 'primary.contrastText' : 'text.secondary',
            },
            '& .MuiSwitch-track': {
              backgroundColor: checked ? 'primary.light' : 'action.disabled',
            },
          }}
        />
      </Box>

      {/* Status text */}
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          color: checked ? 'primary.contrastText' : 'text.secondary',
          fontWeight: 'medium',
          fontSize: '0.7rem',
        }}
      >
        {checked ? '已开启' : '已关闭'}
      </Typography>

      {pending === true && (
        <CircularProgress
          sx={{
            position: 'absolute',
            bottom: 'calc(50% - 12px)',
            right: 12,
          }}
          color="inherit"
          size={24}
        />
      )}

      {children}
    </PaperButton>
  )
})
