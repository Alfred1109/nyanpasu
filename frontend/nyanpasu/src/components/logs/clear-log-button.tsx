import { useLockFn } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { Close } from '@mui/icons-material'
import { Tooltip } from '@mui/material'
import { useClashLogs } from '@nyanpasu/interface'
import { FloatingButton } from '@nyanpasu/ui'

const ClearLogButton = () => {
  const { t } = useTranslation()

  const {
    clean,
    query: { data: logs },
  } = useClashLogs()

  const handleClean = useLockFn(async () => {
    await clean.mutateAsync()
  })

  return (
    <Tooltip title={t('Clear')}>
      <span className="fixed right-8 bottom-8 z-10 inline-flex size-16">
        <FloatingButton
          aria-label={t('Clear')}
          onClick={handleClean}
          disabled={!logs?.length || clean.isPending}
        >
          <Close className="absolute size-8!" />
        </FloatingButton>
      </span>
    </Tooltip>
  )
}

export default ClearLogButton
