import type { SxProps, Theme } from '@mui/material/styles'

type ThemeSxObject = NonNullable<
  Exclude<SxProps<Theme>, readonly unknown[] | ((theme: Theme) => unknown)>
>

export const applyDarkStyles = (
  theme: Theme,
  styles: ThemeSxObject,
): ThemeSxObject => {
  return (theme.applyStyles?.('dark', styles as never) ?? {}) as ThemeSxObject
}
