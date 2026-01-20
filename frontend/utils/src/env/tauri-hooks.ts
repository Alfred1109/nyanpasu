/**
 * Tauri环境检测Hook库
 * 统一管理项目中Tauri环境相关的重复检测模式和useEffect逻辑
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { isInTauri, getCurrentEnvironment } from './index'

/**
 * 统一的Tauri环境Effect Hook
 * 解决10+个文件中重复的 useEffect(() => { if (!isInTauri) return }, []) 模式
 */
export const useTauriEffect = (
  effect: () => void | (() => void),
  deps: React.DependencyList = []
) => {
  useEffect(() => {
    if (!isInTauri()) return
    return effect()
  }, [effect, ...deps])
}

/**
 * Tauri环境条件执行Hook
 * 只在Tauri环境中执行某些逻辑
 */
export const useTauriConditional = <T>(
  tauriCallback: () => T,
  fallbackCallback?: () => T
): T | undefined => {
  const isTauri = isInTauri()
  
  if (isTauri) {
    return tauriCallback()
  } else if (fallbackCallback) {
    return fallbackCallback()
  }
  
  return undefined
}

/**
 * Tauri事件监听Hook
 * 统一管理Tauri事件监听的生命周期
 */
export const useTauriEventListener = <T = any>(
  eventName: string,
  handler: (event: { payload: T }) => void,
  deps: React.DependencyList = []
) => {
  const unlistenRef = useRef<(() => void) | null>(null)
  
  useTauriEffect(() => {
    let isMounted = true
    
    const setupListener = async () => {
      try {
        // 动态导入Tauri API以避免在非Tauri环境中出错
        const { listen } = await import('@tauri-apps/api/event')
        
        if (!isMounted) return
        
        const unlisten = await listen<T>(eventName, handler)
        unlistenRef.current = unlisten
      } catch (error) {
        console.error(`Failed to setup Tauri event listener for ${eventName}:`, error)
      }
    }
    
    setupListener()
    
    return () => {
      isMounted = false
      if (unlistenRef.current) {
        unlistenRef.current()
        unlistenRef.current = null
      }
    }
  }, [eventName, handler, ...deps])
  
  // 提供手动清理的方法
  const cleanup = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current()
      unlistenRef.current = null
    }
  }, [])
  
  return { cleanup }
}

/**
 * Tauri窗口事件Hook
 * 统一管理窗口相关事件监听
 */
export const useTauriWindowEvent = <T = any>(
  eventType: string,
  handler: (event: T) => void,
  deps: React.DependencyList = []
) => {
  useTauriEffect(() => {
    let isMounted = true
    
    const setupWindowListener = async () => {
      try {
        const { appWindow } = await import('@tauri-apps/api/window')
        const { listen } = await import('@tauri-apps/api/event')
        
        if (!isMounted || !appWindow) return
        
        const unlisten = await listen(eventType, handler)
        return unlisten
      } catch (error) {
        console.error(`Failed to setup window event listener for ${eventType}:`, error)
        return null
      }
    }
    
    let unlisten: (() => void) | null = null
    
    setupWindowListener().then((unlistenFn) => {
      if (unlistenFn && isMounted) {
        unlisten = unlistenFn
      }
    })
    
    return () => {
      isMounted = false
      if (unlisten) {
        unlisten()
      }
    }
  }, [eventType, handler, ...deps])
}

/**
 * Tauri命令调用Hook
 * 统一管理Tauri命令调用的错误处理和状态管理
 */
export const useTauriCommand = <TArgs extends any[], TResult = any>(
  command: string,
  options?: {
    onSuccess?: (result: TResult) => void
    onError?: (error: any) => void
    immediate?: boolean
  }
) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)
  const [result, setResult] = useState<TResult | null>(null)
  
  const execute = useCallback(
    async (...args: TArgs) => {
      if (!isInTauri()) {
        const error = new Error('Tauri command called outside Tauri environment')
        setError(error)
        options?.onError?.(error)
        return null
      }
      
      setLoading(true)
      setError(null)
      
      try {
        const { invoke } = await import('@tauri-apps/api/tauri')
        const commandResult = await invoke<TResult>(command, args[0] || {})
        
        setResult(commandResult)
        setLoading(false)
        options?.onSuccess?.(commandResult)
        
        return commandResult
      } catch (err) {
        setError(err)
        setLoading(false)
        options?.onError?.(err)
        
        return null
      }
    },
    [command, options]
  )
  
  // 如果设置了immediate，则立即执行
  useEffect(() => {
    if (options?.immediate) {
      execute()
    }
  }, [execute, options?.immediate])
  
  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setResult(null)
  }, [])
  
  return {
    execute,
    loading,
    error,
    result,
    reset,
  }
}

/**
 * Tauri应用信息Hook
 * 统一获取应用相关信息
 */
export const useTauriAppInfo = () => {
  const [appInfo, setAppInfo] = useState<{
    name?: string
    version?: string
    tauriVersion?: string
  } | null>(null)
  
  useTauriEffect(() => {
    const getAppInfo = async () => {
      try {
        const { getName, getVersion, getTauriVersion } = await import('@tauri-apps/api/app')
        
        const [name, version, tauriVersion] = await Promise.all([
          getName(),
          getVersion(), 
          getTauriVersion(),
        ])
        
        setAppInfo({ name, version, tauriVersion })
      } catch (error) {
        console.error('Failed to get Tauri app info:', error)
      }
    }
    
    getAppInfo()
  }, [])
  
  return appInfo
}

/**
 * 环境感知组件Props类型
 * 为组件提供环境感知能力
 */
export interface EnvironmentAwareProps {
  renderInTauri?: React.ReactNode
  renderInBrowser?: React.ReactNode
  renderDefault?: React.ReactNode
}

/**
 * 环境感知Hook
 * 根据当前环境返回对应的渲染内容
 */
export const useEnvironmentAwareRender = (props: EnvironmentAwareProps) => {
  const environment = getCurrentEnvironment()
  
  switch (environment) {
    case 'tauri':
      return props.renderInTauri || props.renderDefault
    case 'browser':
      return props.renderInBrowser || props.renderDefault
    default:
      return props.renderDefault
  }
}

