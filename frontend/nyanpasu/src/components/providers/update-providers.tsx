import { useTranslation } from 'react-i18next'
import { useClashRulesProvider } from '@nyanpasu/interface'
import { UpdateProviderButton } from './update-provider-button'

export const UpdateProviders = () => {
  const { t } = useTranslation()
  const rulesProvider = useClashRulesProvider()

  return (
    <UpdateProviderButton
      providers={rulesProvider.data}
      buttonText={t('Update All Rules Providers')}
      noProvidersMessage="No Providers."
      errorMessagePrefix="Update all failed."
    />
  )
}

export default UpdateProviders
