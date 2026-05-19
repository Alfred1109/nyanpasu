import { useAtom, useAtomValue } from 'jotai'
import { memo, RefObject, useDeferredValue, useMemo } from 'react'
import { Virtualizer } from 'virtua'
import { proxyGroupAtom } from '@/store'
import { proxiesFilterAtom } from '@/store/proxies'
import {
  ListItem,
  ListItemButton,
  ListItemButtonProps,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import { getServerPort, useClashProxies } from '@nyanpasu/interface'
import { alpha, LazyImage } from '@nyanpasu/ui'
import { useQuery } from '@tanstack/react-query'

const IconRender = memo(function IconRender({ icon }: { icon: string }) {
  const {
    data: serverPort,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/getServerPort'],
    queryFn: getServerPort,
  })
  const src = icon.trim().startsWith('<svg')
    ? `data:image/svg+xml;base64,${btoa(icon)}`
    : icon
  const cachedUrl = useMemo(() => {
    if (!src.startsWith('http')) {
      return src
    }
    return `http://localhost:${serverPort}/cache/icon?url=${btoa(src)}`
  }, [src, serverPort])
  if (isLoading || error) {
    return null
  }
  return (
    <ListItemIcon>
      <LazyImage
        className="h-11 w-11"
        loadingClassName="rounded-full"
        src={cachedUrl}
      />
    </ListItemIcon>
  )
})

interface GroupListProps extends ListItemButtonProps {
  scrollRef: RefObject<HTMLElement>
}

export const GroupList = ({
  scrollRef,
  ...listItemButtonProps
}: GroupListProps) => {
  const { data } = useClashProxies()

  const [proxyGroup, setProxyGroup] = useAtom(proxyGroupAtom)
  const proxiesFilter = useAtomValue(proxiesFilterAtom)
  const deferredProxiesFilter = useDeferredValue(proxiesFilter)

  const handleSelect = (index: number) => {
    setProxyGroup({ selector: index })
  }

  const groups = useMemo(() => {
    if (!data?.groups) {
      return []
    }

    return data.groups.filter((group) => {
      return (
        !deferredProxiesFilter ||
        group.name
          .toLowerCase()
          .includes(deferredProxiesFilter.toLowerCase()) ||
        group.all?.some((proxy) => {
          return proxy.name
            .toLowerCase()
            .includes(deferredProxiesFilter.toLowerCase())
        }) ||
        false
      )
    })
  }, [data?.groups, deferredProxiesFilter])

  return (
    <Virtualizer scrollRef={scrollRef}>
      {groups.map((group, index) => {
        const selected = index === proxyGroup.selector

        return (
          <ListItem key={index} disablePadding>
            <ListItemButton
              selected={selected}
              onClick={() => handleSelect(index)}
              sx={[
                (theme) => ({
                  borderRadius: 3,
                  backgroundColor: selected
                    ? `${alpha(theme.palette.primary.main, 0.14)} !important`
                    : null,
                  '&:hover': {
                    backgroundColor: selected
                      ? `${alpha(theme.palette.primary.main, 0.18)} !important`
                      : alpha(theme.palette.primary.main, 0.05),
                  },
                  '& .MuiListItemText-primary': {
                    color: selected
                      ? theme.palette.primary.main
                      : theme.palette.text.primary,
                    fontWeight: selected ? 700 : 500,
                  },
                  '& .MuiListItemText-secondary': {
                    color: theme.palette.text.secondary,
                  },
                }),
              ]}
              {...listItemButtonProps}
            >
              {group.icon && <IconRender icon={group.icon} />}

              <ListItemText
                className="truncate!"
                primary={group.name}
                secondary={group.now}
              />
            </ListItemButton>
          </ListItem>
        )
      })}
    </Virtualizer>
  )
}
