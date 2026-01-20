import { merge } from 'lodash-es'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commands, type IVerge } from '../ipc/bindings'
import { NYANPASU_SETTING_QUERY_KEY } from '../ipc/consts'
import { unwrapResult } from '../utils'
import { useDebouncedConfigUpdate } from './use-debounced-config'

import { isInTauri } from '@nyanpasu/utils'

/**
 * Optimized settings hook with debounced updates for better performance
 * Replaces the original useSettings hook with batched configuration updates
 */
export const useOptimizedSettings = () => {
  const {
    debouncedUpdate,
    flush,
    cancel,
    cleanup,
    isPending: isUpdating,
    error: updateError,
    isError: isUpdateError,
  } = useDebouncedConfigUpdate(300) // 300ms debounce

  const query = useQuery({
    queryKey: [NYANPASU_SETTING_QUERY_KEY],
    enabled: isInTauri,
    queryFn: async () => {
      return unwrapResult(await commands.getVergeConfig())
    },
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      flush() // Apply any pending updates before unmounting
      cleanup()
    }
  }, [flush, cleanup])

  return {
    query,
    upsert: {
      mutate: debouncedUpdate,
      mutateAsync: async (updates: Partial<IVerge>) => {
        debouncedUpdate(updates, true) // Immediate update for async usage
      },
      isPending: isUpdating,
      error: updateError,
      isError: isUpdateError,
    },
    // Additional utilities
    flush,
    cancel,
  }
}

/**
 * Optimized single setting hook with debounced updates
 * @param key - The specific setting key to manage
 */
export const useOptimizedSetting = <K extends keyof IVerge>(key: K) => {
  const {
    query: { data, ...query },
    upsert: update,
    flush,
    cancel,
  } = useOptimizedSettings()

  const value = data?.[key]

  /**
   * Updates a specific setting value with debounced batching
   * @param value - The new value to be set for the specified key
   * @param immediate - If true, applies the update immediately without debouncing
   */
  const upsert = async (value: IVerge[K], immediate = false) => {
    if (!data) {
      return
    }

    if (immediate) {
      await update.mutateAsync({ [key]: value })
    } else {
      update.mutate({ [key]: value })
    }
  }

  /**
   * Batch update multiple settings at once
   * @param updates - Multiple setting updates to batch together
   * @param immediate - If true, applies immediately without debouncing
   */
  const batchUpdate = (updates: Partial<IVerge>, immediate = false) => {
    if (immediate) {
      update.mutateAsync(updates)
    } else {
      update.mutate(updates)
    }
  }

  return {
    value,
    upsert,
    batchUpdate,
    flush,
    cancel,
    // Merge hook status
    ...merge(query, update),
  }
}
