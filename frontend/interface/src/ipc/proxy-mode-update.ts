let proxyModeUpdateInFlight = false

export interface ProxyModeUpdateResult {
  changed: boolean
  connectionsCleared: boolean
  cleanupError?: Error
}

interface ProxyModeUpdateOptions {
  mode: string
  currentMode?: string
  queryError?: unknown
  patch: () => Promise<unknown>
  clearConnections: () => Promise<unknown>
}

/** Serialize mode changes across hook instances and keep cleanup independent. */
export async function updateProxyMode({
  mode,
  currentMode,
  queryError,
  patch,
  clearConnections,
}: ProxyModeUpdateOptions): Promise<ProxyModeUpdateResult> {
  if (queryError) {
    throw new Error('代理配置读取失败，无法安全切换模式。', {
      cause: queryError,
    })
  }
  if (currentMode === undefined || currentMode === '') {
    throw new Error('代理配置尚未加载有效模式，无法切换。')
  }
  if (proxyModeUpdateInFlight) {
    throw new Error('代理模式正在切换，请稍候。')
  }
  if (currentMode.toLowerCase() === mode.toLowerCase()) {
    return { changed: false, connectionsCleared: false }
  }

  proxyModeUpdateInFlight = true
  try {
    await patch()
    try {
      await clearConnections()
      return { changed: true, connectionsCleared: true }
    } catch (error) {
      return {
        changed: true,
        connectionsCleared: false,
        cleanupError: error instanceof Error ? error : new Error(String(error)),
      }
    }
  } finally {
    proxyModeUpdateInFlight = false
  }
}
