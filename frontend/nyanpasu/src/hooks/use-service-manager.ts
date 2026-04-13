import { useCallback, useState } from 'react'
import type { ServiceOperation } from '@/components/setting/modules/service-install-dialog'
import { IS_IN_TAURI } from '@/utils/tauri'
import {
  commands,
  type IVerge,
  type ServiceModeInfo,
  type StatusInfo,
} from '@nyanpasu/interface'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const NYANPASU_SETTING_QUERY_KEY = 'settings'

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
  currentOperation:
    | 'install'
    | 'uninstall'
    | 'start'
    | 'stop'
    | 'restart'
    | null
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
   * 服务模式配置是否启用
   */
  serviceModeEnabled: boolean
  /**
   * 服务 IPC 是否已连通
   */
  serviceConnected: boolean
  /**
   * 服务是否已安装
   */
  isServiceInstalled: boolean
  /**
   * 最近一次操作的错误信息（用于前端展示）
   */
  lastError?: string
  /**
   * 服务状态查询错误（例如 IPC 权限不足）
   */
  serviceStatusError?: string
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

export interface UseServiceManagerReturn
  extends ServiceManagerState, ServiceManagerActions {
  /**
   * 服务状态查询对象
   */
  query: ReturnType<typeof useQuery<StatusInfo>>
  /**
   * 服务连接状态查询对象
   */
  availabilityQuery: ReturnType<typeof useQuery<ServiceModeInfo>>
  /**
   * 设置查询对象
   */
  settingsQuery: ReturnType<typeof useQuery<IVerge>>
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

  const syncServiceRelatedQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['system-service'] }),
      queryClient.invalidateQueries({
        queryKey: ['service-mode-availability'],
      }),
      // Eagerly refetch settings so `enable_service_mode` is updated
      // immediately after backend-side service setup toggles it.
      queryClient.refetchQueries({
        queryKey: [NYANPASU_SETTING_QUERY_KEY],
      }),
    ])
  }, [queryClient])

  // Operation tracking state
  const [currentOperation, setCurrentOperation] = useState<
    'install' | 'uninstall' | 'start' | 'stop' | 'restart' | null
  >(null)
  const [serviceStatusError, setServiceStatusError] = useState<
    string | undefined
  >(undefined)

  const unwrap = <T, E>(
    res: { status: 'ok'; data: T } | { status: 'error'; error: E },
  ) => {
    if (res.status === 'error') {
      throw res.error
    }
    return res.data
  }

  const isPermissionDeniedError = (error: unknown) => {
    const message = String(error).toLowerCase()
    return (
      message.includes('permission denied') ||
      message.includes('os error 13') ||
      message.includes('access to the service ipc socket')
    )
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
            setServiceStatusError(undefined)
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
          setServiceStatusError(undefined)
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
          setServiceStatusError(undefined)
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
          if (isPermissionDeniedError(result.error)) {
            setServiceStatusError(
              '无法访问系统服务。请重新登录系统，或确认当前用户已获得 nyanpasu 服务组权限。',
            )
            return {
              name: '',
              version: '',
              status: 'stopped' as const,
              server: null,
            }
          }
          setServiceStatusError(undefined)
          return {
            name: '',
            version: '',
            status: 'not_installed' as const,
            server: null,
          }
        }
        setServiceStatusError(undefined)
        return result.data
      } catch (error) {
        console.warn('Service status command failed:', error)
        if (isPermissionDeniedError(error)) {
          setServiceStatusError(
            '无法访问系统服务。请重新登录系统，或确认当前用户已获得 nyanpasu 服务组权限。',
          )
          return {
            name: '',
            version: '',
            status: 'stopped' as const,
            server: null,
          }
        }

        const message = String(error).toLowerCase()
        setServiceStatusError(undefined)
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

  const availabilityQuery = useQuery<ServiceModeInfo>({
    queryKey: ['service-mode-availability'],
    enabled: isInTauri,
    queryFn: async () => {
      const result = await commands.checkServiceModeAvailability()
      return unwrap(result)
    },
    refetchInterval: 5000,
    retry: false,
    throwOnError: false,
  })

  const settingsQuery = useQuery<IVerge>({
    queryKey: [NYANPASU_SETTING_QUERY_KEY],
    enabled: isInTauri,
    queryFn: async () => {
      return unwrap(await commands.getVergeConfig())
    },
    retry: false,
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
          unwrap(await commands.serviceRemove())
          break

        case 'start':
          unwrap(await commands.serviceStart())
          break

        case 'stop':
          unwrap(await commands.serviceStop())
          break
      }
    },
    onSuccess: async () => {
      await syncServiceRelatedQueries()
    },
  })

  const [isInstalling, setIsInstalling] = useState(false)
  const [installStage, setInstallStage] = useState<InstallStage | null>(null)
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
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const result = await query.refetch()
        const currentStatus = result.data?.status
        console.debug(
          `Installation check ${i + 1}/${maxSeconds}s: status = ${currentStatus}`,
        )

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
          console.debug(
            `Service installation and startup verified after ${i + 1}s`,
          )
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
    [query],
  )

  /**
   * 等待服务 IPC 连接就绪。
   * 服务启动成功后，后端的 IPC 可用状态可能会有一个很短的传播延迟，
   * 这里主动短轮询，避免前端继续显示“TUN不可用”。
   */
  const waitForServiceConnection = useCallback(
    async (
      maxMs: number = 5000,
      intervalMs: number = 250,
    ): Promise<boolean> => {
      const attempts = Math.max(1, Math.ceil(maxMs / intervalMs))

      for (let i = 0; i < attempts; i++) {
        const [availabilityResult, serviceStatusResult] = await Promise.all([
          availabilityQuery.refetch(),
          query.refetch(),
        ])

        if (
          availabilityResult.data?.connected &&
          serviceStatusResult.data?.status === 'running'
        ) {
          console.debug(
            `Service IPC became ready after ${i * intervalMs}ms (${i + 1}/${attempts})`,
          )
          return true
        }

        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs))
        }
      }

      console.warn(
        `Service reported started but IPC was not ready within ${maxMs}ms`,
      )
      return false
    },
    [availabilityQuery, query],
  )

  /**
   * 安装服务（统一流程）
   */
  const installService = useCallback(
    async (options: ServiceInstallOptions = {}) => {
      const { autoStart, onConfigureProxy, onConfigureTun, operation } = options
      const op: ServiceOperation =
        operation ?? (autoStart ? 'start' : 'install')
      console.debug('Starting service installation')
      setCurrentOperation(op)
      setIsInstalling(true)
      setInstallStage(InstallStage.PREPARING)
      setLastError(undefined)

      try {
        // Stage 1: Preparing
        setInstallStage(InstallStage.PREPARING)

        // Stage 2: Installing (app is already running elevated)
        setInstallStage(InstallStage.INSTALLING)
        try {
          await upsert.mutateAsync('install')
        } catch (error) {
          console.error('Service install command failed:', error)
          throw error
        }

        // Stage 4: Verifying - waitForInstallation 会根据真实状态更新阶段
        const installed = await waitForInstallation(40)
        if (!installed) {
          throw new Error('service_not_installed')
        }

        // Stage 5: Starting (optional)
        if (autoStart) {
          setInstallStage(InstallStage.STARTING)
          await upsert.mutateAsync('start')
          const serviceConnected = await waitForServiceConnection()
          if (!serviceConnected) {
            throw new Error(
              '服务已启动，但 IPC 连接未在预期时间内就绪，请稍后重试或检查服务日志。',
            )
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

        await syncServiceRelatedQueries()
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
      }
    },
    [
      upsert,
      query,
      waitForInstallation,
      waitForServiceConnection,
      syncServiceRelatedQueries,
    ],
  )

  /**
   * 卸载服务
   */
  const uninstallService = useCallback(async (): Promise<boolean> => {
    setCurrentOperation('uninstall')
    setIsInstalling(true)
    setInstallStage(InstallStage.INSTALLING) // Reuse installing stage for uninstall
    setLastError(undefined)

    try {
      await upsert.mutateAsync('uninstall')
      await syncServiceRelatedQueries()
      await query.refetch()
      setLastError(undefined)
      console.debug('Service uninstalled successfully')
      return true
    } catch (error) {
      console.error('Service uninstallation failed:', error)
      setLastError(error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      setIsInstalling(false)
      setInstallStage(null)
      setCurrentOperation(null)
    }
  }, [upsert, query, syncServiceRelatedQueries])

  /**
   * 启动服务（不做安装）
   */
  const startService = useCallback(async (): Promise<boolean> => {
    setCurrentOperation('start')
    setIsInstalling(true)
    setInstallStage(InstallStage.STARTING)
    setLastError(undefined)

    try {
      await upsert.mutateAsync('start')
      const serviceConnected = await waitForServiceConnection()
      if (!serviceConnected) {
        throw new Error(
          '服务已启动，但 IPC 连接未在预期时间内就绪，请稍后重试或检查服务日志。',
        )
      }
      await syncServiceRelatedQueries()
      await query.refetch()
      setLastError(undefined)
      console.debug('Service started successfully')
      return true
    } catch (error) {
      console.error('Service start failed:', error)
      setLastError(error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      setIsInstalling(false)
      setInstallStage(null)
      setCurrentOperation(null)
    }
  }, [upsert, query, waitForServiceConnection, syncServiceRelatedQueries])

  /**
   * 停止服务
   */
  const stopService = useCallback(async (): Promise<boolean> => {
    setCurrentOperation('stop')
    setIsInstalling(true)
    setInstallStage(InstallStage.INSTALLING) // Reuse installing stage for stop
    setLastError(undefined)

    try {
      await upsert.mutateAsync('stop')
      await syncServiceRelatedQueries()
      await query.refetch()
      setLastError(undefined)
      console.debug('Service stopped successfully')
      return true
    } catch (error) {
      console.error('Service stop failed:', error)
      setLastError(error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      setIsInstalling(false)
      setInstallStage(null)
      setCurrentOperation(null)
    }
  }, [upsert, query, syncServiceRelatedQueries])

  /**
   * 取消安装
   */
  const cancelInstallation = useCallback(() => {
    console.warn('Current service operations are not cancelable once started')
  }, [])

  return {
    // State
    isInstalling,
    currentOperation,
    installStage,
    canCancel: false,
    serviceStatus: query.data?.status,
    serviceModeEnabled: Boolean(settingsQuery.data?.enable_service_mode),
    serviceConnected: availabilityQuery.data?.connected ?? false,
    isServiceInstalled:
      !!query.data?.status && query.data.status !== 'not_installed',
    lastError,
    serviceStatusError,

    // Methods
    installService,
    uninstallService,
    stopService,
    startService,
    cancelInstallation,

    // Query
    query,
    availabilityQuery,
    settingsQuery,
  }
}
