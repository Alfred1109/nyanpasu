import { useTranslation } from 'react-i18next'
import ProxiesProvider from '@/components/providers/proxies-provider'
import RulesProvider from '@/components/providers/rules-provider'
import UpdateProviders from '@/components/providers/update-providers'
import UpdateProxiesProviders from '@/components/providers/update-proxies-providers'
import { Chip } from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  useClashProxiesProvider,
  useClashRulesProvider,
} from '@nyanpasu/interface'
import { BasePage } from '@nyanpasu/ui'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(legacy)/providers')({
  component: ProvidersPage,
})

function ProvidersPage() {
  const { t } = useTranslation()

  const proxiesProvider = useClashProxiesProvider()

  const rulesProvider = useClashRulesProvider()

  return (
    <BasePage title={t('Providers')}>
      <div className="flex min-w-0 flex-col gap-5">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-bold">
                {t('Proxies Providers')}
              </h2>
              <Chip
                size="small"
                label={Object.entries(proxiesProvider.data ?? {}).length}
              />
            </div>

            <UpdateProxiesProviders />
          </div>

          {proxiesProvider.data && (
            <Grid container spacing={1.5}>
              {Object.entries(proxiesProvider.data).map(([name, provider]) => (
                <Grid
                  key={name}
                  className="min-w-0"
                  size={{
                    xs: 12,
                    sm: 12,
                    md: 6,
                    lg: 4,
                    xl: 3,
                  }}
                >
                  <ProxiesProvider provider={provider} />
                </Grid>
              ))}
            </Grid>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-bold">
                {t('Rules Providers')}
              </h2>
              <Chip
                size="small"
                label={Object.entries(rulesProvider.data ?? {}).length}
              />
            </div>

            <UpdateProviders />
          </div>

          {rulesProvider.data && (
            <Grid container spacing={1.5}>
              {Object.entries(rulesProvider.data).map(([name, provider]) => (
                <Grid
                  key={name}
                  className="min-w-0"
                  size={{
                    xs: 12,
                    sm: 12,
                    md: 6,
                    lg: 4,
                    xl: 3,
                  }}
                >
                  <RulesProvider provider={provider} />
                </Grid>
              ))}
            </Grid>
          )}
        </section>
      </div>
    </BasePage>
  )
}
