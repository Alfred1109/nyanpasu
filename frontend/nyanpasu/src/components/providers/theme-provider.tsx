import {
  createContext,
  PropsWithChildren,
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
import { isLinux } from '@/consts'

// Check if we're in Tauri environment before calling Tauri APIs
const isInTauri = IS_IN_TAURI
const appWindow = isInTauri ? getCurrentWebviewWindow() : null

const DEFAULT_COLOR = '#1867C0'

const CUSTOM_THEME_KEY = 'custom-theme' as const

const changeHtmlThemeMode = (mode: 'light' | 'dark') => {
  const root = document.documentElement

  if (mode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  if (mode === 'light') {
    root.classList.add('light')
  } else {
    root.classList.remove('light')
  }
}

function MUIColorSchemeSync() {
  const { setMode } = useColorScheme()

  useEffect(() => {
    // Always use system theme

    const apply = (mode: 'light' | 'dark') => {
      console.debug('Applying theme mode:', mode)
      changeHtmlThemeMode(mode)
      setMode(mode)
      
      // Force update document body background
      setTimeout(() => {
        const computedStyle = getComputedStyle(document.documentElement)
        const bgColor = computedStyle.getPropertyValue('--mui-palette-background-default')
        if (bgColor) {
          document.body.style.backgroundColor = bgColor
        }
      }, 100)
    }

    const applyFromMediaQuery = () => {
      const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
      if (!mql) {
        apply('light')
        return () => {}
      }

      apply(mql.matches ? 'dark' : 'light')

      const onChange = (e: MediaQueryListEvent) => {
        apply(e.matches ? 'dark' : 'light')
      }

      mql.addEventListener('change', onChange)
      return () => {
        mql.removeEventListener('change', onChange)
      }
    }

    if (isLinux) {
      return applyFromMediaQuery()
    }

    if (isInTauri) {
      const applyFromWindowsRegistry = async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          const mode = (await invoke('get_system_theme_mode')) as
            | 'light'
            | 'dark'
            | null
          if (mode === 'light' || mode === 'dark') {
            apply(mode)
            return
          }
        } catch (error) {
          console.error('Failed to get system theme mode:', error)
        }
        applyFromMediaQuery()
      }

      applyFromWindowsRegistry()
      return
    }

    return applyFromMediaQuery()
  }, [setMode])

  useEffect(() => {
    if (!appWindow || isLinux) {
      return () => {}
    }

    const unlisten = appWindow.onThemeChanged((e) => {
      console.debug('Tauri theme changed:', e.payload)
      if (e.payload === 'dark' || e.payload === 'light') {
        changeHtmlThemeMode(e.payload)
        setMode(e.payload)
      }

      // Update body background when theme changes
      setTimeout(() => {
        const computedStyle = getComputedStyle(document.documentElement)
        const bgColor = computedStyle.getPropertyValue('--mui-palette-background-default')
        if (bgColor) {
          document.body.style.backgroundColor = bgColor
        }
      }, 100)
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [setMode])

  return null
}

const ThemeContext = createContext<{
  themePalette: Theme
  themeCssVars: string
  themeColor: string
  setThemeColor: (color: string) => Promise<void>
} | null>(null)

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

  return (
    <ThemeContext.Provider
      value={{
        themePalette,
        themeCssVars: '',
        themeColor: DEFAULT_COLOR,
        setThemeColor,
      }}
    >
      <CssVarsProvider 
        theme={muiTheme} 
        modeStorageKey="mui-mode-v1"
        defaultMode="system"
      >
        <MUIColorSchemeSync />
        {children}
      </CssVarsProvider>
    </ThemeContext.Provider>
  )
}
