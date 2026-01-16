import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { createNyanpasuJSONStorage } from '@/services/storage'

/**
 * Safely get item from localStorage with error handling
 */
export const getStorageItem = <T = string>(
  key: string,
  defaultValue: T,
  parser?: (value: string) => T,
): T => {
  try {
    const item = localStorage.getItem(key)
    if (item === null) return defaultValue

    return parser ? parser(item) : (item as T)
  } catch {
    return defaultValue
  }
}

/**
 * Safely set item to localStorage with error handling
 */
export const setStorageItem = (
  key: string,
  value: any,
  serializer?: (value: any) => string,
): boolean => {
  try {
    const serializedValue = serializer ? serializer(value) : String(value)
    localStorage.setItem(key, serializedValue)
    return true
  } catch {
    return false
  }
}

/**
 * Create a localStorage-backed atom with Jotai
 * This is the recommended way for most use cases
 */
export const createStorageAtom = <T>(
  key: string,
  initialValue: T,
  useNyanpasuStorage = false,
) => {
  if (useNyanpasuStorage) {
    return atomWithStorage(key, initialValue, createNyanpasuJSONStorage<T>())
  }
  return atomWithStorage(key, initialValue)
}

/**
 * Create localStorage-backed boolean state utilities
 * For cases where Jotai atoms are not suitable
 */
export const createPersistedBooleanState = (
  key: string,
  defaultValue = false,
) => {
  const getStoredValue = (): boolean =>
    getStorageItem(key, defaultValue, (val) => JSON.parse(val))

  const setStoredValue = (value: boolean): boolean =>
    setStorageItem(key, value, (val) => JSON.stringify(val))

  return { getStoredValue, setStoredValue }
}

/**
 * Legacy localStorage atom creator - deprecated
 * Use createStorageAtom instead
 * @deprecated
 */
export const atomWithLocalStorage = <T>(key: string, initialValue: T) => {
  console.warn(
    `atomWithLocalStorage is deprecated. Use createStorageAtom instead for key: ${key}`,
  )

  const getInitialValue = (): T =>
    getStorageItem(key, initialValue, (val) => JSON.parse(val))

  const baseAtom = atom<T>(getInitialValue())

  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update: T | ((prev: T) => T)) => {
      const nextValue =
        typeof update === 'function'
          ? (update as (prev: T) => T)(get(baseAtom))
          : update

      set(baseAtom, nextValue)
      setStorageItem(key, nextValue, (val) => JSON.stringify(val))
    },
  )

  return derivedAtom
}
