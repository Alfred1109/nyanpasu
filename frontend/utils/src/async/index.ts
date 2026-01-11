// Async utilities consolidated from various sources
import { includes, isArray, isObject, isString, some } from 'lodash-es'

/**
 * Sleep utility function
 * From frontend/nyanpasu/src/utils/index.ts
 */
export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Search utility function that works recursively through objects and arrays
 * From frontend/nyanpasu/src/utils/index.ts
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

/**
 * Retry utility function
 * From frontend/interface/src/utils/retry.ts
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    delay?: number
    backoffMultiplier?: number
    maxDelay?: number
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoffMultiplier = 2,
    maxDelay = 10000,
  } = options

  let lastError: Error
  let currentDelay = delay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxAttempts) {
        throw lastError
      }

      await sleep(Math.min(currentDelay, maxDelay))
      currentDelay *= backoffMultiplier
    }
  }

  throw lastError!
}
