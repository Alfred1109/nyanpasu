import { isAppImage } from '@nyanpasu/interface'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'

export const useIsAppImage = (config?: Partial<UseQueryOptions<boolean>>) => {
  return useQuery<boolean>({
    queryKey: ['/api/is_appimage'],
    queryFn: async () => (await isAppImage()) ?? false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    ...config,
  })
}
