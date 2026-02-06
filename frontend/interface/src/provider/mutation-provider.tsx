import { useMount } from 'ahooks'
import { PropsWithChildren, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  CLASH_CONFIG_QUERY_KEY,
  CLASH_INFO_QUERY_KEY,
  CLASH_PROXIES_PROVIDER_QUERY_KEY,
  CLASH_PROXIES_QUERY_KEY,
  CLASH_RULES_PROVIDER_QUERY_KEY,
  CLASH_RULES_QUERY_KEY,
  CLASH_VERSION_QUERY_KEY,
  NYANPASU_BACKEND_EVENT_NAME,
  NYANPASU_SETTING_QUERY_KEY,
  NYANPASU_SYSTEM_PROXY_QUERY_KEY,
  PROFILES_QUERY_KEY,
} from '../ipc/consts'
import { isInTauri } from '@nyanpasu/utils'

type EventPayload = 'nyanpasu_config' | 'clash_config' | 'proxies' | 'profiles'

const NYANPASU_CONFIG_MUTATION_KEYS = [
  NYANPASU_SETTING_QUERY_KEY,
  NYANPASU_SYSTEM_PROXY_QUERY_KEY,
  CLASH_PROXIES_QUERY_KEY, // proxies hook refetch
  PROFILES_QUERY_KEY, // profiles hook refetch
] as const

const CLASH_CONFIG_MUTATION_KEYS = [
  CLASH_VERSION_QUERY_KEY,
  CLASH_INFO_QUERY_KEY,
  CLASH_CONFIG_QUERY_KEY,
  PROFILES_QUERY_KEY,
  CLASH_RULES_QUERY_KEY, // clash rules hook refetch
  CLASH_RULES_PROVIDER_QUERY_KEY, // clash rules providers hook refetch
  CLASH_PROXIES_QUERY_KEY, // proxies hook refetch
  CLASH_PROXIES_PROVIDER_QUERY_KEY, // proxies providers hook refetch
] as const

const PROFILES_MUTATION_KEYS = [
  CLASH_VERSION_QUERY_KEY,
  CLASH_INFO_QUERY_KEY,
  CLASH_RULES_QUERY_KEY, // clash rules hook refetch
  CLASH_RULES_PROVIDER_QUERY_KEY, // clash rules providers hook refetch
  CLASH_PROXIES_QUERY_KEY, // proxies hook refetch
  CLASH_PROXIES_PROVIDER_QUERY_KEY, // proxies providers hook refetch
  PROFILES_QUERY_KEY, // profiles hook refetch
] as const

const PROXIES_MUTATION_KEYS = [
  CLASH_PROXIES_QUERY_KEY, // getProxies hook refetch
  CLASH_PROXIES_PROVIDER_QUERY_KEY, // getProxiesProviders hook refetch
] as const

export const MutationProvider = ({ children }: PropsWithChildren) => {
  const unlistenFn = useRef<UnlistenFn>(null)

  const queryClient = useQueryClient()

  const refetchQueries = (keys: readonly string[]) => {
    Promise.all(
      keys.map((key) =>
        queryClient.refetchQueries({
          queryKey: [key],
        }),
      ),
    ).catch((e) => console.error(e))
  }

  useMount(() => {
    if (!isInTauri) {
      return
    }

    listen<EventPayload>(NYANPASU_BACKEND_EVENT_NAME, ({ payload }) => {
      console.debug('MutationProvider received event:', payload)

      switch (payload) {
        case 'nyanpasu_config':
          refetchQueries(NYANPASU_CONFIG_MUTATION_KEYS)
          break
        case 'clash_config':
          refetchQueries(CLASH_CONFIG_MUTATION_KEYS)
          break
        case 'profiles':
          refetchQueries(PROFILES_MUTATION_KEYS)
          break
        case 'proxies':
          refetchQueries(PROXIES_MUTATION_KEYS)
          break
      }
    })
      .then((unlisten) => {
        unlistenFn.current = unlisten
      })
      .catch((e) => {
        console.error(e)
      })
  })

  return children
}
