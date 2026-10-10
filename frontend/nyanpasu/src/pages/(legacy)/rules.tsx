import { useDebounceEffect } from 'ahooks'
import { useSetAtom } from 'jotai'
import { lazy, RefObject, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { atomRulePage } from '@/components/rules/modules/store'
import { FilledInputProps, TextField } from '@mui/material'
import { useClashRules } from '@nyanpasu/interface'
import { alpha, BasePage } from '@nyanpasu/ui'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(legacy)/rules')({
  component: RulesPage,
})

const Component = lazy(() => import('@/components/rules/rule-page'))

function RulesPage() {
  const { t } = useTranslation()

  const { data, isLoading, isError } = useClashRules()

  const [filterText, setFilterText] = useState('')

  const setRule = useSetAtom(atomRulePage)

  const viewportRef = useRef<HTMLDivElement>(null)

  useDebounceEffect(
    () => {
      setRule({
        data: data?.rules.filter((each) => each.payload.includes(filterText)),
        isLoading,
        isError,
        scrollRef: viewportRef as RefObject<HTMLElement>,
      })
    },
    [data, isLoading, isError, viewportRef.current, filterText],
    { wait: 150 },
  )

  const inputProps: Partial<FilledInputProps> = {
    sx: (theme) => ({
      borderRadius: 7,
      backgroundColor: alpha(theme.palette.primary.main, 0.1),

      fieldset: {
        border: 'none',
      },
    }),
  }

  return (
    <BasePage
      full
      title={t('Rules')}
      header={
        <TextField
          hiddenLabel
          autoComplete="off"
          spellCheck="false"
          value={filterText}
          placeholder={t('Filter conditions')}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full min-w-0 pb-0! sm:max-w-64"
          sx={{ input: { py: 1, fontSize: 14 } }}
          slotProps={{
            input: inputProps,
          }}
        />
      }
      viewportRef={viewportRef}
    >
      <Component />
    </BasePage>
  )
}
