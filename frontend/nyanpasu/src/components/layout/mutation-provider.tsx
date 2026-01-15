import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useGlobalMutation } from '@/utils/mutation'
import { notification, NotificationType } from '@/utils/notification'
import { listen, UnlistenFn } from '@tauri-apps/api/event'

const isInTauri = typeof window !== 'undefined' && '__TAURI__' in window

export default function MutationProvider() {
  const { t } = useTranslation()
  const unlistenFn = useRef<UnlistenFn>(null)
  const mutate = useGlobalMutation()
  useEffect(() => {
    if (!isInTauri) return

    listen<'nyanpasu_config' | 'clash_config' | 'proxies' | 'profiles'>(
      'nyanpasu://mutation',
      ({ payload }) => {
        switch (payload) {
          case 'nyanpasu_config':
            mutate((key: unknown) => {
              if (typeof key === 'string') {
                return (
                  key.includes('nyanpasuConfig') ||
                  key.includes('getProxies') ||
                  key.includes('getProfiles')
                )
              }
              return false
            })
            break
          case 'clash_config':
            mutate((key: unknown) => {
              if (typeof key === 'string') {
                return (
                  key.includes('getClashRules') ||
                  key.includes('getClashInfo') ||
                  key.includes('getClashVersion') ||
                  key.includes('getProxies') ||
                  key.includes('getProfiles') ||
                  key.includes('getRulesProviders') ||
                  key.includes('getProxiesProviders') ||
                  key.includes('getAllProxiesProviders')
                )
              }
              return false
            })
            break
          case 'proxies':
            mutate(
              (key: unknown) =>
                typeof key === 'string' && key.includes('getProxies'),
            )
            break
          case 'profiles':
            mutate((key: unknown) => {
              if (typeof key === 'string') {
                return (
                  key.includes('getClashRules') ||
                  key.includes('getClashInfo') ||
                  key.includes('getClashVersion') ||
                  key.includes('getProxies') ||
                  key.includes('getProfiles') ||
                  key.includes('getRulesProviders') ||
                  key.includes('getProxiesProviders') ||
                  key.includes('getAllProxiesProviders')
                )
              }
              return false
            })
            break
        }
      },
    )
      .then((unlisten) => {
        unlistenFn.current = unlisten
      })
      .catch((e) => {
        notification({
          title: t('Error'),
          body: e.message,
          type: NotificationType.Error,
        })
      })
    return () => {
      unlistenFn.current?.()
    }
  }, [mutate, t])
  return null
}
