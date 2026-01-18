import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
} from 'react'
import { insertStyle } from '@/utils/styled'
import { IS_IN_TAURI } from '@/utils/tauri'
import {
  argbFromHex,
  Theme,
  themeFromSourceColor,
} from '@material/material-color-utilities'
import { CssVarsProvider, useColorScheme } from '@mui/material/styles'
import { createMDYTheme } from '@nyanpasu/ui'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

// Check if we're in Tauri environment before calling Tauri APIs
const isInTauri = IS_IN_TAURI
const appWindow = isInTauri ? getCurrentWebviewWindow() : null

export const DEFAULT_COLOR = '#1867C0'

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

const CUSTOM_THEME_KEY = 'custom-theme' as const

const changeHtmlThemeMode = (mode: Omit<ThemeMode, 'system'>) => {
  const root = document.documentElement

  if (mode === ThemeMode.DARK) {
    root.classList.add(ThemeMode.DARK)
  } else {
    root.classList.remove(ThemeMode.DARK)
  }

  if (mode === ThemeMode.LIGHT) {
    root.classList.add(ThemeMode.LIGHT)
  } else {
    root.classList.remove(ThemeMode.LIGHT)
  }
}

function MUIColorSchemeSync({ themeMode }: { themeMode: ThemeMode }) {
  const { setMode } = useColorScheme()

  useEffect(() => {
    if (themeMode !== ThemeMode.SYSTEM) {
      setMode(themeMode)
      return
    }

    const apply = (mode: 'light' | 'dark') => {
      console.log('🎨 Applying theme mode:', mode)
      changeHtmlThemeMode(mode)
      setMode(mode)
    }

    if (appWindow) {
      console.log('🏷️ Using Tauri window theme detection')
      appWindow
        .theme()
        .then((mode) => {
          console.log('🪟 Tauri window theme:', mode)
          if (mode === 'dark' || mode === 'light') {
            apply(mode)
          }
        })
        .catch((err) => {
          console.error('❌ Failed to get Tauri window theme:', err)
        })

      return
    }

    console.log('🌐 Using browser media query theme detection')
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mql) {
      console.log('❌ Media query not supported, defaulting to light')
      apply('light')
      return
    }

    console.log('🔍 Media query matches dark:', mql.matches)
    apply(mql.matches ? 'dark' : 'light')

    const onChange = (e: MediaQueryListEvent) => {
      apply(e.matches ? 'dark' : 'light')
    }

    mql.addEventListener('change', onChange)
    return () => {
      mql.removeEventListener('change', onChange)
    }
  }, [setMode, themeMode])

  useEffect(() => {
    if (!appWindow) {
      return () => {}
    }

    const unlisten = appWindow.onThemeChanged((e) => {
      if (themeMode === ThemeMode.SYSTEM) {
        changeHtmlThemeMode(e.payload)
        setMode(e.payload)
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [setMode, themeMode])

  return null
}

const ThemeContext = createContext<{
  themePalette: Theme
  themeCssVars: string
  themeColor: string
  setThemeColor: (color: string) => Promise<void>
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => Promise<void>
} | null>(null)

export function useExperimentalThemeContext() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error(
      'useExperimentalThemeContext must be used within a ExperimentalThemeProvider',
    )
  }

  return context
}

export function ExperimentalThemeProvider({ children }: PropsWithChildren) {
  const themePalette = useMemo(
    () => themeFromSourceColor(argbFromHex(DEFAULT_COLOR)),
    [],
  )

  const muiTheme = useMemo(() => createMDYTheme(DEFAULT_COLOR), [])

  useEffect(() => {
    insertStyle(CUSTOM_THEME_KEY, '')
  }, [])

  const setThemeColor = async () => {}
  const setThemeMode = async () => {}

  return (
    <ThemeContext.Provider
      value={{
        themePalette,
        themeCssVars: '',
        themeColor: DEFAULT_COLOR,
        setThemeColor,
        themeMode: ThemeMode.SYSTEM,
        setThemeMode,
      }}
    >
      <CssVarsProvider 
        theme={muiTheme} 
        modeStorageKey="mui-mode-v1"
        defaultMode="system"
      >
        <MUIColorSchemeSync themeMode={ThemeMode.SYSTEM} />
        {children}
      </CssVarsProvider>
    </ThemeContext.Provider>
  )
}
