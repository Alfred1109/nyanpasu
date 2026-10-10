import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useClashAPI } from '../service/clash-api'
import { CLASH_CONFIG_QUERY_KEY } from './consts'
import {
  updateProxyMode,
  type ProxyModeUpdateResult,
} from './proxy-mode-update'
import { useClashConfig } from './use-clash-config'
import { useSetting } from './use-settings'

/** Manage the active proxy mode and report mode changes separately from cleanup. */
export const useProxyMode = () => {
  const clashConfig = useClashConfig()
  const clashCore = useSetting('clash_core')
  const { deleteConnections } = useClashAPI()
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)

  const value = useMemo(() => {
    const modes: Record<'rule' | 'global' | 'direct', boolean> & {
      script?: boolean
    } = {
      rule: false,
      global: false,
      direct: false,
    }

    if (clashCore.value === 'clash') {
      modes.script = false
    }

    // An unavailable config is unknown; do not present it as Rule mode.
    const currentMode = clashConfig.query.data?.mode?.toLowerCase()
    if (
      currentMode &&
      Object.prototype.hasOwnProperty.call(modes, currentMode)
    ) {
      modes[currentMode as keyof typeof modes] = true
    }

    return modes
  }, [clashCore.value, clashConfig.query.data?.mode])

  const upsert = async (mode: string): Promise<ProxyModeUpdateResult> => {
    const currentConfig = clashConfig.query.data
    if (!currentConfig) {
      throw new Error('代理配置尚未加载，无法切换模式。')
    }
    if (clashConfig.query.isError) {
      throw new Error('代理配置读取失败，无法安全切换模式。', {
        cause: clashConfig.query.error,
      })
    }

    if (currentConfig.mode?.toLowerCase() === mode.toLowerCase()) {
      return { changed: false, connectionsCleared: false }
    }

    setIsPending(true)
    try {
      return await updateProxyMode({
        mode,
        currentMode: currentConfig.mode,
        queryError: clashConfig.query.isError ? true : undefined,
        patch: async () => {
          await clashConfig.upsert.mutateAsync({ mode })
          // Reflect the confirmed PATCH immediately so other hook instances
          // cannot issue a duplicate change while the next query is in flight.
          queryClient.setQueryData(
            [CLASH_CONFIG_QUERY_KEY],
            (current: typeof currentConfig | undefined) =>
              current ? { ...current, mode } : current,
          )
        },
        clearConnections: deleteConnections,
      })
    } finally {
      setIsPending(false)
    }
  }

  return {
    value,
    upsert,
    query: clashConfig.query,
    isPending: isPending || clashConfig.upsert.isPending,
  }
}
