import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CLASH_TRAFFIC_QUERY_KEY } from './consts'

export type ClashTraffic = {
  up: number
  down: number
}

export const useClashTraffic = () => {
  const queryClient = useQueryClient()

  const query = useQuery<ClashTraffic[]>({
    queryKey: [CLASH_TRAFFIC_QUERY_KEY],
    queryFn: () => {
      return (
        queryClient.getQueryData<ClashTraffic[]>([CLASH_TRAFFIC_QUERY_KEY]) ||
        []
      )
    },
  })

  return query
}
