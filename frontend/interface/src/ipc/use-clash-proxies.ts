import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DEFAULT_CLASH_DELAY_URL,
  useClashAPI,
  type ClashDelayOptions,
} from '../service/clash-api'
import { unwrapResult } from '../utils'
import {
  commands,
  ProxyItemHistory,
  type Proxies,
  type ProxyGroupItem,
  type ProxyItem,
} from './bindings'
import { CLASH_PROXIES_QUERY_KEY } from './consts'
import { useSetting } from './use-settings'

const DEFAULT_PROXY_TEST_TIMEOUT_MS = 5000

type ProxyGroupMetadata = {
  testUrl?: string | null
  expectedStatus?: string | null
  fixed?: string | null
  extra?: Record<string, unknown> | null
}

type ProxyGroupWithMetadata = ProxyGroupItem & ProxyGroupMetadata

const currentFixed = (group: ProxyGroupWithMetadata) =>
  typeof group.fixed === 'string' && group.fixed.length > 0

export type ClashProxiesQueryHelperFn = {
  mutateDelay: (options?: ClashDelayOptions) => Promise<void>
}

export interface ClashProxiesQueryProxyItem
  extends ProxyItem, ClashProxiesQueryHelperFn {
  mutateSelect: () => Promise<void>
}

export interface ClashProxiesQueryGroupItem
  extends ProxyGroupWithMetadata, ClashProxiesQueryHelperFn {
  all: ClashProxiesQueryProxyItem[]
  canSelect: boolean
  canClearFixed: boolean
  mutateClearFixed: () => Promise<void>
}

export interface ClashProxiesQuery extends Proxies {
  global: ClashProxiesQueryGroupItem
  groups: ClashProxiesQueryGroupItem[]
}

// Create a new proxy item with updated history
const createUpdatedProxy = (
  proxy: ClashProxiesQueryProxyItem,
  { name, delay }: { name: string; delay: number },
) => {
  if (proxy.name !== name) return proxy

  const newHistory = [
    ...proxy.history,
    { time: new Date().toISOString(), delay },
  ] satisfies ProxyItemHistory[]

  return { ...proxy, history: newHistory }
}

