import { useAtom, useAtomValue } from 'jotai'
import { memo, RefObject, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Virtualizer } from 'virtua'
import { proxyGroupAtom } from '@/store'
import { pinnedProxyGroupsAtom, proxiesFilterAtom } from '@/store/proxies'
import { getThemePaletteTokens, tokenAlpha } from '@/utils/theme'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import {
  IconButton,
  ListItem,
  ListItemButton,
  ListItemButtonProps,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material'
import { getServerPort, useClashProxies } from '@nyanpasu/interface'
import { LazyImage } from '@nyanpasu/ui'
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
  onGroupSelect?: () => void
}

export const GroupList = ({
  scrollRef,
  onGroupSelect,
  ...listItemButtonProps
}: GroupListProps) => {
  const { data } = useClashProxies()

  const [proxyGroup, setProxyGroup] = useAtom(proxyGroupAtom)
  const [pinnedGroups, setPinnedGroups] = useAtom(pinnedProxyGroupsAtom)
  const proxiesFilter = useAtomValue(proxiesFilterAtom)
  const deferredProxiesFilter = useDeferredValue(proxiesFilter)
  const { t } = useTranslation()
  const [clearingGroup, setClearingGroup] = useState<string | null>(null)
  const [clearError, setClearError] = useState<{
    group: string
    message: string
  } | null>(null)

  const handleSelect = (index: number) => {
    setProxyGroup({ selector: index })
    onGroupSelect?.()
  }

  const groups = useMemo(() => {
    if (!data?.groups) {
      return []
    }

    const filtered = data.groups.filter((group) => {
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
    return filtered.sort((a, b) => {
      const aPinned = pinnedGroups.includes(a.name)
      const bPinned = pinnedGroups.includes(b.name)
      return Number(bPinned) - Number(aPinned)
    })
  }, [data?.groups, deferredProxiesFilter, pinnedGroups])

  const groupsByName = useMemo(
    () => new Map((data?.groups ?? []).map((group) => [group.name, group])),
    [data?.groups],
  )

  const groupChain = (start: (typeof groups)[number]) => {
    const chain = [start.name]
    const visited = new Set(chain)
    let current = start
    while (current.now) {
      chain.push(current.now)
      if (visited.has(current.now)) break
      visited.add(current.now)
      const nested = groupsByName.get(current.now)
      if (!nested) break
      current = nested
    }
    return chain.join(' › ')
  }

  const groupAvailability = (group: (typeof groups)[number]) => {
    if (group.alive === true) return t('Available')
    if (group.alive === false) return t('Unavailable')

    const known = group.all.filter(
      (proxy) => proxy.alive !== null || proxy.history.length > 0,
    )
    if (!known.length) return null
    const available = known.filter((proxy) => {
      if (proxy.alive !== null) return proxy.alive
      return (proxy.history[proxy.history.length - 1]?.delay ?? 0) > 0
    }).length
    return `${available}/${known.length} ${t('available')}`
  }

  const togglePinned = (name: string) => {
    setPinnedGroups((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    )
  }

  const restoreAutomaticSelection = async (group: (typeof groups)[number]) => {
    setClearingGroup(group.name)
    setClearError(null)
    try {
      await group.mutateClearFixed()
    } catch (error) {
      setClearError({
        group: group.name,
        message:
          error instanceof Error
            ? error.message
            : t('Unable to restore automatic selection'),
      })
    } finally {
      setClearingGroup(null)
    }
  }

  return (
    <Virtualizer scrollRef={scrollRef}>
      {groups.map((group) => {
        const index =
          data?.groups.findIndex((item) => item.name === group.name) ?? -1
        const selected = index === proxyGroup.selector
        const isPinned = pinnedGroups.includes(group.name)
        const currentChain = groupChain(group)
        const availability = groupAvailability(group)

        return (
          <ListItem key={group.name} disablePadding sx={{ gap: 0.5 }}>
            <ListItemButton
              selected={selected}
              onClick={() => handleSelect(index)}
              sx={[
                (theme) => ({
                  minWidth: 0,
                  flex: 1,
                  ...(() => {
                    const tokens = getThemePaletteTokens(theme)

                    return {
                      borderRadius: 3,
                      backgroundColor: selected
                        ? `${tokenAlpha(tokens.primary.main, 0.14)} !important`
                        : null,
                      '&:hover': {
                        backgroundColor: selected
                          ? `${tokenAlpha(tokens.primary.main, 0.18)} !important`
                          : tokenAlpha(tokens.primary.main, 0.08),
                      },
                      '& .MuiListItemText-primary': {
                        color: selected
                          ? tokens.primary.main
                          : tokens.text.primary,
                        fontWeight: selected ? 700 : 500,
                      },
                      '& .MuiListItemText-secondary': {
                        color: tokens.text.secondary,
                      },
                    }
                  })(),
                }),
              ]}
              {...listItemButtonProps}
            >
              {group.icon && <IconRender icon={group.icon} />}

              <ListItemText
                className="min-w-0 truncate!"
                primary={group.name}
                secondary={
                  <span className="block truncate" title={currentChain}>
                    {availability ? `${availability} · ` : ''}
                    {currentChain}
                  </span>
                }
              />
            </ListItemButton>
            {group.canClearFixed && (
              <Tooltip
                title={
                  clearError?.group === group.name
                    ? clearError.message
                    : t('Restore automatic selection')
                }
              >
                <IconButton
                  size="small"
                  aria-label={t('Restore automatic selection')}
                  disabled={clearingGroup === group.name}
                  color={clearError?.group === group.name ? 'error' : 'default'}
                  onClick={() => restoreAutomaticSelection(group)}
                >
                  <AutorenewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={isPinned ? t('Unpin group') : t('Pin group')}>
              <IconButton
                size="small"
                aria-label={isPinned ? t('Unpin group') : t('Pin group')}
                onClick={() => togglePinned(group.name)}
              >
                {isPinned ? (
                  <StarIcon fontSize="small" color="primary" />
                ) : (
                  <StarBorderIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </ListItem>
        )
      })}
    </Virtualizer>
  )
}
