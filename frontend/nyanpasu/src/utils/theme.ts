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
