import { unwrapResult } from '@/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from './bindings'

export type ServiceType = 'install' | 'uninstall' | 'start' | 'stop'

/**
 * Custom hook to fetch and manage the system service status using TanStack Query.
 *
 * @returns An object containing the query result for the system service status.
 */
export const useSystemService = () => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['system-service'],
    queryFn: async () => {
      try {
        return unwrapResult(await commands.statusService())
      } catch (error) {
        // 如果查询失败（通常是服务未安装），返回默认状态
        return {
          name: '',
          version: '',
          status: 'not_installed' as const,
          server: null,
        }
      }
    },
  })

  const upsert = useMutation({
    mutationFn: async (type: ServiceType) => {
      switch (type) {
        case 'install':
          await commands.installService()
          break

        case 'uninstall':
          await commands.uninstallService()
          break

        case 'start':
          await commands.startService()
          break

        case 'stop':
          await commands.stopService()
          break
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-service'] })
    },
  })

  return {
    query,
    upsert,
  }
}
