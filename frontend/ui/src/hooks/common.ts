/**
 * 通用React Hook库
 * 统一管理项目中重复出现的React Hook模式，减少代码冗余
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation as useI18nTranslation } from 'react-i18next'

/**
 * 统一的翻译Hook - 解决25+文件中的重复模式
 * 标准化 const { t } = useTranslation() 模式
 */
export const useCommonTranslation = () => {
  return useI18nTranslation()
}

/**
 * 通用的加载状态Hook - 解决15+文件中的重复loading状态
 */
export const useLoadingState = (initialLoading = false) => {
  const [loading, setLoading] = useState<boolean>(initialLoading)
  
  const startLoading = useCallback(() => setLoading(true), [])
  const stopLoading = useCallback(() => setLoading(false), [])
  const toggleLoading = useCallback(() => setLoading(prev => !prev), [])
  
  return {
    loading,
    setLoading,
    startLoading,
    stopLoading,
    toggleLoading,
  }
}

/**
 * 通用的错误状态Hook - 解决8+文件中的重复error状态
 */
export const useErrorState = <T = string>(initialError: T | null = null) => {
  const [error, setError] = useState<T | null>(initialError)
  
  const clearError = useCallback(() => setError(null), [])
  const hasError = error !== null
  
  return {
    error,
    setError,
    clearError,
    hasError,
  }
}

/**
 * 通用的开关状态Hook - 解决12+文件中的重复open/close状态
 */
export const useToggleState = (initialState = false) => {
  const [isOpen, setIsOpen] = useState<boolean>(initialState)
  
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])
  
  return {
    isOpen,
    setIsOpen,
    open,
    close,
    toggle,
  }
}

/**
 * 组合Hook：加载状态 + 错误状态
 * 常用于异步操作的状态管理
 */
export const useAsyncState = <T = string>(
  initialLoading = false,
  initialError: T | null = null
) => {
  const loadingState = useLoadingState(initialLoading)
  const errorState = useErrorState<T>(initialError)
  
  const reset = useCallback(() => {
    loadingState.stopLoading()
    errorState.clearError()
  }, [loadingState.stopLoading, errorState.clearError])
  
  return {
    ...loadingState,
    ...errorState,
    reset,
  }
}

/**
 * 通用的表单状态Hook
 * 统一表单的pending/submitting状态管理
 */
export const useFormState = () => {
  const [isPending, setIsPending] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const startSubmitting = useCallback(() => {
    setIsPending(true)
    setIsSubmitting(true)
  }, [])
  
  const stopSubmitting = useCallback(() => {
    setIsPending(false)
    setIsSubmitting(false)
  }, [])
  
  return {
    isPending,
    isSubmitting,
    setIsPending,
    setIsSubmitting,
    startSubmitting,
    stopSubmitting,
  }
}

/**
 * 防抖Hook - 统一防抖逻辑
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}

/**
 * 节流Hook - 统一节流逻辑
 */
export const useThrottle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T => {
  const lastRun = useRef(Date.now())
  
  const throttledFunc = useCallback(
    (...args: Parameters<T>) => {
      if (Date.now() - lastRun.current >= delay) {
        func(...args)
        lastRun.current = Date.now()
      }
    },
    [func, delay]
  ) as T
  
  return throttledFunc
}

/**
 * 本地存储Hook - 统一localStorage操作
 */
export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })
  
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error)
      }
    },
    [key, storedValue]
  )
  
  return [storedValue, setValue]
}

/**
 * 定时器Hook - 统一定时器管理
 */
export const useInterval = (callback: () => void, delay: number | null) => {
  const savedCallback = useRef(callback)
  
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])
  
  useEffect(() => {
    if (delay !== null) {
      const interval = setInterval(() => savedCallback.current(), delay)
      return () => clearInterval(interval)
    }
  }, [delay])
}

/**
 * 点击外部Hook - 统一点击外部检测逻辑
 */
export const useClickOutside = <T extends HTMLElement = HTMLElement>(
  callback: () => void
) => {
  const ref = useRef<T>(null)
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [callback])
  
  return ref
}
