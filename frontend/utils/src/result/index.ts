/**
 * Result unwrapping utility
 */
export interface IpcErrorPayload {
  code?: unknown
  message?: unknown
  details?: unknown
}

export class IpcResultError extends Error {
  readonly code?: string
  readonly details?: string
  readonly cause: unknown

  constructor(payload: IpcErrorPayload) {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : 'IPC command failed'
    super(message)
    this.name = 'IpcResultError'
    this.code = typeof payload.code === 'string' ? payload.code : undefined
    this.details =
      typeof payload.details === 'string' ? payload.details : undefined
    this.cause = payload
  }
}

function safeStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}

export function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error

  if (error && typeof error === 'object') {
    const payload = error as IpcErrorPayload
    if (typeof payload.message === 'string') {
      return new IpcResultError(payload)
    }
  }

  const message =
    typeof error === 'string' ? error : (safeStringify(error) ?? String(error))
  const normalized = new Error(message)
  Object.defineProperty(normalized, 'cause', {
    configurable: true,
    value: error,
  })
  return normalized
}

export function unwrapResult<T, E>(res: {
  status: 'ok' | 'error'
  data?: T
  error?: E
}) {
  if (res.status === 'error') {
    throw normalizeError(res.error)
  }
  return res.status === 'ok' ? res.data : undefined
}
