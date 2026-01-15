import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands, type StatusInfo } from './bindings'

export type ServiceType = 'install' | 'uninstall' | 'start' | 'stop'

/**
 * Custom hook to fetch and manage the system service status using TanStack Query.
 *
 * @returns An object containing the query result for the system service status.
 */
export const useSystemService = () => {
  const queryClient = useQueryClient()
  const isInTauri = typeof window !== 'undefined' && '__TAURI__' in window
  const isBrowser = typeof window !== 'undefined'

  const unwrap = <T, E>(
    res: { status: 'ok'; data: T } | { status: 'error'; error: E },
  ) => {
    if (res.status === 'error') {
      throw res.error
    }
    return res.data
  }

  const query = useQuery<StatusInfo>({
    queryKey: ['system-service'],
    enabled: isInTauri || isBrowser,
    queryFn: async () => {
      if (!isInTauri) {
        const res = await fetch('/__local_api/service/status', {
          cache: 'no-store',
        })
        if (!res.ok) {
          throw new Error(`local api failed: ${res.status}`)
        }
        const data = (await res.json()) as {
          status?: 'running' | 'stopped' | 'not_installed'
          version?: string
        }
        const status = data.status ?? 'not_installed'
        return {
          name: '',
          version: data.version ?? '',
          status: status as any,
          server: null,
        }
      }
      try {
        return unwrap(await commands.serviceStatus())
      } catch (error) {
        const message = String(error)
        const isNotInstalled =
          message.includes('executable not found') ||
          message.toLowerCase().includes('not installed')

        if (isNotInstalled) {
          return {
            name: '',
            version: '',
            status: 'not_installed' as const,
            server: null,
          }
        }

        throw error
      }
    },
    refetchInterval: 5000,
  })

  const upsert = useMutation({
    mutationFn: async (type: ServiceType) => {
      switch (type) {
        case 'install':
          unwrap(await commands.serviceInstall())
          break

        case 'uninstall':
          unwrap(await commands.serviceUninstall())
          break

        case 'start':
          unwrap(await commands.serviceStart())
          break

        case 'stop':
          unwrap(await commands.serviceStop())
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
