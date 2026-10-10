import { useLockFn } from 'ahooks'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { message } from '@/utils/notification'
import { Refresh } from '@mui/icons-material'
import { Button, Chip, Paper } from '@mui/material'
import { ClashRulesProviderQueryItem } from '@nyanpasu/interface'

interface RulesProviderProps {
  provider: ClashRulesProviderQueryItem
}

export default function RulesProvider({ provider }: RulesProviderProps) {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)

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
            {provider.vehicleType}/{provider.behavior}
          </p>
        </div>

        <div className="max-w-[45%] shrink-0 text-right text-xs leading-5">
          {t('Last Update', {
            fromNow: dayjs(provider.updatedAt).fromNow(),
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <Chip
          className="truncate font-bold"
          label={t('Rule Set rules', {
            rule: provider.ruleCount,
          })}
        />

        <Button
          loading={loading}
          size="small"
          variant="contained"
          className="size-8! min-w-0!"
          disabled={loading}
          onClick={handleClick}
        >
          <Refresh />
        </Button>
      </div>
    </Paper>
  )
}
