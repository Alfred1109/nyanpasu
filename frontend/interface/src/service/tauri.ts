import { IPSBResponse } from '@/openapi'
import {
  commands,
  type ClashCore,
  type ClashInfo,
  type CoreState,
  type GetSysProxyResponse,
  type IVerge,
  type PatchRuntimeConfig,
  type ProfileBuilder,
  type ProfilesBuilder,
  type RemoteProfileOptionsBuilder,
  type RunType,
  type StatusInfo,
} from '../ipc/bindings'
import { unwrapResult } from '../utils'
import { ManifestVersion } from './core'
import { EnvInfos, InspectUpdater, SystemProxy, VergeConfig } from './types'

const isInTauri = typeof window !== 'undefined' && '__TAURI__' in window

export const getNyanpasuConfig = async () => {
  return unwrapResult(await commands.getVergeConfig()) as VergeConfig
}

export const patchNyanpasuConfig = async (payload: VergeConfig) => {
  return unwrapResult(await commands.patchVergeConfig(payload as IVerge))
}

export const toggleSystemProxy = async () => {
  const result = unwrapResult(await commands.toggleSystemProxy())

  // Trigger a small delay to allow backend to emit mutation event
  setTimeout(() => {
    // Force a page refresh to update UI state if needed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nyanpasu-setting-changed'))
    }
  }, 100)

  return result
}

export const toggleTunMode = async () => {
  const result = unwrapResult(await commands.toggleTunMode())

  // Trigger a small delay to allow backend to emit mutation event
  setTimeout(() => {
    // Force a page refresh to update UI state if needed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nyanpasu-setting-changed'))
    }
  }, 100)

  return result
}

export const getClashInfo = async () => {
  return (unwrapResult(await commands.getClashInfo()) as ClashInfo) ?? null
}

export const patchClashConfig = async (
  payload: Partial<PatchRuntimeConfig>,
) => {
  return unwrapResult(
    await commands.patchClashConfig(payload as PatchRuntimeConfig),
  )
}

export const getRuntimeExists = async () => {
  return unwrapResult(await commands.getRuntimeExists())
}

export const getRuntimeLogs = async () => {
  const { invoke } = await import('@tauri-apps/api/core')
  return await invoke<Record<string, [string, string][]>>('get_runtime_logs')
}

export const createProfile = async (
  item: Partial<ProfileBuilder>,
  fileData?: string | null,
) => {
  return unwrapResult(
    await commands.createProfile(item as ProfileBuilder, fileData ?? null),
  )
}

export const updateProfile = async (
  uid: string,
  option?: RemoteProfileOptionsBuilder,
) => {
  return unwrapResult(await commands.updateProfile(uid, option ?? null))
}

export const deleteProfile = async (uid: string) => {
  return unwrapResult(await commands.deleteProfile(uid))
}

export const viewProfile = async (uid: string) => {
  return unwrapResult(await commands.viewProfile(uid))
}

export const getProfiles = async () => {
  return unwrapResult(await commands.getProfiles())
}

export const setProfiles = async (payload: {
  uid: string
  profile: Partial<ProfileBuilder>
}) => {
  return unwrapResult(
    await commands.patchProfile(payload.uid, payload.profile as ProfileBuilder),
  )
}

export const setProfilesConfig = async (profiles: ProfilesBuilder) => {
  return unwrapResult(await commands.patchProfilesConfig(profiles))
}

export const readProfileFile = async (uid: string) => {
  return unwrapResult(await commands.readProfileFile(uid))
}

export const saveProfileFile = async (uid: string, fileData: string) => {
  return unwrapResult(await commands.saveProfileFile(uid, fileData))
}

export const importProfile = async (
  url: string,
  option: RemoteProfileOptionsBuilder,
) => {
  return unwrapResult(await commands.importProfile(url, option ?? null))
}

export const getCoreVersion = async (
  coreType: Required<VergeConfig>['clash_core'],
) => {
  return unwrapResult(await commands.getCoreVersion(coreType as ClashCore))
}

export const setClashCore = async (
  clashCore: Required<VergeConfig>['clash_core'],
) => {
  return unwrapResult(await commands.changeClashCore(clashCore as ClashCore))
}

export const restartSidecar = async () => {
  return unwrapResult(await commands.restartSidecar())
}

export const fetchLatestCoreVersions = async () => {
  return unwrapResult(
    await commands.fetchLatestCoreVersions(),
  ) as ManifestVersion['latest']
}

export const updateCore = async (
  coreType: Required<VergeConfig>['clash_core'],
) => {
  return unwrapResult(await commands.updateCore(coreType as ClashCore))
}

export const inspectUpdater = async (updaterId: number) => {
  return unwrapResult(
    await commands.inspectUpdater(updaterId),
  ) as unknown as InspectUpdater
}

