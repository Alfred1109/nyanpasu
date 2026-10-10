import { useLockFn, useSize } from 'ahooks'
import { useAtom } from 'jotai'
import { RefObject, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ContentDisplay from '@/components/base/content-display'
import {
  DelayButton,
  GroupList,
  NodeList,
  NodeListRef,
} from '@/components/proxies'
import ProxyGroupName from '@/components/proxies/proxy-group-name'
import ScrollCurrentNode from '@/components/proxies/scroll-current-node'
import SortSelector from '@/components/proxies/sort-selector'
import { proxyGroupAtom } from '@/store'
import { proxiesFilterAtom } from '@/store/proxies'
import { formatError } from '@/utils'
import { message } from '@/utils/notification'
import { Check } from '@mui/icons-material'
import {
  Alert,
  CircularProgress,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { alpha as muiAlpha } from '@mui/material/styles'
import {
  ProxyGroupItem,
  useClashProxies,
  useProxyMode,
} from '@nyanpasu/interface'
import { cn, SidePage } from '@nyanpasu/ui'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(legacy)/proxies')({
  component: ProxyPage,
})

function ProxyFilterInput() {
  const [proxiesFilter, setProxiesFilter] = useAtom(proxiesFilterAtom)
  const { t } = useTranslation()

  return (
    <TextField
      hiddenLabel
      fullWidth
      autoComplete="off"
      spellCheck="false"
      placeholder={t('Filter conditions')}
      aria-label={t('Filter conditions')}
      className="pb-0!"
      sx={{ input: { py: 1.2, fontSize: 14 } }}
      value={proxiesFilter || ''}
      onChange={(e) =>
        setProxiesFilter(!e.target.value.trim().length ? null : e.target.value)
      }
      slotProps={{
        input: {
          sx: (theme) => ({
            borderRadius: 7,
            backgroundColor: muiAlpha(theme.palette.primary.main, 0.08),
            border: `1px solid ${muiAlpha(theme.palette.primary.main, 0.14)}`,

            fieldset: {
              border: 'none',
            },
            '&:hover': {
              backgroundColor: muiAlpha(theme.palette.primary.main, 0.1),
            },
          }),
        },
      }}
    />
  )
}

function SideBar() {
  return <ProxyFilterInput />
}

