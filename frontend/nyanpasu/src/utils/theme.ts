import type {} from '@mui/material/themeCssVarsAugmentation'
import type { SxProps, Theme } from '@mui/material/styles'

type ThemeSxObject = NonNullable<
  Exclude<SxProps<Theme>, readonly unknown[] | ((theme: Theme) => unknown)>
>

export const applyDarkStyles = (
  _theme: Theme,
  styles: ThemeSxObject,
): ThemeSxObject => {
  return {
    ':root.dark &': styles,
    '.dark &': styles,
  } as ThemeSxObject
}

export const tokenAlpha = (color: string, opacity: number) =>
  `color-mix(in srgb, ${color} ${(opacity * 100).toFixed(2)}%, transparent)`

export const getThemePaletteTokens = (theme: Theme) => {
  const palette = theme.vars?.palette ?? theme.palette

  return {
    background: {
      default: palette.background.default,
      paper: palette.background.paper,
    },
    text: {
      primary: palette.text.primary,
      secondary: palette.text.secondary,
    },
    action: {
      hover: palette.action.hover,
      selected: palette.action.selected,
      disabled: palette.action.disabled,
    },
    divider: palette.divider,
    primary: {
      main: palette.primary.main,
      light: palette.primary.light ?? palette.primary.main,
      dark: palette.primary.dark ?? palette.primary.main,
      contrastText: palette.primary.contrastText,
    },
    success: {
      main: palette.success.main,
      light: palette.success.light ?? palette.success.main,
      dark: palette.success.dark ?? palette.success.main,
    },
    warning: {
      main: palette.warning.main,
      light: palette.warning.light ?? palette.warning.main,
      dark: palette.warning.dark ?? palette.warning.main,
    },
    error: {
      main: palette.error.main,
      light: palette.error.light ?? palette.error.main,
      dark: palette.error.dark ?? palette.error.main,
    },
    info: {
      main: palette.info.main,
      light: palette.info.light ?? palette.info.main,
      dark: palette.info.dark ?? palette.info.main,
    },
  }
}

export const getTokenSurfaceStyles = (
  theme: Theme,
  options: { tint?: 'primary' | 'info'; elevated?: boolean } = {},
) => {
  const tokens = getThemePaletteTokens(theme)
  const tint = options.tint ? tokens[options.tint].main : tokens.primary.main

  return {
    borderColor: tokenAlpha(tokens.text.primary, 0.1),
    backgroundColor: tokenAlpha(tokens.background.paper, 0.94),
    boxShadow: options.elevated
      ? `0 10px 24px ${tokenAlpha(tokens.text.primary, 0.08)}`
      : 'none',
    '&:hover': {
      backgroundColor: tokenAlpha(tint, 0.08),
    },
  }
}

export const getDefaultChipStyles = (theme: Theme) => {
  const tokens = getThemePaletteTokens(theme)

  return {
    color: tokenAlpha(tokens.text.primary, 0.78),
    backgroundColor: tokenAlpha(tokens.text.primary, 0.06),
    border: `1px solid ${tokenAlpha(tokens.text.primary, 0.1)}`,
  }
}
