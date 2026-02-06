/**
 * 检测当前是否在Tauri环境中运行
 */
export const isInTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window
}
