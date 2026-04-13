import { isInTauri } from '@nyanpasu/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useClashAPI } from '../service/clash-api'
import { CLASH_CONNECTIONS_QUERY_KEY, MAX_CONNECTIONS_HISTORY } from './consts'

export type ClashConnection = {
  downloadTotal: number
  uploadTotal: number
  memory?: number
  connections?: ClashConnectionItem[]
}

export type ClashConnectionItem = {
  id: string
  metadata: ClashConnectionMetadata
  upload: number
  download: number
  start: string
  chains: string[]
  rule: string
  rulePayload: string
}

export type ClashConnectionMetadata = {
  network: string
  type: string
  host: string
  sourceIP: string
  sourcePort: string
  destinationPort: string
  destinationIP?: string
  destinationIPASN?: string
  process?: string
  processPath?: string
  dnsMode?: string
  dscp?: number
  inboundIP?: string
  inboundName?: string
  inboundPort?: string
  inboundUser?: string
  remoteDestination?: string
  sniffHost?: string
  specialProxy?: string
  specialRules?: string
}

export const useClashConnections = () => {
  const queryClient = useQueryClient()

  const clashApi = useClashAPI()

  const appendSnapshot = (
    history: ClashConnection[],
    snapshot: ClashConnection,
  ): ClashConnection[] => {
    const last = history.at(-1)

    const unchanged =
      last &&
      last.downloadTotal === snapshot.downloadTotal &&
      last.uploadTotal === snapshot.uploadTotal &&
      (last.memory ?? 0) === (snapshot.memory ?? 0) &&
      (last.connections?.length ?? 0) === (snapshot.connections?.length ?? 0)

    if (unchanged) {
      return history
    }

    return [...history, snapshot].slice(-MAX_CONNECTIONS_HISTORY)
  }

  const query = useQuery<ClashConnection[]>({
    queryKey: [CLASH_CONNECTIONS_QUERY_KEY],
    enabled: isInTauri,
    refetchInterval: 2000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const current =
        queryClient.getQueryData<ClashConnection[]>([
          CLASH_CONNECTIONS_QUERY_KEY,
        ]) || []

      const snapshot = await clashApi.connections()

      return appendSnapshot(current, snapshot)
    },
    staleTime: 0,
  })

  const deleteConnections = useMutation({
    mutationFn: async (id?: string) => {
      await clashApi.deleteConnections(id)

      const currentData = queryClient.getQueryData([
        CLASH_CONNECTIONS_QUERY_KEY,
      ]) as ClashConnection[]

      if (id) {
        const lastConnections = currentData.at(-1)?.connections

        if (lastConnections) {
          const filteredConnections = lastConnections.filter(
            (conn) => conn.id !== id,
          )

          const lastData = {
            ...currentData.at(-1)!,
            connections: filteredConnections,
          }

          queryClient.setQueryData(
            [CLASH_CONNECTIONS_QUERY_KEY],
            [...currentData.slice(0, -1), lastData],
          )
        }
      } else {
        const lastData = currentData.at(-1)

        if (lastData) {
          const { downloadTotal, uploadTotal } = lastData

          queryClient.setQueryData(
            [CLASH_CONNECTIONS_QUERY_KEY],
            [
              ...currentData.slice(0, -1),
              {
                downloadTotal,
                uploadTotal,
              },
            ],
          )
        }
      }
    },
  })

  return {
    query,
    deleteConnections,
  }
}
