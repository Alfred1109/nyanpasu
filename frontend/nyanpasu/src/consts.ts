import { getSystem } from '@nyanpasu/ui'

declare global {
  interface Window {
    __IS_NIGHTLY__?: boolean
  }
}

export const OS = getSystem()

export const isLinux = OS === 'linux'

export const IS_NIGHTLY = window.__IS_NIGHTLY__ === true
