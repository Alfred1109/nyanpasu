import { useWebSocket } from 'ahooks'
import { useCallback, useMemo } from 'react'
import { useClashInfo } from './use-clash-info'

export const useClashWebSocket = () => {
  const { data: info } = useClashInfo()

  const server = useMemo(() => {
    const s = info?.server
    if (!s) return ''
    if (s.startsWith(':')) return `127.0.0.1${s}`
    if (/^\d+$/.test(s)) return `127.0.0.1:${s}`
    return s
  }, [info?.server])

  const wsBaseUrl = useMemo(() => (server ? `ws://${server}` : ''), [server])

  const tokenParams = useMemo(
    // must have token=, otherwise clash will return 403
    () => `token=${encodeURIComponent(info?.secret || '')}`,
    [info?.secret],
  )

  const resolveUrl = useCallback(
    (path: string) => {
      if (!wsBaseUrl) return ''
      return `${wsBaseUrl}/${path}?${tokenParams}`
    },
    [wsBaseUrl, tokenParams],
  )

  const urls = useMemo(() => {
    if (info && wsBaseUrl) {
      return {
        connections: resolveUrl('connections'),
        logs: resolveUrl('logs'),
        traffic: resolveUrl('traffic'),
        memory: resolveUrl('memory'),
      }
    }
  }, [info, resolveUrl, wsBaseUrl])

  const connectionsUrl = urls?.connections ?? ''
  const logsUrl = urls?.logs ?? ''
  const trafficUrl = urls?.traffic ?? ''
  const memoryUrl = urls?.memory ?? ''

  const connectionsWS = useWebSocket(connectionsUrl, {
    manual: !connectionsUrl,
  })

  const logsWS = useWebSocket(logsUrl, {
    manual: !logsUrl,
  })

  const trafficWS = useWebSocket(trafficUrl, {
    manual: !trafficUrl,
  })

  const memoryWS = useWebSocket(memoryUrl, {
    manual: !memoryUrl,
  })

  return {
    connectionsWS,
    logsWS,
    trafficWS,
    memoryWS,
  }
}
