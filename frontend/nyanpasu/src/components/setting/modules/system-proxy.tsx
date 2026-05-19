import { useControllableValue } from 'ahooks'
import { memo, ReactNode } from 'react'
import { Box, CircularProgress, Switch, Typography } from '@mui/material'
import { alpha, type SxProps, type Theme } from '@mui/material/styles'
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

const getPaperSwitchStyles = (theme: Theme, checked: boolean) => ({
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: checked
    ? theme.palette.primary.main
    : theme.palette.background.paper,
  border: '1px solid',
  borderColor: checked
    ? alpha(theme.palette.primary.main, 0.4)
    : alpha(theme.palette.primary.main, 0.16),
  boxShadow: checked
    ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.14)}`
    : 'none',
  transition:
    'background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
  '&:hover': {
    backgroundColor: checked
      ? theme.palette.primary.main
      : alpha(theme.palette.primary.main, 0.05),
    borderColor: checked
      ? alpha(theme.palette.primary.main, 0.48)
      : alpha(theme.palette.primary.main, 0.22),
    boxShadow: checked
      ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}`
      : 'none',
  },
})

const getSwitchStyles = (theme: Theme, checked: boolean) => ({
  pointerEvents: 'none',
  '& .MuiSwitch-thumb': {
    backgroundColor: checked
      ? theme.palette.primary.contrastText
      : theme.palette.primary.main,
  },
  '& .MuiSwitch-track': {
    opacity: 1,
    backgroundColor: checked
      ? alpha(theme.palette.primary.contrastText, 0.32)
      : alpha(theme.palette.primary.main, 0.22),
  },
})

const getStatusTextStyles = (theme: Theme, checked: boolean) => ({
  color: checked
    ? theme.palette.primary.contrastText
    : theme.palette.text.secondary,
  fontWeight: 700,
  fontSize: '0.7rem',
  whiteSpace: 'nowrap',
})

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

  const normalizeSx = (sx?: SxProps<Theme>) =>
    Array.isArray(sx) ? sx : sx ? [sx] : []
  const resolvedStatusText =
    statusText === undefined ? (checked ? '已开启' : '已关闭') : statusText
  const switchIndicator = (
    <Box display="flex" alignItems="center" gap={1}>
      {pending === true && <CircularProgress color="inherit" size={18} />}

      <Switch
        checked={checked}
        size="small"
        sx={(theme) => getSwitchStyles(theme, checked)}
      />
    </Box>
  )
  const statusCaption =
    resolvedStatusText !== null ? (
      <Typography
        variant="caption"
        sx={(theme) => getStatusTextStyles(theme, checked)}
      >
        {resolvedStatusText}
      </Typography>
    ) : null

  return (
    <PaperButton
      sxPaper={[
        (theme) => getPaperSwitchStyles(theme, checked),
        ...normalizeSx(sxPaper),
      ]}
      sxButton={[
        {
          position: 'relative',
          zIndex: 1,
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
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            width="100%"
          >
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

            {switchIndicator}
          </Box>

          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            width="100%"
          >
            <Box flex={1} minWidth={0}>
              {children}
            </Box>

            {statusCaption}
          </Box>
        </>
      ) : (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          width="100%"
        >
          <Box flex={1} minWidth={0}>
            {children}
          </Box>

          <Box
            display="flex"
            flexDirection="column"
            alignItems="flex-end"
            gap={0.5}
          >
            {switchIndicator}
            {statusCaption}
          </Box>
        </Box>
      )}
    </PaperButton>
  )
})