function ProxyPage() {
  const { t } = useTranslation()

  const { value: proxyMode, upsert, query, isPending } = useProxyMode()

  const { data } = useClashProxies()

  const [proxyGroup] = useAtom(proxyGroupAtom)
  const [groupSelectionRevision, setGroupSelectionRevision] = useState(0)

  const group = useMemo<ProxyGroupItem | undefined>(() => {
    if (proxyMode.global) return data?.global
    if (proxyMode.direct) {
      return data?.direct ? { ...data.direct, all: [] } : undefined
    }
    if (proxyMode.rule && proxyGroup.selector !== null) {
      return data?.groups[proxyGroup.selector]
    }
    return undefined
  }, [
    data?.direct,
    data?.global,
    data?.groups,
    proxyGroup.selector,
    proxyMode.direct,
    proxyMode.global,
    proxyMode.rule,
  ])

  const handleDelayClick = async (timeout: number) => {
    if (proxyMode.global) {
      if (!data?.global) throw new Error('Global proxy group is unavailable.')
      await data.global.mutateDelay({ timeout })
      return
    }
    if (proxyMode.rule && proxyGroup.selector !== null) {
      const selectedGroup = data?.groups[proxyGroup.selector]
      if (selectedGroup) {
        await selectedGroup.mutateDelay({ timeout })
        return
      }
    }
    throw new Error('Select an available proxy group before testing latency.')
  }

  const hasProxies = Boolean(data?.groups.length)

  const nodeListRef = useRef<NodeListRef>(null)
  const portalHeaderRef = useRef<HTMLDivElement>(null)
  const portalHeaderSize = useSize(portalHeaderRef)

  const modeUnavailable =
    query.isLoading || query.isError || !Object.values(proxyMode).some(Boolean)

  const handleSwitch = useLockFn(async (key: string) => {
    if (!key || isPending || modeUnavailable) return
    try {
      const result = await upsert(key)
      if (result.cleanupError) {
        message(
          `代理模式已切换，但清理现有连接失败：${formatError(result.cleanupError)}`,
          { kind: 'warning', title: '代理模式已切换' },
        )
      }
    } catch (error) {
      message(`代理模式切换失败：${formatError(error)}`, {
        kind: 'error',
        title: '代理模式切换失败',
      })
    }
  })

  const Header = useMemo(() => {
    return (
      <div className="flex items-center gap-1">
        <ToggleButtonGroup
          color="primary"
          size="small"
          exclusive
          disabled={modeUnavailable || isPending}
          onChange={(_, newValue) => {
            if (newValue) handleSwitch(newValue)
          }}
          sx={(theme) => ({
            backgroundColor: muiAlpha(theme.palette.background.paper, 0.92),
            borderRadius: 999,
            border: `1px solid ${muiAlpha(theme.palette.divider, 0.9)}`,
          })}
        >
          {Object.entries(proxyMode).map(([key, enabled], index) => (
            <ToggleButton
              key={key}
              disabled={modeUnavailable || isPending}
              className={cn(
                'flex justify-center gap-0.5 px-3!',
                index === 0 && 'rounded-l-full!',
                index === Object.entries(proxyMode).length - 1 &&
                  'rounded-r-full!',
              )}
              value={key}
              selected={enabled}
            >
              {enabled && <Check className="mr-[0.1rem] -ml-2 scale-75" />}
              {isPending && enabled && <CircularProgress size={12} />}
              {t(key)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
    )
  }, [handleSwitch, isPending, modeUnavailable, proxyMode, t])

  const leftViewportRef = useRef<HTMLDivElement>(null)

  const rightViewportRef = useRef<HTMLDivElement>(null)

  return (
    <SidePage
      title={t('Proxy Groups')}
      sideTitle={t('Proxy Groups')}
      sideSelectionKey={`${proxyGroup.selector}:${groupSelectionRevision}`}
      leftViewportRef={leftViewportRef}
      rightViewportRef={rightViewportRef}
      header={Header}
      sideBar={proxyMode.rule ? <SideBar /> : undefined}
      side={
        hasProxies &&
        proxyMode.rule && (
          <GroupList
            scrollRef={leftViewportRef as RefObject<HTMLElement>}
            onGroupSelect={() =>
              setGroupSelectionRevision((revision) => revision + 1)
            }
          />
        )
      }
      portalRightRoot={
        hasProxies &&
        !proxyMode.direct && (
          <div
            ref={portalHeaderRef}
            className={cn(
              'absolute z-10 flex w-full flex-wrap items-center justify-between gap-2 rounded-t-2xl! px-2 py-2 backdrop-blur sm:px-4',
            )}
            style={{
              background: 'var(--mui-palette-background-paper)',
              borderBottom: '1px solid var(--mui-palette-divider)',
            }}
          >
            <div className="relative min-w-0 flex-1 overflow-hidden max-[360px]:hidden">
              {group?.name && <ProxyGroupName name={group?.name} />}
            </div>

            <div className="flex min-w-0 items-center gap-2 max-[360px]:w-full max-[360px]:flex-wrap">
              {!proxyMode.rule && !proxyMode.direct && (
                <div className="w-28 shrink-0 max-[360px]:w-full sm:w-36">
                  <ProxyFilterInput />
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <ScrollCurrentNode
                  onClick={() => {
                    nodeListRef.current?.scrollToCurrent()
                  }}
                />
                <SortSelector />
              </div>
            </div>
          </div>
        )
      }
    >
      {modeUnavailable && !query.isLoading && (
        <Alert
          severity={query.isError ? 'error' : 'warning'}
          className="mx-3 mt-14"
        >
          {query.isError
            ? `无法读取当前代理模式，模式切换已停用：${formatError(query.error)}`
            : '当前代理模式未知，模式切换已停用。'}
        </Alert>
      )}
      {query.isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <CircularProgress size={28} />
        </div>
      ) : modeUnavailable ? null : !proxyMode.direct ? (
        hasProxies ? (
          <>
            <NodeList
              ref={nodeListRef}
              scrollRef={rightViewportRef as RefObject<HTMLElement>}
              toolbarHeight={portalHeaderSize?.height}
            />

            <DelayButton onClick={handleDelayClick} />
          </>
        ) : (
          <ContentDisplay className="absolute" message={t('No Proxies')} />
        )
      ) : (
        <ContentDisplay className="absolute" message={t('Direct Mode')} />
      )}
    </SidePage>
  )
}
