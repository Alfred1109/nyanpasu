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

  return (
    <PaperButton
      sxPaper={[
        (theme) => ({
          position: 'relative',
          overflow: 'hidden',
          background: checked
            ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
            : theme.palette.mode === 'dark'
              ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.94)} 0%, ${alpha(theme.palette.primary.main, 0.14)} 100%)`
              : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.98)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          border: '1px solid',
          borderColor: checked
            ? alpha(theme.palette.primary.main, 0.42)
            : theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.12)
              : alpha(theme.palette.common.black, 0.08),
          boxShadow: checked
            ? `0 16px 32px ${alpha(theme.palette.primary.main, 0.22)}`
            : theme.palette.mode === 'dark'
              ? `0 12px 28px ${alpha(theme.palette.common.black, 0.22)}`
              : `0 10px 24px ${alpha(theme.palette.common.black, 0.06)}`,
          transition: 'all 0.25s ease',
          '&::before': checked
            ? {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(120deg, transparent 18%, ${alpha(theme.palette.common.white, 0.18)} 46%, transparent 62%)`,
                pointerEvents: 'none',
              }
            : undefined,
          '&:hover': {
            background: checked
              ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`
              : theme.palette.mode === 'dark'
                ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.primary.main, 0.18)} 100%)`
                : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 1)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
            borderColor: checked
              ? alpha(theme.palette.primary.main, 0.5)
              : theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.24)
                : alpha(theme.palette.primary.main, 0.16),
            boxShadow: checked
              ? `0 18px 34px ${alpha(theme.palette.primary.main, 0.24)}`
              : theme.palette.mode === 'dark'
                ? `0 16px 30px ${alpha(theme.palette.common.black, 0.24)}`
                : `0 14px 28px ${alpha(theme.palette.common.black, 0.08)}`,
          },
        }),
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

            <Box display="flex" alignItems="center" gap={1}>
              {pending === true && (
                <CircularProgress color="inherit" size={18} />
              )}

              <Switch
                checked={checked}
                size="small"
                sx={(theme) => ({
                  pointerEvents: 'none',
                  '& .MuiSwitch-thumb': {
                    backgroundColor: checked
                      ? theme.palette.primary.contrastText
                      : theme.palette.primary.main,
                  },
                  '& .MuiSwitch-track': {
                    opacity: 1,
                    backgroundColor: checked
                      ? alpha(theme.palette.common.white, 0.32)
                      : alpha(theme.palette.primary.main, 0.22),
                  },
                })}
              />
            </Box>
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

            {resolvedStatusText !== null && (
              <Typography
                variant="caption"
                sx={(theme) => ({
                  color: checked
                    ? theme.palette.primary.contrastText
                    : alpha(
                        theme.palette.text.primary,
                        theme.palette.mode === 'dark' ? 0.78 : 0.7,
                      ),
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  whiteSpace: 'nowrap',
                })}
              >
                {resolvedStatusText}
              </Typography>
            )}
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
            <Box display="flex" alignItems="center" gap={1}>
              {pending === true && (
                <CircularProgress color="inherit" size={18} />
              )}

              <Switch
                checked={checked}
                size="small"
                sx={(theme) => ({
                  pointerEvents: 'none',
                  '& .MuiSwitch-thumb': {
                    backgroundColor: checked
                      ? theme.palette.primary.contrastText
                      : theme.palette.primary.main,
                  },
                  '& .MuiSwitch-track': {
                    opacity: 1,
                    backgroundColor: checked
                      ? alpha(theme.palette.common.white, 0.32)
                      : alpha(theme.palette.primary.main, 0.22),
                  },
                })}
              />
            </Box>

            {resolvedStatusText !== null && (
              <Typography
                variant="caption"
                sx={(theme) => ({
                  color: checked
                    ? theme.palette.primary.contrastText
                    : alpha(
                        theme.palette.text.primary,
                        theme.palette.mode === 'dark' ? 0.78 : 0.7,
                      ),
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  whiteSpace: 'nowrap',
                })}
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
