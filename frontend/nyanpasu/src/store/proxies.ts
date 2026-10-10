import { atomWithStorage } from 'jotai/utils'

export const proxiesFilterAtom = atomWithStorage<string | null>(
  'proxiesFilterAtom',
  null,
)

/** Proxy groups the user keeps at the top of the list. Names are stable across reordering. */
export const pinnedProxyGroupsAtom = atomWithStorage<string[]>(
  'pinnedProxyGroupsAtom',
  [],
)

export const DEFAULT_PROXY_TEST_TIMEOUT_MS = 5000
export const MIN_PROXY_TEST_TIMEOUT_MS = 1000
export const MAX_PROXY_TEST_TIMEOUT_MS = 30000

export const proxyTestTimeoutAtom = atomWithStorage<number>(
  'proxyTestTimeoutAtom',
  DEFAULT_PROXY_TEST_TIMEOUT_MS,
)

export const normalizeProxyTestTimeout = (timeout: number) => {
  if (!Number.isFinite(timeout)) return DEFAULT_PROXY_TEST_TIMEOUT_MS
  return Math.min(
    MAX_PROXY_TEST_TIMEOUT_MS,
    Math.max(MIN_PROXY_TEST_TIMEOUT_MS, Math.round(timeout / 1000) * 1000),
  )
}
