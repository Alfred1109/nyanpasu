import { useThrottle } from 'ahooks'
import { lazy, Suspense, useDeferredValue, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchTermCtx } from '@/components/connections/connection-search-term'
import HeaderSearch from '@/components/connections/header-search'
import { FilterAlt } from '@mui/icons-material'
import { Box, CircularProgress, IconButton } from '@mui/material'
import { BasePage } from '@nyanpasu/ui'
import { createFileRoute, useBlocker } from '@tanstack/react-router'

const Component = lazy(() => import('@/components/connections/connection-page'))

const ColumnFilterDialog = lazy(
  () => import('@/components/connections/connections-column-filter'),
)

const ConnectionTotal = lazy(
  () => import('@/components/connections/connections-total'),
)

export const Route = createFileRoute('/(legacy)/connections')({
  component: Connections,
})

function Connections() {
  const { t } = useTranslation()

  const [openColumnFilter, setOpenColumnFilter] = useState(false)

  const [searchTerm, setSearchTerm] = useState<string>()
  const throttledSearchTerm = useThrottle(searchTerm, { wait: 150 })

  const [mountTable, setMountTable] = useState(true)
  const deferredMountTable = useDeferredValue(mountTable)
  const { proceed } = useBlocker({
    shouldBlockFn: (args) => {
      setMountTable(false)
      return !mountTable
    },
    withResolver: true,
  })

  useEffect(() => {
    if (!deferredMountTable) {
      proceed?.()
    }
  }, [proceed, deferredMountTable])

  // Loading fallback component
  const LoadingFallback = () => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        minHeight: 200,
      }}
    >
      <CircularProgress />
    </Box>
  )

  return (
    <SearchTermCtx.Provider value={throttledSearchTerm}>
      <BasePage
        title={t('Connections')}
        full
        header={
          <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1 pl-2 md:pl-5">
            <Suspense fallback={null}>
              <div className="shrink-0">
                <ConnectionTotal />
              </div>
            </Suspense>
            <div className="ml-auto flex max-w-full min-w-[12.75rem] flex-1 items-center justify-end gap-1">
              <Suspense fallback={null}>
                <ColumnFilterDialog
                  open={openColumnFilter}
                  onClose={() => setOpenColumnFilter(false)}
                />
              </Suspense>
              <HeaderSearch
                className="min-w-0 flex-1"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <IconButton
                aria-label={t('Connection Columns')}
                onClick={() => setOpenColumnFilter(true)}
              >
                <FilterAlt />
              </IconButton>
            </div>
          </div>
        }
      >
        <Suspense fallback={<LoadingFallback />}>
          {mountTable && <Component />}
        </Suspense>
      </BasePage>
    </SearchTermCtx.Provider>
  )
}
