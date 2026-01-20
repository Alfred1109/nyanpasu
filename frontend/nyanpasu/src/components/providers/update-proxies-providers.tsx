import { useTranslation } from 'react-i18next'
import { useClashProxiesProvider } from '@nyanpasu/interface'
import { UpdateProviderButton } from './update-provider-button'

const UpdateProxiesProviders = () => {
  const { t } = useTranslation()
  const proxiesProvider = useClashProxiesProvider()

  return (
    <UpdateProviderButton
      providers={proxiesProvider.data}
      buttonText={t('Update All Proxies Providers')}
      noProvidersMessage="No Providers."
      errorMessagePrefix="Update all failed."
    />
  )
}

export default UpdateProxiesProviders
