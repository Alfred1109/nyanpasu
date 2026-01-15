import { getIpsbASN } from '@/service'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'

const isInTauri = typeof window !== 'undefined' && '__TAURI__' in window

export interface IPSBResponse {
  organization: string
  longitude: number
  timezone: string
  isp: string
  offset: number
  asn: number
  asn_organization: string
  country: string
  ip: string
  latitude: number
  continent_code: string
  country_code: string
}

export const useIPSB = (
  config?: Partial<UseQueryOptions<IPSBResponse | null>>,
) => {
  return useQuery<IPSBResponse | null>({
    queryKey: ['https://api.ip.sb/geoip'],
    enabled: isInTauri,
    queryFn: () => getIpsbASN(),
    ...config,
  })
}
