import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands, restartSidecar, type StatusInfo } from '@nyanpasu/interface'
import type { ServiceOperation } from '@/components/setting/modules/service-install-dialog'
import { IS_IN_TAURI } from '@/utils/tauri'

export enum InstallStage {
  PREPARING = 'preparing',
  INSTALLING = 'installing',
  VERIFYING = 'verifying',
  STARTING = 'starting',
  CONFIGURING = 'configuring',
}

interface ServiceInstallOptions {
  /**
   * 是否在安装后自动启动服务
   */
  autoStart?: boolean
  /**
   * 安装并启动后，配置系统代理的回调
   */
  onConfigureProxy?: () => Promise<void>
  /**
   * 安装并启动后，配置 TUN 模式的回调
   */
  onConfigureTun?: () => Promise<void>
  /**
   * 覆盖当前操作类型（用于仅启动场景，避免 UI 显示为“安装”）
   */
  operation?: ServiceOperation
}

interface ServiceManagerState {
  /**
   * 是否正在进行服务安装/卸载操作
   */
  isInstalling: boolean
  /**
   * 当前操作类型
   */
  currentOperation: 'install' | 'uninstall' | 'start' | 'stop' | 'restart' | null
  /**
   * 当前安装阶段
   */
  installStage: InstallStage | null
  /**
   * 当前阶段是否可以取消
   */
  canCancel: boolean
  /**
   * 服务状态
   */
  serviceStatus?: string
  /**
   * 服务是否已安装
   */
  isServiceInstalled: boolean
  /**
   * 最近一次操作的错误信息（用于前端展示）
   */
  lastError?: string
}

interface ServiceManagerActions {
  /**
   * 安装服务（统一流程）
   * @param options 安装选项
   * @returns Promise<boolean> 是否安装成功
   */
  installService: (options?: ServiceInstallOptions) => Promise<boolean>
  /**
   * 卸载服务
   * @returns Promise<boolean> 是否卸载成功
   */
  uninstallService: () => Promise<boolean>
  /**
   * 停止服务
   * @returns Promise<boolean> 是否停止成功
   */
  stopService: () => Promise<boolean>
  /**
   * 启动服务（不触发安装流程）
   * @returns Promise<boolean> 是否启动成功
   */
  startService: () => Promise<boolean>
  /**
   * 取消当前的安装操作
   */
  cancelInstallation: () => void
}

interface UseServiceManagerReturn
  extends ServiceManagerState, ServiceManagerActions {
  /**
   * 服务状态查询对象
   */
  query: ReturnType<typeof useQuery<StatusInfo>>
}

/**
 * 统一的服务管理 Hook
 *
 * 提供统一的服务安装、卸载流程，避免在多个组件中重复实现相同的逻辑
 *
 * @example
 * ```tsx
 * const serviceManager = useServiceManager()
 *
 * // 安装服务并启动
 * await serviceManager.installService({
 *   autoStart: true,
 *   onConfigureProxy: async () => {
 *     await toggleSystemProxy()
 *   }
 * })
 *
 * // 卸载服务
 * await serviceManager.uninstallService()
 * ```
 */
