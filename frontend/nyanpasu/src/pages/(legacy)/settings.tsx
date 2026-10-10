import { useLockFn } from 'ahooks'
import { lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEnvInfos } from '@/utils'
import { Feedback, GitHub } from '@mui/icons-material'
import { Box, IconButton } from '@mui/material'
import { collectEnvs, openThat } from '@nyanpasu/interface'
import { BasePage } from '@nyanpasu/ui'
import { createFileRoute } from '@tanstack/react-router'

const Component = lazy(() => import('@/components/setting/setting-page'))
export const Route = createFileRoute('/(legacy)/settings')({
  component: SettingPage,
})

function SettingPage() {
  const { t } = useTranslation()
  const toGithub = useLockFn(() =>
    openThat('https://github.com/Alfred1109/clashnyanpasu'),
  )
  const toFeedback = useLockFn(async () => {
    const envs = await collectEnvs()
    const formattedEnv = encodeURIComponent(
      formatEnvInfos(envs)
        .split('\n')
        .map((value) => `> ${value}`)
        .join('\n'),
    )
    return openThat(
      'https://github.com/Alfred1109/clashnyanpasu/issues/new?assignees=&labels=T%3A+Bug%2CS%3A+Untriaged&projects=&template=bug_report.yaml&env_infos=' +
        formattedEnv,
    )
  })
  return (
    <BasePage
      title={t('Settings')}
      header={
        <Box
          data-inline-tools
          sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}
        >
          <IconButton
            color="inherit"
            title={t('Feedback')}
            onClick={toFeedback}
          >
            <Feedback fontSize="inherit" />
          </IconButton>
          <IconButton
            color="inherit"
            title="@Alfred1109/clashnyanpasu"
            onClick={toGithub}
          >
            <GitHub fontSize="inherit" />
          </IconButton>
        </Box>
      }
      sectionStyle={{ padding: '12px 16px' }}
    >
      <Component />
    </BasePage>
  )
}
