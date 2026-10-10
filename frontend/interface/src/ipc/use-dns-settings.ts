import { isInTauri } from '@nyanpasu/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrapResult } from '../utils'
import { commands, type JsonValue } from './bindings'

export const DNS_SETTINGS_QUERY_KEY = 'dns-settings'
export type DnsConfig = Partial<Record<string, JsonValue>>

const asDnsConfig = (value: JsonValue): DnsConfig | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null

export const useDnsSettings = () => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: [DNS_SETTINGS_QUERY_KEY],
    enabled: isInTauri(),
    refetchInterval: 10_000,
    queryFn: async () => {
      const data = unwrapResult(await commands.getDnsSettings())
      if (!data) throw new Error('DNS 设置读取结果为空')
      return {
        ...data,
        overrides: asDnsConfig(data.overrides),
        effective: asDnsConfig(data.effective),
      }
    },
  })

  const upsert = useMutation({
    mutationFn: async (payload: DnsConfig | null) => {
      const data = unwrapResult(await commands.setDnsSettings(payload))
      if (!data) throw new Error('DNS 设置保存结果为空')
      return data
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [DNS_SETTINGS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: ['runtime-profile'] }),
      ])
    },
  })

  return { query, upsert }
}
