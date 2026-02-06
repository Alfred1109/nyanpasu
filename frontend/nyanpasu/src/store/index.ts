import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { SortType } from '@/components/proxies/utils'
import { FileRouteTypes } from '@/route-tree.gen'
import { createNyanpasuJSONStorage } from '@/services/storage'

export const memorizedRoutePathAtom = atomWithStorage<
  FileRouteTypes['fullPaths'] | null
>('memorizedRoutePathAtom', null, undefined, {
  getOnInit: true,
})

export const proxyGroupAtom = atomWithStorage<{
  selector: number | null
}>('proxyGroupAtom', {
  selector: 0,
})

export const proxyGroupSortAtom = atomWithStorage<SortType>(
  'proxyGroupSortAtom',
  SortType.Default,
)

export const atomIsDrawer = atom<boolean>()

export const atomIsDrawerOnlyIcon = atomWithStorage<boolean>(
  'atomIsDrawerOnlyIcon',
  true,
)

export const connectionTableColumnsAtom = atomWithStorage<
  Array<[string, boolean]>
>(
  'connections_table_columns',
  [
    'host',
    'process',
    'downloaded',
    'uploaded',
    'dl_speed',
    'ul_speed',
    'chains',
    'rule',
    'time',
    'source',
    'destination_ip',
    'destination_asn',
    'type',
  ].map((key) => [key, true]),
  createNyanpasuJSONStorage<Array<[string, boolean]>>(),
)
