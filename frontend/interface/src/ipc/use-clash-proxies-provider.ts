import { isInTauri } from '@nyanpasu/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useClashAPI, type ClashProviderProxies } from '../service/clash-api'
import {
  CLASH_PROXIES_PROVIDER_QUERY_KEY,
  CLASH_PROXIES_QUERY_KEY,
} from './consts'

const HEALTH_CHECK_POLL_INTERVAL_MS = 750
const HEALTH_CHECK_TIMEOUT_MS = 60_000
// The backend cache is three seconds and stores integer-second timestamps.
const PROXY_SNAPSHOT_MAX_AGE_MS = 4_100

export type ClashProviderHealthSummary = {
  total: number
  checked: number
  available: number
  unavailable: number
  unknown: number
}

export interface ClashProxiesProviderQueryItem extends ClashProviderProxies {
  mutate: () => Promise<void>
  mutateHealthcheck: () => Promise<ClashProviderHealthSummary>
}

export type ClashProxiesProviderQuery = Record<
  string,
  ClashProxiesProviderQueryItem
>

const wait = (duration: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, duration))

const healthVersion = (proxy: ClashProviderProxies['proxies'][number]) => {
  const last = proxy.history[proxy.history.length - 1]
  return `${proxy.alive ?? 'unknown'}|${proxy.history.length}|${last?.time ?? ''}|${last?.delay ?? ''}`
}

const changedHealthCount = (
  before: ClashProviderProxies['proxies'],
  after: ClashProviderProxies['proxies'],
) => {
  const previous = new Map(
    before.map((proxy) => [proxy.name, healthVersion(proxy)]),
  )
  return after.filter(
    (proxy) => previous.get(proxy.name) !== healthVersion(proxy),
  ).length
}

const summarizeHealth = (
  provider: ClashProviderProxies,
): ClashProviderHealthSummary => {
  const checked = provider.proxies.filter(
    (proxy) => proxy.alive !== null || proxy.history.length > 0,
  )
  const available = checked.filter((proxy) => {
    if (proxy.alive !== null) return proxy.alive
    return (proxy.history[proxy.history.length - 1]?.delay ?? 0) > 0
  }).length

  return {
    total: provider.proxies.length,
    checked: checked.length,
    available,
    unavailable: checked.length - available,
    unknown: provider.proxies.length - checked.length,
  }
}

export const useClashProxiesProvider = () => {
  const queryClient = useQueryClient()
  const { providersProxies, putProvidersProxies, healthcheckProvidersProxies } =
    useClashAPI()

  const query = useQuery<ClashProxiesProviderQuery>({
    queryKey: [CLASH_PROXIES_PROVIDER_QUERY_KEY],
    enabled: isInTauri(),
    queryFn: async () => {
      const { providers } = await providersProxies()

      return Object.fromEntries(
        Object.entries(providers).map(([key, value]) => [
          key,
          {
            ...value,
            mutate: async () => {
              await putProvidersProxies(key)
              const result = await query.refetch()
              if (result.isError) throw result.error
            },
            mutateHealthcheck: async () => {
              const baseline = value.proxies
              const startedAt = Date.now()
              await healthcheckProvidersProxies(key)

              let updatedProvider: ClashProviderProxies | undefined
              let updatedCount = 0
              while (Date.now() - startedAt < HEALTH_CHECK_TIMEOUT_MS) {
                await wait(HEALTH_CHECK_POLL_INTERVAL_MS)
                const refreshed = await providersProxies()
                updatedProvider = refreshed.providers[key]
                if (!updatedProvider) {
                  throw new Error(`Proxy provider ${key} disappeared`)
                }
                updatedCount = changedHealthCount(
                  baseline,
                  updatedProvider.proxies,
                )
                if (updatedCount > 0) break
              }

              if (!updatedProvider || updatedCount === 0) {
                throw new Error(
                  `No updated health results received from provider ${key}`,
                )
              }

              const providerRefresh = await query.refetch()
              if (providerRefresh.isError) throw providerRefresh.error

              // ProxiesGuard serves snapshots for three seconds and truncates its
              // timestamp to whole seconds. Wait for a safe boundary so this
              // refetch reaches Mihomo instead of reporting stale health data.
              const remainingSnapshotAge =
                PROXY_SNAPSHOT_MAX_AGE_MS - (Date.now() - startedAt)
              if (remainingSnapshotAge > 0) await wait(remainingSnapshotAge)

              await queryClient.refetchQueries(
                {
                  queryKey: [CLASH_PROXIES_QUERY_KEY],
                  type: 'all',
                },
                { throwOnError: true },
              )

              return summarizeHealth(updatedProvider)
            },
          },
        ]),
      )
    },
  })

  return query
}