export const useServiceManager = (): UseServiceManagerReturn => {
  const queryClient = useQueryClient()
  const isInTauri = IS_IN_TAURI
  const isBrowser = typeof window !== 'undefined'

  // Operation tracking state
  const [currentOperation, setCurrentOperation] = useState<'install' | 'uninstall' | 'start' | 'stop' | 'restart' | null>(null)

  const unwrap = <T, E>(
    res: { status: 'ok'; data: T } | { status: 'error'; error: E },
  ) => {
    if (res.status === 'error') {
      throw res.error
    }
    return res.data
  }

  // Direct service status query implementation
  const query = useQuery<StatusInfo>({
    queryKey: ['system-service'],
    enabled: isInTauri || isBrowser,
    queryFn: async () => {
      if (!isInTauri) {
        try {
          const res = await fetch('/__local_api/service/status', {
            cache: 'no-store',
          })
          if (!res.ok) {
            console.warn(`Local API failed with status: ${res.status}`)
            return {
              name: '',
              version: '',
              status: 'not_installed' as const,
              server: null,
            }
          }
          const data = (await res.json()) as {
            status?: 'running' | 'stopped' | 'not_installed'
            version?: string
          }
          const status = data.status ?? 'not_installed'
          return {
            name: '',
            version: data.version ?? '',
            status: status as 'running' | 'stopped' | 'not_installed',
            server: null,
          }
        } catch (error) {
          console.warn(
            'Failed to query local API, treating as not_installed:',
            error,
          )
          return {
            name: '',
            version: '',
            status: 'not_installed' as const,
            server: null,
          }
        }
      }

      try {
        const result = await commands.serviceStatus()
        if (result.status === 'error') {
          console.warn('Service status command returned error:', result.error)
          return {
            name: '',
            version: '',
            status: 'not_installed' as const,
            server: null,
          }
        }
        return result.data
      } catch (error) {
        console.warn('Service status command failed:', error)
        const message = String(error).toLowerCase()

        console.debug('Service appears not installed:', message)
        return {
          name: '',
          version: '',
          status: 'not_installed' as const,
          server: null,
        }
      }
    },
    refetchInterval: 5000,
    // 禁用重试，避免重复错误日志
    retry: false,
    // 确保即使查询失败也不会进入error状态
    throwOnError: false,
  })

  // Direct service operations mutation implementation
  const upsert = useMutation({
    mutationFn: async (type: 'install' | 'uninstall' | 'start' | 'stop') => {
      switch (type) {
        case 'install':
          unwrap(await commands.serviceSetup())
          break

        case 'uninstall':
          unwrap(await commands.serviceUninstall())
          break

        case 'start':
          unwrap(await commands.serviceStart())
          break

        case 'stop':
          unwrap(await commands.serviceStop())
          break
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-service'] })
    },
  })

  const [isInstalling, setIsInstalling] = useState(false)
  const [installStage, setInstallStage] = useState<InstallStage | null>(null)
  const [canCancel, setCanCancel] = useState(false)
  const [cancelRequested, setCancelRequested] = useState(false)
  const [lastError, setLastError] = useState<string | undefined>(undefined)

  /**
   * 等待服务安装完成
   * 基于真实服务状态的轮询逻辑，根据状态变化更新UI阶段
   *
   * @param maxSeconds 最大等待秒数，默认 40 秒
   * @returns Promise<boolean> 是否安装成功
   */
  const waitForInstallation = useCallback(
    async (maxSeconds: number = 40): Promise<boolean> => {
      for (let i = 0; i < maxSeconds; i++) {
        if (cancelRequested) {
          console.debug('Installation wait cancelled by user')
          return false
        }

        await new Promise((resolve) => setTimeout(resolve, 1000))
        const result = await query.refetch()
        const currentStatus = result.data?.status
        console.debug(`Installation check ${i + 1}/${maxSeconds}s: status = ${currentStatus}`)

        // 根据真实状态更新UI阶段
        if (currentStatus === 'not_installed') {
          // 服务仍未安装，可能还在安装过程中
          if (i < 5) {
            setInstallStage(InstallStage.INSTALLING)
          } else if (i < 15) {
            setInstallStage(InstallStage.VERIFYING)
          }
        } else if (currentStatus === 'stopped') {
          // 服务已安装但未运行
          console.debug(`Service installation verified after ${i + 1}s`)
          setInstallStage(InstallStage.VERIFYING)
          return true
        } else if (currentStatus === 'running') {
          // 服务已安装并运行
          console.debug(`Service installation and startup verified after ${i + 1}s`)
          return true
        }

        // 每 5 秒输出一次等待日志
        if ((i + 1) % 5 === 0) {
          console.debug(
            `Waiting for service installation... (${i + 1}/${maxSeconds}s), status: ${currentStatus}`,
          )
        }
      }
      console.error('Service installation timeout')
      return false
    },
    [query, cancelRequested],
  )

  /**
   * 安装服务（统一流程）
   */
  const installService = useCallback(
    async (options: ServiceInstallOptions = {}) => {
      const { autoStart, onConfigureProxy, onConfigureTun, operation } = options
      const op: ServiceOperation = operation ?? (autoStart ? 'start' : 'install')
      console.debug('Starting service installation')
      setCurrentOperation(op)
      setIsInstalling(true)
      setInstallStage(InstallStage.PREPARING)
      setCanCancel(true)
      setLastError(undefined)

      try {
        // Stage 1: Preparing
        setInstallStage(InstallStage.PREPARING)
        if (cancelRequested) {
          console.debug('Installation cancelled at PREPARING stage')
          return false
        }

        // Stage 2: Installing (app is already running elevated)
        setInstallStage(InstallStage.INSTALLING)
        setCanCancel(true)
        try {
          await upsert.mutateAsync('install')
        } catch (error) {
          console.error('Service install command failed:', error)
          throw error
        }
        if (cancelRequested) {
          console.debug('Installation cancelled at INSTALLING stage')
          return false
        }
        setCanCancel(false)

        // Stage 4: Verifying - waitForInstallation 会根据真实状态更新阶段
        const installed = await waitForInstallation(40)
        if (!installed) {
          throw new Error('service_not_installed')
        }

        // Restart sidecar after installation
        await restartSidecar()

        // Stage 5: Starting (optional)
        if (autoStart) {
          setInstallStage(InstallStage.STARTING)
          await upsert.mutateAsync('start')
          await restartSidecar()
          if (cancelRequested) {
            console.debug('Installation cancelled at STARTING stage')
            return false
          }

          // Stage 6: Configuring (optional)
          if (onConfigureProxy || onConfigureTun) {
            setInstallStage(InstallStage.CONFIGURING)
            if (onConfigureProxy) {
              await onConfigureProxy()
            }
            if (onConfigureTun) {
              await onConfigureTun()
            }
          }
        }

        await query.refetch()
        console.debug('Service installation completed successfully')
        return true
      } catch (error) {
        console.error('Service installation failed:', error)
        setLastError(error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        setIsInstalling(false)
        setInstallStage(null)
        setCanCancel(false)
        setCancelRequested(false)
      }
    },
    [upsert, query, waitForInstallation, cancelRequested],
  )

  /**
   * 卸载服务
   */
  const uninstallService = useCallback(async (): Promise<boolean> => {
    setCurrentOperation('uninstall')
    setIsInstalling(true)
    setInstallStage(InstallStage.INSTALLING) // Reuse installing stage for uninstall

    try {
      await upsert.mutateAsync('uninstall')
      await restartSidecar()
      await query.refetch()
      console.debug('Service uninstalled successfully')
      return true
    } catch (error) {
      console.error('Service uninstallation failed:', error)
      throw error
    } finally {
      setIsInstalling(false)
      setInstallStage(null)
      setCurrentOperation(null)
    }
  }, [upsert, query])

  /**
   * 启动服务（不做安装）
   */
  const startService = useCallback(async (): Promise<boolean> => {
    setCurrentOperation('start')
    setIsInstalling(true)
    setInstallStage(InstallStage.STARTING)

    try {
      await upsert.mutateAsync('start')
      await restartSidecar()
      await query.refetch()
      console.debug('Service started successfully')
      return true
    } catch (error) {
      console.error('Service start failed:', error)
      throw error
    } finally {
      setIsInstalling(false)
      setInstallStage(null)
      setCurrentOperation(null)
    }
  }, [upsert, query])

  /**
   * 停止服务
   */
  const stopService = useCallback(async (): Promise<boolean> => {
    setCurrentOperation('stop')
    setIsInstalling(true)
    setInstallStage(InstallStage.INSTALLING) // Reuse installing stage for stop

    try {
      await upsert.mutateAsync('stop')
      await restartSidecar()
      await query.refetch()
      console.debug('Service stopped successfully')
      return true
    } catch (error) {
      console.error('Service stop failed:', error)
      throw error
    } finally {
      setIsInstalling(false)
      setInstallStage(null)
      setCurrentOperation(null)
    }
  }, [upsert, query])

  /**
   * 取消安装
   */
  const cancelInstallation = useCallback(() => {
    console.debug('Cancelling installation')
    setCancelRequested(true)
    setCanCancel(false)
  }, [])

  return {
    // State
    isInstalling,
    currentOperation,
    installStage,
    canCancel,
    serviceStatus: query.data?.status,
    isServiceInstalled:
      !!query.data?.status && query.data.status !== 'not_installed',
    lastError,

    // Methods
    installService,
    uninstallService,
    stopService,
    startService,
    cancelInstallation,

    // Query
    query,
  }
}
