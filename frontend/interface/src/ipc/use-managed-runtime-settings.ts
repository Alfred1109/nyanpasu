import { isInTauri } from '@nyanpasu/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrapResult } from '../utils'
import { commands, type ManagedRuntimeFields } from './bindings'

export const MANAGED_RUNTIME_SETTINGS_QUERY_KEY = 'managed-runtime-settings'

export const useManagedRuntimeSettings = () => {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: [MANAGED_RUNTIME_SETTINGS_QUERY_KEY],
    enabled: isInTauri(),
    refetchInterval: 10_000,
    queryFn: async () =>
      unwrapResult(await commands.getManagedRuntimeSettings()),
  })
  const upsert = useMutation({
    mutationFn: async (payload: ManagedRuntimeFields) =>
      unwrapResult(await commands.setManagedRuntimeSettings(payload)),
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: [MANAGED_RUNTIME_SETTINGS_QUERY_KEY],
        }),
        client.invalidateQueries({ queryKey: ['runtime-profile'] }),
      ])
    },
  })
  return { query, upsert }
}
