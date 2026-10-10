import { useLockFn } from 'ahooks'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { message } from '@/utils/notification'
import { HealthAndSafety, Refresh } from '@mui/icons-material'
import { Button, Chip, Paper, Tooltip } from '@mui/material'
import { ClashProxiesProviderQueryItem } from '@nyanpasu/interface'
import ProxiesProviderTraffic from './proxies-provider-traffic'

export interface ProxiesProviderProps {
  provider: ClashProxiesProviderQueryItem
}

const ProxiesProvider = ({ provider }: ProxiesProviderProps) => {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [healthchecking, setHealthchecking] = useState(false)

  const checkedProxies = provider.proxies.filter(
    (proxy) => proxy.alive !== null || proxy.history.length > 0,
  )
  const availableProxies = checkedProxies.filter((proxy) => {
    if (proxy.alive !== null) return proxy.alive
    return (proxy.history[proxy.history.length - 1]?.delay ?? 0) > 0
  }).length

  const handleClick = useLockFn(async () => {
    try {
      setLoading(true)

      await provider.mutate()
    } catch (e) {
      message(`Update ${provider.name} failed.\n${String(e)}`, {
        kind: 'error',
        title: t('Error'),
      })
    } finally {
      setLoading(false)
    }
  })

  const handleHealthcheck = useLockFn(async () => {
    try {
      setHealthchecking(true)
      const result = await provider.mutateHealthcheck()
      message(
        t('Provider health check results', {
          checked: result.checked,
          total: result.total,
          available: result.available,
          unavailable: result.unavailable,
          unknown: result.unknown,
        }),
        {
          kind: 'info',
          title: t('Successful'),
        },
      )
    } catch (e) {
      message(`Health check ${provider.name} failed.\n${String(e)}`, {
        kind: 'error',
        title: t('Error'),
      })
    } finally {
      setHealthchecking(false)
    }
  })

  return (
    <Paper
      className="flex h-full min-w-0 flex-col justify-between gap-3 p-4"
      sx={{
        borderRadius: 6,
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{provider.name}</p>

          <p className="truncate text-sm">
            {provider.vehicleType}/{provider.type}
          </p>
        </div>

        <div className="max-w-[45%] shrink-0 text-right text-xs leading-5">
          {t('Last Update', {
            fromNow: dayjs(provider.updatedAt).fromNow(),
          })}
        </div>
      </div>

      {provider.subscriptionInfo && (
        <ProxiesProviderTraffic provider={provider} />
      )}

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          <Chip
            className="truncate font-bold"
            label={t('Proxy Set proxies', {
              rule: provider.proxies.length,
            })}
          />
          {checkedProxies.length > 0 && (
            <Chip
              color={availableProxies > 0 ? 'success' : 'error'}
              className="truncate font-bold"
              label={t('Provider health status', {
                available: availableProxies,
                checked: checkedProxies.length,
              })}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip title={t('Check provider health')}>
            <span>
              <Button
                loading={healthchecking}
                size="small"
                variant="outlined"
                className="size-8! min-w-0!"
                disabled={healthchecking || loading}
                onClick={handleHealthcheck}
              >
                <HealthAndSafety />
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={t('Update proxy provider')}>
            <span>
              <Button
                loading={loading}
                size="small"
                variant="contained"
                className="size-8! min-w-0!"
                disabled={loading || healthchecking}
                onClick={handleClick}
              >
                <Refresh />
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>
    </Paper>
  )
}

export default ProxiesProvider
