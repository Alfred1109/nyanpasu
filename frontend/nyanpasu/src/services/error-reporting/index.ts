import { IS_IN_TAURI } from '@/utils/tauri'
import { commands } from '@nyanpasu/interface'

type DiagnosticSeverity = 'warn' | 'error'
type DiagnosticSource =
  | 'global_error'
  | 'unhandled_rejection'
  | 'console_warn'
  | 'console_error'
  | 'error_boundary'

interface DiagnosticInput {
  severity: DiagnosticSeverity
  source: DiagnosticSource
  message: string
  stack?: string
  componentStack?: string
  metadata?: Record<string, unknown>
}

interface RecentDiagnostic {
  signature: string
  at: number
}

const MAX_FIELD_LENGTH = 12_000
const MAX_RECENT_DIAGNOSTICS = 20
const DEDUPE_WINDOW_MS = 10_000
const RATE_WINDOW_MS = 30_000
const RATE_LIMIT = 20

let installed = false
let rateWindowStarted = 0
let rateWindowCount = 0
const recent: RecentDiagnostic[] = []

function truncate(value: string | undefined, maximum = MAX_FIELD_LENGTH) {
  if (!value) return undefined
  return value.length <= maximum
    ? value
    : `${value.slice(0, maximum)}…[truncated]`
}

function serializeMetadata(metadata: Record<string, unknown>) {
  try {
    return truncate(JSON.stringify(metadata), 4_000)
  } catch {
    return '[metadata could not be serialized]'
  }
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)
  try {
    return new Error(JSON.stringify(value) ?? String(value))
  } catch {
    return new Error(String(value))
  }
}

function allowDiagnostic(input: DiagnosticInput) {
  const now = Date.now()
  const signature = `${input.severity}\n${input.message}\n${input.stack ?? ''}`
  while (recent.length && now - recent[0].at > DEDUPE_WINDOW_MS) recent.shift()
  if (recent.some((entry) => entry.signature === signature)) return false
  recent.push({ signature, at: now })
  while (recent.length > MAX_RECENT_DIAGNOSTICS) recent.shift()

  if (now - rateWindowStarted >= RATE_WINDOW_MS) {
    rateWindowStarted = now
    rateWindowCount = 0
  }
  if (rateWindowCount >= RATE_LIMIT) return false
  rateWindowCount += 1
  return true
}

export function reportDiagnostic(input: DiagnosticInput) {
  if (!IS_IN_TAURI || !allowDiagnostic(input)) return

  const payload = {
    severity: input.severity,
    source: input.source,
    message: truncate(input.message, 4_000) ?? 'Unknown frontend error',
    stack: truncate(input.stack) ?? null,
    componentStack: truncate(input.componentStack, 6_000) ?? null,
    metadata: input.metadata
      ? (serializeMetadata(input.metadata) ?? null)
      : null,
  }

  commands.reportFrontendDiagnostic(payload).catch(() => {
    // Diagnostics must never replace or recursively report the original error.
  })
}

function reportConsole(
  source: 'console_warn' | 'console_error',
  args: unknown[],
) {
  const error = args.find((value) => value instanceof Error)
  const message = args
    .map((value) => {
      if (typeof value === 'string') return value
      if (value instanceof Error) return value.message
      try {
        return JSON.stringify(value) ?? String(value)
      } catch {
        return String(value)
      }
    })
    .join(' ')

  reportDiagnostic({
    severity: source === 'console_error' ? 'error' : 'warn',
    source,
    message,
    stack: error?.stack,
  })
}

export function installGlobalErrorReporting() {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : undefined
    reportDiagnostic({
      severity: 'error',
      source: 'global_error',
      message: error?.message ?? event.message ?? 'Uncaught browser error',
      stack: error?.stack,
      metadata: {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const error = toError(event.reason)
    reportDiagnostic({
      severity: 'error',
      source: 'unhandled_rejection',
      message: error.message,
      stack: error.stack,
    })
  })

  const originalWarn = console.warn.bind(console)
  const originalError = console.error.bind(console)
  console.warn = (...args: unknown[]) => {
    originalWarn(...args)
    reportConsole('console_warn', args)
  }
  console.error = (...args: unknown[]) => {
    originalError(...args)
    reportConsole('console_error', args)
  }
}

export function reportErrorBoundary(error: unknown, componentStack?: string) {
  const normalized = toError(error)
  reportDiagnostic({
    severity: 'error',
    source: 'error_boundary',
    message: normalized.message,
    stack: normalized.stack,
    componentStack,
  })
}

export function reportReactRootError(
  error: unknown,
  phase: 'caught' | 'uncaught' | 'recoverable',
  componentStack?: string,
) {
  const normalized = toError(error)
  reportDiagnostic({
    severity: phase === 'recoverable' ? 'warn' : 'error',
    source: 'error_boundary',
    message: normalized.message,
    stack: normalized.stack,
    componentStack,
    metadata: { phase },
  })
}
