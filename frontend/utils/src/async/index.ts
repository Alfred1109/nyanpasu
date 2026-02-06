import { includes, isArray, isObject, isString, some } from 'lodash-es'

/**
 * Sleep utility function
 */
export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Search utility function that works recursively through objects and arrays
 */
export const containsSearchTerm = (obj: unknown, term: string): boolean => {
  if (!obj || !term) return false

  if (isString(obj)) {
    return includes(obj.toLowerCase(), term.toLowerCase())
  }

  if (isObject(obj) || isArray(obj)) {
    return some(obj, (value: unknown) => containsSearchTerm(value, term))
  }

  return false
}
