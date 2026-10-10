import { useMount } from 'ahooks'
import dayjs from 'dayjs'
import { useNyanpasuStorageSubscribers } from '@/hooks/use-store'
import { Button, CssBaseline } from '@mui/material'
import { StyledEngineProvider, useColorScheme } from '@mui/material/styles'
import { cn } from '@nyanpasu/ui'
import {
  createRootRoute,
  ErrorComponentProps,
  Outlet,
} from '@tanstack/react-router'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import 'dayjs/locale/ru'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/zh-tw'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import { lazy, useEffect, useState } from 'react'
import { BlockTaskProvider } from '@/components/providers/block-task-provider'
import { LanguageProvider } from '@/components/providers/language-provider'
import { ExperimentalThemeProvider } from '@/components/providers/theme-provider'
import { reportErrorBoundary } from '@/services/error-reporting'
import { formatErrorDetails } from '@/utils'
import { IS_IN_TAURI } from '@/utils/tauri'
import { NyanpasuProvider } from '@nyanpasu/interface'
import styles from './-__root.module.scss'

dayjs.extend(relativeTime)
dayjs.extend(customParseFormat)

const Catch = ({ error }: ErrorComponentProps) => {
  const { mode } = useColorScheme()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    reportErrorBoundary(error)
  }, [error])

  const copyDetails = async () => {
    const details = formatErrorDetails(error)
    try {
      await navigator.clipboard.writeText(details)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = details
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      const copiedToClipboard = document.execCommand('copy')
      textArea.remove()
      if (!copiedToClipboard) return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className={cn(styles.oops, mode === 'dark' && styles.dark)}>
      <h1>Oops!</h1>
      <p>Something went wrong... Caught at _root error boundary.</p>
      <pre>{formatErrorDetails(error)}</pre>
      <Button variant="outlined" onClick={copyDetails}>
        {copied ? 'Copied' : 'Copy error details'}
      </Button>
    </div>
  )
}

const Pending = () => <div>Loading from _root...</div>

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null // Render nothing in production
  : lazy(() =>
      // Lazy load in development
      import('@tanstack/react-router-devtools').then((res) => ({
        default: res.TanStackRouterDevtools,
        // For Embedded Mode
        // default: res.TanStackRouterDevtoolsPanel
      })),
    )

export const Route = createRootRoute({
  component: App,
  errorComponent: Catch,
  pendingComponent: Pending,
})

function App() {
  useNyanpasuStorageSubscribers()

  useMount(() => {
    if (!IS_IN_TAURI) {
      return
    }

    const appWindow = getCurrentWebviewWindow()
    Promise.all([
      appWindow.show(),
      appWindow.unminimize(),
      appWindow.setFocus(),
    ]).finally(() => emit('react_app_mounted'))
  })

  return (
    <NyanpasuProvider>
      <BlockTaskProvider>
        <LanguageProvider>
          <ExperimentalThemeProvider>
            <StyledEngineProvider injectFirst>
              <CssBaseline />
              <Outlet />
            </StyledEngineProvider>
          </ExperimentalThemeProvider>

          <TanStackRouterDevtools />
        </LanguageProvider>
      </BlockTaskProvider>
    </NyanpasuProvider>
  )
}
