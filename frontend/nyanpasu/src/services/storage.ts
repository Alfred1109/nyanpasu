import { createJSONStorage } from 'jotai/utils'
import { type AsyncStringStorage } from 'jotai/vanilla/utils/atomWithStorage'
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from '@nyanpasu/interface'

const subscribers: Map<
  string,
  Set<(newValue: string | null) => void>
> = new Map()

export function dispatchStorageValueChanged(
  key: string,
  newValue: string | null,
) {
  if (subscribers.has(key)) {
    const set = subscribers.get(key)
    set!.forEach((callback) => {
      callback(newValue)
    })
  }
}

const NyanpasuStorage = {
  async getItem(key) {
    const value = await getStorageItem(key)
    return value ?? null
  },
  async setItem(key, newValue) {
    await setStorageItem(key, newValue)
  },
  async removeItem(key) {
    await removeStorageItem(key)
  },
  subscribe(key, callback) {
    if (!subscribers.has(key)) {
      subscribers.set(key, new Set())
    }
    const set = subscribers.get(key)
    set!.add(callback)
    return () => {
      if (subscribers.has(key)) {
        const set = subscribers.get(key)
        set!.delete(callback)
        if (set!.size === 0) {
          subscribers.delete(key)
        }
      }
    }
  },
} satisfies AsyncStringStorage

export const createNyanpasuJSONStorage = <T>() =>
  createJSONStorage<T>(() => NyanpasuStorage)
