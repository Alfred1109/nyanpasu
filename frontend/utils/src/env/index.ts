/**
 * 检测当前是否在Tauri环境中运行
 */
export const isInTauri = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  const win = window as unknown as Record<string, unknown>
  return (
    '__TAURI__' in win ||
    '__TAURI_INTERNALS__' in win ||
    window.location?.protocol === 'tauri:'
  )
}
