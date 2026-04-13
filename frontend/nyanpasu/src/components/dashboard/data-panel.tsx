import { useAtomValue } from 'jotai'
import { isObject } from 'lodash-es'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Dataline, { DatalineProps } from '@/components/dashboard/dataline'
import { atomIsDrawer } from '@/store'
import {
  ArrowDownward,
  ArrowUpward,
  MemoryOutlined,
  SettingsEthernet,
} from '@mui/icons-material'
import Grid from '@mui/material/Grid'
import {
  getCoreStatus,
  MAX_CONNECTIONS_HISTORY,
  MAX_MEMORY_HISTORY,
  MAX_TRAFFIC_HISTORY,
  useClashConnections,
  useClashMemory,
  useClashTraffic,
  useSetting,
} from '@nyanpasu/interface'
import { useQuery } from '@tanstack/react-query'

const DataPanel = ({ visible = true }: { visible?: boolean }) => {
  const { t } = useTranslation()

  const { data: clashTraffic } = useClashTraffic()

  const { data: clashMemory } = useClashMemory()

  const {
    query: { data: clashConnections },
  } = useClashConnections()
  const coreStatusQuery = useQuery({
    queryKey: ['/coreStatus'],
    queryFn: getCoreStatus,
    refetchInterval: 2000,
    refetchOnWindowFocus: false,
  })

  const { value } = useSetting('clash_core')

  const supportMemory = value && ['mihomo', 'mihomo-alpha'].includes(value)
  const coreState = coreStatusQuery.data?.[0]
  const coreUnavailable =
    !coreState ||
    (isObject(coreState) &&
      Object.prototype.hasOwnProperty.call(coreState, 'Stopped'))

  const padData = (data: (number | undefined)[] = [], max: number) =>
    Array(Math.max(0, max - data.length))
      .fill(0)
      .concat(data.slice(-max))

  const derivedTraffic = useMemo(() => {
    return (
      clashConnections?.map((item, index, all) => {
        const previous = all[index - 1]
        return {
          down: previous
            ? Math.max(0, item.downloadTotal - previous.downloadTotal)
            : 0,
          up: previous
            ? Math.max(0, item.uploadTotal - previous.uploadTotal)
            : 0,
        }
      }) ?? []
    )
  }, [clashConnections])

  const trafficSamples =
    clashTraffic && clashTraffic.length > 0 ? clashTraffic : derivedTraffic

  const Datalines: (DatalineProps & { visible?: boolean })[] = [
    {
      data: padData(
        trafficSamples.map((item) => item.down),
        MAX_TRAFFIC_HISTORY,
      ),
      icon: ArrowDownward,
      title: t('Download Traffic'),
      total: clashConnections?.at(-1)?.downloadTotal,
      type: 'speed',
      visible,
      unavailable: coreUnavailable,
    },
    {
      data: padData(
        trafficSamples.map((item) => item.up),
        MAX_TRAFFIC_HISTORY,
      ),
      icon: ArrowUpward,
      title: t('Upload Traffic'),
      total: clashConnections?.at(-1)?.uploadTotal,
      type: 'speed',
      visible,
      unavailable: coreUnavailable,
    },
    {
      data: padData(
        clashConnections?.map((item) => item.connections?.length ?? 0),
        MAX_CONNECTIONS_HISTORY,
      ),
      icon: SettingsEthernet,
      title: t('Active Connections'),
      type: 'raw',
      visible,
      unavailable: coreUnavailable,
    },
  ]

  if (supportMemory) {
    Datalines.splice(2, 0, {
      data: padData(
        clashMemory?.map((item) => item.inuse),
        MAX_MEMORY_HISTORY,
      ),
      icon: MemoryOutlined,
      title: t('Memory'),
      visible,
      unavailable: coreUnavailable,
    })
  }

  const isDrawer = useAtomValue(atomIsDrawer)

  const gridLayout = useMemo(
    () => ({
      sm: isDrawer ? 6 : 12,
      md: 6,
      lg: supportMemory ? 3 : 4,
      xl: supportMemory ? 3 : 4,
    }),
    [isDrawer, supportMemory],
  )

  return Datalines.map((props, index) => {
    return (
      <Grid key={`data-${index}`} size={gridLayout}>
        <Dataline {...props} className="max-h-1/8 min-h-40" />
      </Grid>
    )
  })
}

export default DataPanel
