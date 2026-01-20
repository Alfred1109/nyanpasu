import { useControllableValue } from 'ahooks'
import { memo, ReactNode } from 'react'
// mergeSxProps removed in extreme cleanup
import { CircularProgress, Switch, Box, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
// alpha removed in extreme cleanup
import { PaperButton, PaperButtonProps } from './nyanpasu-path'

interface PaperSwitchButtonProps extends PaperButtonProps {
  label?: string
  checked: boolean
  loading?: boolean
  disableLoading?: boolean
  children?: ReactNode
  statusText?: ReactNode
  onClick?: () => Promise<void> | void
  sxPaper?: SxProps<Theme>
  sxButton?: SxProps<Theme>
}

export const PaperSwitchButton = memo(function PaperSwitchButton({
  label,
  checked,
  loading,
  disableLoading,
  children,
  statusText,
  onClick,
  sxPaper,
  sxButton,
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

      if (pending === true) {
        return
      }

      setPending(true)
      try {
        await onClick()
      } finally {
        setPending(false)
      }
    }
  }

  const normalizeSx = (sx?: SxProps<Theme>) => (Array.isArray(sx) ? sx : sx ? [sx] : [])
  const resolvedStatusText = statusText === undefined ? (checked ? '已开启' : '已关闭') : statusText

  return (
    <PaperButton
      sxPaper={[
        {
          backgroundColor: checked ? 'primary.main' : 'background.paper',
          border: checked ? '2px solid' : '1px solid',
          borderColor: checked ? 'primary.main' : 'divider',
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: checked ? 'primary.dark' : 'action.hover',
          },
        },
        ...normalizeSx(sxPaper),
      ]}
      sxButton={[
        {
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 1,
        },
        ...normalizeSx(sxButton),
      ]}
      {...props}
      onClick={handleClick}
    >
      {label ? (
        <>
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} width="100%">
            <Box flex={1} minWidth={0}>
              <Typography
                noWrap
                component="p"
                sx={{
                  fontWeight: 700,
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  color: checked ? 'primary.contrastText' : 'text.primary',
                }}
              >
                {label}
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              {pending === true && <CircularProgress color="inherit" size={18} />}

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
          </Box>

          <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} width="100%">
            <Box flex={1} minWidth={0}>
              {children}
            </Box>

            {resolvedStatusText !== null && (
              <Typography
                variant="caption"
                sx={{
                  color: checked ? 'primary.contrastText' : 'text.secondary',
                  fontWeight: 'medium',
                  fontSize: '0.7rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {resolvedStatusText}
              </Typography>
            )}
          </Box>
        </>
      ) : (
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} width="100%">
          <Box flex={1} minWidth={0}>
            {children}
          </Box>

          <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
            <Box display="flex" alignItems="center" gap={1}>
              {pending === true && <CircularProgress color="inherit" size={18} />}

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

            {resolvedStatusText !== null && (
              <Typography
                variant="caption"
                sx={{
                  color: checked ? 'primary.contrastText' : 'text.secondary',
                  fontWeight: 'medium',
                  fontSize: '0.7rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {resolvedStatusText}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </PaperButton>
  )
})