export const pullupUWPTool = async () => {
  return unwrapResult(await commands.invokeUwpTool())
}

export const getSystemProxy = async () => {
  const res = unwrapResult(await commands.getSysProxy()) as GetSysProxyResponse
  return {
    enable: res.enable,
    server: res.server,
    bypass: res.bypass,
  } satisfies SystemProxy
}

export const statusService = async () => {
  try {
    const res = await commands.serviceStatus()
    if (res.status === 'error') {
      throw res.error
    }
    const result = res.data as StatusInfo
    return result.status
  } catch (e) {
    console.error(e)
    return 'not_installed'
  }
}

export const installService = async () => {
  const res = await commands.serviceInstall()
  if (res.status === 'error') throw res.error
  return res.data
}

export const uninstallService = async () => {
  const res = await commands.serviceUninstall()
  if (res.status === 'error') throw res.error
  return res.data
}

export const startService = async () => {
  const res = await commands.serviceStart()
  if (res.status === 'error') throw res.error
  return res.data
}

export const stopService = async () => {
  const res = await commands.serviceStop()
  if (res.status === 'error') throw res.error
  return res.data
}

export const restartService = async () => {
  const res = await commands.serviceRestart()
  if (res.status === 'error') throw res.error
  return res.data
}

export const openAppConfigDir = async () => {
  return unwrapResult(await commands.openAppConfigDir())
}

export const openAppDataDir = async () => {
  return unwrapResult(await commands.openAppDataDir())
}

export const openCoreDir = async () => {
  return unwrapResult(await commands.openCoreDir())
}

export const getCoreDir = async () => {
  if (!isInTauri) {
    return ''
  }
  return unwrapResult(await commands.getCoreDir())
}

export const openLogsDir = async () => {
  return unwrapResult(await commands.openLogsDir())
}

export const collectLogs = async () => {
  return unwrapResult(await commands.collectLogs())
}

export const setCustomAppDir = async (path: string) => {
  return unwrapResult(await commands.setCustomAppDir(path))
}

export const restartApplication = async () => {
  return unwrapResult(await commands.restartApplication())
}

export const isPortable = async () => {
  return unwrapResult(await commands.isPortable())
}

export const getProxies = async () => {
  return unwrapResult(await commands.getProxies())
}

export const mutateProxies = async () => {
  return unwrapResult(await commands.mutateProxies())
}

export const selectProxy = async (group: string, name: string) => {
  return unwrapResult(await commands.selectProxy(group, name))
}

export const updateProxyProvider = async (name: string) => {
  return unwrapResult(await commands.updateProxyProvider(name))
}

export const saveWindowSizeState = async () => {
  return unwrapResult(await commands.saveWindowSizeState())
}

export const collectEnvs = async () => {
  return unwrapResult(await commands.collectEnvs()) as unknown as EnvInfos
}

export const getRuntimeYaml = async () => {
  return unwrapResult(await commands.getRuntimeYaml())
}

export const getServerPort = async () => {
  return unwrapResult(await commands.getServerPort())
}

export const setTrayIcon = async (
  mode: 'tun' | 'system_proxy' | 'normal',
  path?: string,
) => {
  return unwrapResult(
    await commands.setTrayIcon(mode as any, path ?? null),
  )
}

export const isTrayIconSet = async (
  mode: 'tun' | 'system_proxy' | 'normal',
) => {
  return unwrapResult(await commands.isTrayIconSet(mode as any))
}

export const getCoreStatus = async () => {
  return unwrapResult(await commands.getCoreStatus()) as [
    CoreState,
    number,
    RunType,
  ]
}

export const urlDelayTest = async (url: string, expectedStatus: number) => {
  if (!isInTauri) {
    return null
  }
  return unwrapResult(await commands.urlDelayTest(url, expectedStatus))
}

export const getIpsbASN = async () => {
  if (!isInTauri) {
    return null
  }
  return unwrapResult(await commands.getIpsbAsn()) as unknown as IPSBResponse
}

export const openThat = async (path: string) => {
  return unwrapResult(await commands.openThat(path))
}

export const isAppImage = async () => {
  return unwrapResult(await commands.isAppimage())
}

export const getServiceInstallPrompt = async () => {
  if (!isInTauri) {
    return ''
  }
  return unwrapResult(await commands.getServiceInstallPrompt())
}

export const cleanupProcesses = async () => {
  return unwrapResult(await commands.cleanupProcesses())
}

export const getStorageItem = async (key: string) => {
  return unwrapResult(await commands.getStorageItem(key))
}

export const setStorageItem = async (key: string, value: string) => {
  return unwrapResult(await commands.setStorageItem(key, value))
}

export const removeStorageItem = async (key: string) => {
  return unwrapResult(await commands.removeStorageItem(key))
}

export const reorderProfilesByList = async (list: string[]) => {
  return unwrapResult(await commands.reorderProfilesByList(list))
}
