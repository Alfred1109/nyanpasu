import { useControllableValue } from 'ahooks'
import { memo, ReactNode } from 'react'
import { getThemePaletteTokens, tokenAlpha } from '@/utils/theme'
import { Box, CircularProgress, Switch, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
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
  sxLabel?: SxProps<Theme>
}

const getPaperSwitchStyles = (theme: Theme, checked: boolean) => {
  const tokens = getThemePaletteTokens(theme)

  return {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: checked
      ? tokens.primary.main
      : tokenAlpha(tokens.background.paper, 0.96),
    border: '1px solid',
    borderColor: checked
      ? tokenAlpha(tokens.primary.main, 0.42)
      : tokenAlpha(tokens.primary.main, 0.18),
    boxShadow: checked
      ? `0 0 0 1px ${tokenAlpha(tokens.primary.main, 0.16)}`
      : 'none',
    transition:
      'background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
    '&:hover': {
      backgroundColor: checked
        ? tokens.primary.main
        : tokenAlpha(tokens.primary.main, 0.08),
      borderColor: checked
        ? tokenAlpha(tokens.primary.main, 0.5)
        : tokenAlpha(tokens.primary.main, 0.24),
      boxShadow: checked
        ? `0 0 0 1px ${tokenAlpha(tokens.primary.main, 0.2)}`
        : 'none',
    },
  }
}

const getSwitchStyles = (theme: Theme, checked: boolean) => {
  const tokens = getThemePaletteTokens(theme)

  return {
    pointerEvents: 'none',
    '& .MuiSwitch-thumb': {
      backgroundColor: checked
        ? tokens.primary.contrastText
        : tokens.primary.main,
    },
    '& .MuiSwitch-track': {
      opacity: 1,
      backgroundColor: checked
        ? tokenAlpha(tokens.primary.contrastText, 0.32)
        : tokenAlpha(tokens.primary.main, 0.22),
    },
  }
}

const getStatusTextStyles = (theme: Theme, checked: boolean) => {
  const tokens = getThemePaletteTokens(theme)

  return {
    color: checked ? tokens.primary.contrastText : tokens.text.secondary,
    fontWeight: 700,
    fontSize: '0.7rem',
    whiteSpace: 'nowrap',
  }
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
  sxLabel,
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
            flexWrap="wrap"
            width="100%"
          >
            <Box flex={1} minWidth={0}>
              <Typography
                noWrap
                component="p"
                sx={[
                  (theme) => {
                    const tokens = getThemePaletteTokens(theme)

                    return {
                      fontWeight: 700,
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      color: checked
                        ? tokens.primary.contrastText
                        : tokens.text.primary,
                    }
                  },
                  ...normalizeSx(sxLabel),
                ]}
              >
                {label}
              </Typography>
            </Box>

            {switchIndicator}
          </Box>

          <Box
            display="flex"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            gap={1}
            flexWrap="wrap"
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
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          gap={1}
          flexWrap="wrap"
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
            ml="auto"
          >
            {switchIndicator}
            {statusCaption}
          </Box>
        </Box>
      )}
    </PaperButton>
  )
})
