/* eslint-disable */
// @ts-nocheck

import { getSystem } from '@nyanpasu/ui'

export const OS = getSystem()

const isWindows = OS === 'windows'

const isMacOS = OS === 'macos'

export const isLinux = OS === 'linux'

const IS_NIGHTLY = window.__IS_NIGHTLY__ === true
