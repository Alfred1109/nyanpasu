import { Notice } from '@/components/base'
import { isPortable } from '@nyanpasu/interface'
import {
  MessageDialogOptions,
  message as tauriMessage,
} from '@tauri-apps/plugin-dialog'
import {
  isPermissionGranted,
  Options,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

const isInTauri = typeof window !== 'undefined' && '__TAURI__' in window

let permissionGranted: boolean | null = null
let portable: boolean | null = null
let pluginAvailable: boolean | null = null

const checkPermission = async () => {
  if (pluginAvailable === false) {
    return false
  }
  if (permissionGranted == null) {
    try {
      permissionGranted = await isPermissionGranted()
    } catch {
      pluginAvailable = false
      permissionGranted = false
      return false
    }
  }
  if (!permissionGranted) {
    try {
      const permission = await requestPermission()
      permissionGranted = permission === 'granted'
    } catch {
      pluginAvailable = false
      permissionGranted = false
      return false
    }
  }
  return permissionGranted
}

export type NotificationOptions = {
  title: string
  body?: string
  type?: NotificationType
}

export enum NotificationType {
  Success = 'success',
  Info = 'info',
  // Warn = "warn",
  Error = 'error',
}

export const notification = async ({
  title,
  body,
  type = NotificationType.Info,
}: NotificationOptions) => {
  if (!title) {
    throw new Error('missing message argument!')
  }

  if (!isInTauri) {
    Notice[type](`${title} ${body ? `: ${body}` : ''}`)
    return
  }

  if (portable === null) {
    try {
      portable = (await isPortable()) ?? false
    } catch {
      portable = true
    }
  }
  const permissionGranted = portable || (await checkPermission())
  if (portable || !permissionGranted) {
    // fallback to mui notification
    Notice[type](`${title} ${body ? `: ${body}` : ''}`)
    // throw new Error("notification permission not granted!");
    return
  }
  const options: Options = {
    title,
  }
  if (body) options.body = body
  try {
    sendNotification(options)
  } catch {
    pluginAvailable = false
    Notice[type](`${title} ${body ? `: ${body}` : ''}`)
  }
}

export const message = async (
  value: string,
  options?: string | MessageDialogOptions | undefined,
) => {
  if (!isInTauri) {
    Notice.info(value)
    return
  }

  if (typeof options === 'object') {
    await tauriMessage(value, {
      ...options,
      title: options.title
        ? `Clash Nyanpasu - ${options.title}`
        : 'Clash Nyanpasu',
    })
  } else {
    await tauriMessage(value, options)
  }
}
