import { useUpdateEffect } from 'ahooks'
import { useQuery } from '@tanstack/react-query'
import { unwrapResult } from '../utils'
import { commands } from './bindings'
import { NYANPASU_SYSTEM_PROXY_QUERY_KEY } from './consts'
import { useSetting } from './use-settings'

import { isInTauri } from '@nyanpasu/utils'

/**
 * Custom hook to fetch and manage the system proxy settings.
 *
 * This hook leverages the `useQuery` hook to perform an asynchronous request
 * to obtain system proxy data via `commands.getSysProxy()`. The result of the query
 * is processed with `unwrapResult` to extract the proxy information.
 *
 * @returns An object containing the query results and helper properties/methods
 *          (e.g., loading status, error, and refetch function) provided by `useQuery`.
 */
export const useSystemProxy = () => {
  const query = useQuery({
    queryKey: [NYANPASU_SYSTEM_PROXY_QUERY_KEY],
    enabled: isInTauri(),
    queryFn: async () => {
      return unwrapResult(await commands.getSysProxy())
    },
    refetchInterval: isInTauri() ? 5000 : false,
    refetchIntervalInBackground: true,
  })

  const { value } = useSetting('enable_system_proxy')

  useUpdateEffect(() => {
    query.refetch()
  }, [value])

  return {
    ...query,
  }
}
