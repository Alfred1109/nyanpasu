import { createContext, PropsWithChildren, useContext } from 'react'
import { useLockFn } from 'ahooks'
import { useSetting } from '@nyanpasu/interface'
import { useTranslation } from 'react-i18next'

type Language = 'zh-CN'

const LanguageContext = createContext<{
  language?: Language
  setLanguage: (value: Language) => Promise<void>
} | null>(null)

const useLanguage = () => {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }

  return context
}

export const LanguageProvider = ({ children }: PropsWithChildren) => {
  const language = useSetting('language')
  const { i18n } = useTranslation()

  const setLanguage = useLockFn(async (value: Language) => {
    await language.upsert(value)
    // 由于只有中文，无需动态切换
    await i18n.changeLanguage('zh-CN')
  })

  return (
    <LanguageContext.Provider
      value={{
        language: 'zh-CN', // 固定为中文
        setLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}
