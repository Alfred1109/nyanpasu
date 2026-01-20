export const IS_IN_TAURI =
  typeof window !== 'undefined' &&
  ((('__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>)) ||
    ('__TAURI__' in (window as unknown as Record<string, unknown>))) ||
    window.location?.protocol === 'tauri:')

function isInTauri() {
  return IS_IN_TAURI
}
