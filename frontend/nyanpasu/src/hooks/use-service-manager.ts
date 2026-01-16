import { useCallback, useState } from 'react'
import { restartSidecar, useSystemService } from '@nyanpasu/interface'

export enum InstallStage {
  PREPARING = 'preparing',
  WAITING_UAC = 'waiting_uac',
  INSTALLING = 'installing',
  VERIFYING = 'verifying',
  STARTING = 'starting',
  CONFIGURING = 'configuring',
}

export interface ServiceInstallOptions {
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
}

export interface ServiceManagerState {
  /**
   * 是否正在进行服务安装/卸载操作
   */
  isInstalling: boolean
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
}

export interface ServiceManagerActions {
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
   * 取消当前的安装操作
   */
  cancelInstallation: () => void
}

export interface UseServiceManagerReturn
  extends ServiceManagerState, ServiceManagerActions {
  /**
   * 原始的 useSystemService query 对象
   */
  query: ReturnType<typeof useSystemService>['query']
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
  const { query, upsert } = useSystemService()
  const [isInstalling, setIsInstalling] = useState(false)
  const [installStage, setInstallStage] = useState<InstallStage | null>(null)
  const [canCancel, setCanCancel] = useState(false)
  const [cancelRequested, setCancelRequested] = useState(false)

  /**
   * 等待服务安装完成
   * 统一的轮询逻辑，可配置超时时间
   *
   * @param maxSeconds 最大等待秒数，默认 40 秒
   * @returns Promise<boolean> 是否安装成功
   */
  const waitForInstallation = useCallback(
    async (maxSeconds: number = 40): Promise<boolean> => {
      for (let i = 0; i < maxSeconds; i++) {
        if (cancelRequested) {
          console.log('Installation wait cancelled by user')
          return false
        }

        await new Promise((resolve) => setTimeout(resolve, 1000))
        const result = await query.refetch()

        if (result.data?.status !== 'not_installed') {
          console.log(`Service installation verified after ${i + 1}s`)
          return true
        }

        // 每 5 秒输出一次等待日志
        if ((i + 1) % 5 === 0) {
          console.log(
            `Still waiting for service installation... (${i + 1}/${maxSeconds}s)`,
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
    async (options: ServiceInstallOptions = {}): Promise<boolean> => {
      const { autoStart = false, onConfigureProxy, onConfigureTun } = options

      setIsInstalling(true)
      setCancelRequested(false)

      try {
        // Stage 1: Preparing
        setInstallStage(InstallStage.PREPARING)
        await new Promise((resolve) => setTimeout(resolve, 800))
        if (cancelRequested) {
          console.log('Installation cancelled at PREPARING stage')
          return false
        }

        // Stage 2: Waiting for UAC
        setInstallStage(InstallStage.WAITING_UAC)
        setCanCancel(true)
        await upsert.mutateAsync('install')
        if (cancelRequested) {
          console.log('Installation cancelled at WAITING_UAC stage')
          return false
        }
        setCanCancel(false)

        // Stage 3: Installing
        setInstallStage(InstallStage.INSTALLING)
        if (cancelRequested) {
          console.log('Installation cancelled at INSTALLING stage')
          return false
        }

        // Stage 4: Verifying
        setInstallStage(InstallStage.VERIFYING)
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
            console.log('Installation cancelled at STARTING stage')
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
        console.log('Service installation completed successfully')
        return true
      } catch (error) {
        console.error('Service installation failed:', error)
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
    setIsInstalling(true)
    setInstallStage(InstallStage.INSTALLING) // Reuse installing stage for uninstall

    try {
      await upsert.mutateAsync('uninstall')
      await restartSidecar()
      await query.refetch()
      console.log('Service uninstalled successfully')
      return true
    } catch (error) {
      console.error('Service uninstallation failed:', error)
      throw error
    } finally {
      setIsInstalling(false)
      setInstallStage(null)
    }
  }, [upsert, query])

  /**
   * 取消安装
   */
  const cancelInstallation = useCallback(() => {
    console.log('Cancelling installation...')
    setCancelRequested(true)
    setCanCancel(false)
  }, [])

  return {
    // State
    isInstalling,
    installStage,
    canCancel,
    serviceStatus: query.data?.status,
    isServiceInstalled:
      !!query.data?.status && query.data.status !== 'not_installed',

    // Methods
    installService,
    uninstallService,
    cancelInstallation,

    // Query
    query,
  }
}
