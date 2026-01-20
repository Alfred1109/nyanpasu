const languageOptions = {
  'zh-CN': '简体中文',
}

export const languageQuirks: {
  [key: string]: {
    drawer: {
      minWidth: number
      itemClassNames?: string
    }
  }
} = {
  'zh-CN': {
    drawer: {
      minWidth: 180,
    },
  },
}

type Language = 'zh-CN'

const DEFAULT_LANGUAGE: Language = 'zh-CN'
