import { useQuery } from '@tanstack/react-query'
import { useClashAPI } from '../service/clash-api'
import { CLASH_RULES_QUERY_KEY } from './consts'

const isInTauri = typeof window !== 'undefined' && '__TAURI__' in window

export const useClashRules = () => {
  const { rules } = useClashAPI()

  const query = useQuery({
    queryKey: [CLASH_RULES_QUERY_KEY],
    enabled: isInTauri,
    queryFn: async () => {
      return await rules()
    },
  })

  return {
    ...query,
  }
}