export const useClashProxies = () => {
  const queryClient = useQueryClient()

  const { proxiesDelay, groupDelay } = useClashAPI()
  const { value: defaultLatencyTest } = useSetting('default_latency_test')

  const resolveOptions = (
    options?: ClashDelayOptions,
    group?: ProxyGroupMetadata,
  ): ClashDelayOptions => ({
    url:
      options?.url?.trim() ||
      group?.testUrl?.trim() ||
      defaultLatencyTest?.trim() ||
      DEFAULT_CLASH_DELAY_URL,
    timeout: options?.timeout ?? DEFAULT_PROXY_TEST_TIMEOUT_MS,
    expectedStatus:
      options?.expectedStatus?.trim() ||
      group?.expectedStatus?.trim() ||
      undefined,
  })

  const proxies = useQuery<ClashProxiesQuery | undefined>({
    queryKey: [CLASH_PROXIES_QUERY_KEY],
    queryFn: async () => {
      const result = unwrapResult(await commands.getProxies())

      if (!result) {
        return
      }

      // Create helper functions to reduce code duplication
      const createProxyWithHelpers = (
        proxy: ProxyItem,
        groupName: string,
        parentGroup?: ProxyGroupMetadata,
        canSelect = false,
      ): ClashProxiesQueryProxyItem => ({
        ...proxy,
        mutateDelay: async (options?: ClashDelayOptions) => {
          const result = await updateProxiesDelay.mutateAsync([
            proxy.name,
            resolveOptions(options, parentGroup),
          ])
          if (!Number.isFinite(result.delay) || result.delay <= 0) {
            throw new Error(`Latency test failed for ${proxy.name}`)
          }
        },
        mutateSelect: async () => {
          if (!canSelect) {
            throw new Error(
              `Proxy group ${groupName} does not support selection`,
            )
          }
          unwrapResult(await commands.selectProxy(groupName, proxy.name))
          await proxies.refetch()
        },
      })

      const createGroupWithHelpers = (
        source: ProxyGroupItem,
      ): ClashProxiesQueryGroupItem => ({
        ...(source as ProxyGroupWithMetadata),
        canSelect:
          source.type === 'Selector' ||
          ((source.type === 'URLTest' || source.type === 'Fallback') &&
            typeof (source as ProxyGroupWithMetadata).fixed === 'string'),
        canClearFixed:
          (source.type === 'URLTest' || source.type === 'Fallback') &&
          Boolean((source as ProxyGroupWithMetadata).fixed),
        mutateDelay: async (options?: ClashDelayOptions) => {
          const latencyOptions = resolveOptions(
            options,
            source as ProxyGroupWithMetadata,
          )
          if (
            (source.type === 'URLTest' || source.type === 'Fallback') &&
            currentFixed(source as ProxyGroupWithMetadata)
          ) {
            const failures: string[] = []
            for (let start = 0; start < source.all.length; start += 8) {
              const batch = source.all.slice(start, start + 8)
              await Promise.all(
                batch.map(async (proxy) => {
                  try {
                    const result = await updateProxiesDelay.mutateAsync([
                      proxy.name,
                      latencyOptions,
                    ])
                    if (!Number.isFinite(result.delay) || result.delay <= 0) {
                      failures.push(proxy.name)
                    }
                  } catch {
                    failures.push(proxy.name)
                    markDelayFailure(proxy.name)
                  }
                }),
              )
            }
            if (failures.length) {
              throw new Error(
                `Latency test failed for ${failures.length} of ${source.all.length} members`,
              )
            }
            return
          }

          const results = await updateGroupDelay.mutateAsync([
            source.name,
            latencyOptions,
          ])
          const failed = source.all.filter((proxy) => {
            const delay = results[proxy.name]
            return !Number.isFinite(delay) || delay <= 0
          })
          if (failed.length) {
            throw new Error(
              `Latency test failed for ${failed.length} of ${source.all.length} members`,
            )
          }
        },
        mutateClearFixed: async () => {
          if (source.type !== 'URLTest' && source.type !== 'Fallback') {
            throw new Error(
              `Group ${source.name} cannot clear a fixed selection`,
            )
          }
          if (!currentFixed(source as ProxyGroupWithMetadata)) {
            return
          }
          unwrapResult(await commands.clearProxyFixed(source.name))
          await proxies.refetch()
        },
        all: source.all.map((proxy) =>
          createProxyWithHelpers(
            proxy,
            source.name,
            source as ProxyGroupWithMetadata,
            source.type === 'Selector' ||
              ((source.type === 'URLTest' || source.type === 'Fallback') &&
                typeof (source as ProxyGroupWithMetadata).fixed === 'string'),
          ),
        ),
      })

      // Apply helper functions to groups and global
      const groups = result.groups
        .filter((g) => !g.hidden)
        .map(createGroupWithHelpers)
      const global = createGroupWithHelpers(result.global)

      // merge the results & type validation
      const merged = {
        ...result,
        groups,
        global,
      } satisfies ClashProxiesQuery

      return merged
    },
  })

  const getQueryData = () => {
    return queryClient.getQueryData([CLASH_PROXIES_QUERY_KEY]) as
      | ClashProxiesQuery
      | undefined
  }

  const setQueryData = (data: ClashProxiesQuery) => {
    queryClient.setQueryData([CLASH_PROXIES_QUERY_KEY], data)
  }

  const markDelayFailure = (name: string) => {
    const oldData = getQueryData()
    if (!oldData) return
    setQueryData({
      ...oldData,
      global: {
        ...oldData.global,
        all: oldData.global.all.map((proxy) =>
          createUpdatedProxy(proxy, { name, delay: 0 }),
        ),
      },
      groups: oldData.groups.map((group) => ({
        ...group,
        all: group.all.map((proxy) =>
          createUpdatedProxy(proxy, { name, delay: 0 }),
        ),
      })),
    })
  }

  const updateProxiesDelay = useMutation({
    mutationFn: async (args: Parameters<typeof proxiesDelay>) => {
      return {
        name: args[0],
        delay: (await proxiesDelay(...args)).delay,
      }
    },
    onSuccess: ({ name, delay }) => {
      const oldData = getQueryData()

      if (!oldData) {
        return
      }

      // Create new data structure with updated proxies
      const newData = {
        ...oldData,
        global: {
          ...oldData.global,
          all: oldData.global.all.map((proxy) =>
            createUpdatedProxy(proxy, { name, delay }),
          ),
        },
        groups: oldData.groups.map((group) => ({
          ...group,
          all: group.all.map((proxy) =>
            createUpdatedProxy(proxy, { name, delay }),
          ),
        })),
      } satisfies ClashProxiesQuery

      setQueryData(newData)
    },
  })

  const updateGroupDelay = useMutation({
    mutationFn: async (args: Parameters<typeof groupDelay>) => {
      return await groupDelay(...args)
    },
    onSuccess: (data) => {
      const oldData = getQueryData()

      if (!oldData) {
        return
      }

      // Create new data structure with updated proxies
      const newData = {
        ...oldData,
        global: {
          ...oldData.global,
          all: oldData.global.all.map((proxy) =>
            Object.prototype.hasOwnProperty.call(data, proxy.name)
              ? createUpdatedProxy(proxy, {
                  name: proxy.name,
                  delay: data[proxy.name] ?? 0,
                })
              : createUpdatedProxy(proxy, { name: proxy.name, delay: 0 }),
          ),
        },
        groups: oldData.groups.map((group) => ({
          ...group,
          all: group.all.map((proxy) =>
            Object.prototype.hasOwnProperty.call(data, proxy.name)
              ? createUpdatedProxy(proxy, {
                  name: proxy.name,
                  delay: data[proxy.name] ?? 0,
                })
              : createUpdatedProxy(proxy, { name: proxy.name, delay: 0 }),
          ),
        })),
      } satisfies ClashProxiesQuery

      setQueryData(newData)
    },
  })

  return {
    ...proxies,
  }
}
