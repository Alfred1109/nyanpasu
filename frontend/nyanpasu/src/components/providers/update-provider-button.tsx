import { useLockFn } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { message } from '@/utils/notification'
import { Refresh } from '@mui/icons-material'
import { Button } from '@mui/material'

interface UpdateProviderButtonProps {
  providers: Record<string, { mutate: () => Promise<unknown> }> | undefined
  buttonText: string
  noProvidersMessage?: string
  errorMessagePrefix?: string
  className?: string
}

export const UpdateProviderButton = ({
  providers,
  buttonText,
  noProvidersMessage = 'No Providers.',
  errorMessagePrefix = 'Update all failed.',
  className,
}: UpdateProviderButtonProps) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const handleProviderUpdate = useLockFn(async () => {
    if (!providers) {
      message(noProvidersMessage, {
        kind: 'info',
        title: t('Info'),
      })
      return
    }

    try {
      setLoading(true)

      await Promise.all(
        Object.entries(providers).map(([_, provider]) => 
          provider.mutate()
        ),
      )

      message(t('Update completed successfully'), {
        kind: 'info',
        title: t('Success'),
      })
    } catch (e) {
      message(`${errorMessagePrefix}\n${String(e)}`, {
        kind: 'error',
        title: t('Error'),
      })
    } finally {
      setLoading(false)
    }
  })

  return (
    <Button
      variant="contained"
      loading={loading}
      startIcon={<Refresh />}
      onClick={handleProviderUpdate}
      className={className}
    >
      {buttonText}
    </Button>
  )
}

export default UpdateProviderButton
