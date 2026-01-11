// Result utilities consolidated from interface package

/**
 * Result unwrapping utility
 * From frontend/interface/src/utils/index.ts
 */
export function unwrapResult<T, E>(res: { status: 'ok' | 'error'; data?: T; error?: E }) {
  if (res.status === 'error') {
    throw res.error
  }
  return res.status === 'ok' ? res.data : undefined
}
