import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export const useGlobalMutation = () => {
  const queryClient = useQueryClient()

  return useCallback(
    (queryKey: any, ...args: any[]) => {
      const matcher = typeof queryKey === 'function' ? queryKey : undefined

      if (matcher) {
        // Invalidate queries matching the predicate function
        queryClient.invalidateQueries({ predicate: matcher })
      } else {
        // Invalidate specific query by key
        queryClient.invalidateQueries({ queryKey })
      }
    },
    [queryClient],
  )
}
