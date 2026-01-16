import { useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commands, type IVerge } from '../ipc/bindings'
import { NYANPASU_SETTING_QUERY_KEY } from '../ipc/consts'
import { unwrapResult } from '../utils'

/**
 * Performance-optimized configuration update hook with debouncing
 * Batches multiple configuration updates to reduce API calls and improve performance
 */
export const useDebouncedConfigUpdate = (debounceMs = 300) => {
  const queryClient = useQueryClient()
  const pendingUpdatesRef = useRef<Partial<IVerge>>({})
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const mutation = useMutation({
    mutationFn: async (updates: Partial<IVerge>) => {
      return unwrapResult(await commands.patchVergeConfig(updates as IVerge))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [NYANPASU_SETTING_QUERY_KEY],
      })
    },
  })

  /**
   * Debounced update function that batches multiple configuration changes
   * @param updates - Partial configuration updates to apply
   * @param immediate - If true, bypasses debouncing and applies immediately
   */
  const debouncedUpdate = useCallback(
    (updates: Partial<IVerge>, immediate = false) => {
      // Merge new updates with pending updates
      Object.assign(pendingUpdatesRef.current, updates)

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      if (immediate) {
        // Apply immediately without debouncing
        const finalUpdates = { ...pendingUpdatesRef.current }
        pendingUpdatesRef.current = {}
        mutation.mutate(finalUpdates)
        return
      }

      // Set new timeout for debounced execution
      timeoutRef.current = setTimeout(() => {
        const finalUpdates = { ...pendingUpdatesRef.current }
        pendingUpdatesRef.current = {}
        mutation.mutate(finalUpdates)
      }, debounceMs)
    },
    [debounceMs, mutation],
  )

  /**
   * Flush any pending updates immediately
   */
  const flush = useCallback(() => {
    if (Object.keys(pendingUpdatesRef.current).length > 0) {
      debouncedUpdate({}, true)
    }
  }, [debouncedUpdate])

  /**
   * Cancel any pending updates
   */
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    pendingUpdatesRef.current = {}
  }, [])

  // Cleanup timeout on unmount
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return {
    debouncedUpdate,
    flush,
    cancel,
    cleanup,
    isPending: mutation.isPending,
    error: mutation.error,
    isError: mutation.isError,
    hasPendingUpdates: () => Object.keys(pendingUpdatesRef.current).length > 0,
  }
}
