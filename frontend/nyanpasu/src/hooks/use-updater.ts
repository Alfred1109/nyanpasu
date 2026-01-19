import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { OS } from '@/consts'
import { UpdaterIgnoredAtom, UpdaterInstanceAtom } from '@/store/updater'
import { commands, unwrapResult, useSetting } from '@nyanpasu/interface'
import { Update } from '@tauri-apps/plugin-updater'
import { useIsAppImage } from './use-consts'

export function useUpdaterPlatformSupported() {
  const [supported, setSupported] = useState(false)
  const isAppImage = useIsAppImage()
  useEffect(() => {
    switch (OS) {
      case 'macos':
      case 'windows':
        setSupported(true)
        break
      case 'linux':
        setSupported(!!isAppImage.data)
        break
    }
  }, [isAppImage.data])
  return supported
}

export async function checkUpdate() {
  // The generated interface typings currently lack checkUpdate, so fall back to any
  const metadata = unwrapResult(
    await (commands as any).checkUpdate(),
  ) as any /* eslint-disable-line @typescript-eslint/no-explicit-any */

  if (!metadata) return null

  return new Update({
    rid: metadata.rid,
    currentVersion: metadata.current_version,
    version: metadata.version,
    rawJson: metadata.raw_json as Record<string, unknown>,
  })
}

export function useUpdater() {
  const { value: enableAutoCheckUpdate } = useSetting(
    'enable_auto_check_update',
  )
  const updaterIgnored = useAtomValue(UpdaterIgnoredAtom)
  const setUpdaterInstance = useSetAtom(UpdaterInstanceAtom)
  const isPlatformSupported = useUpdaterPlatformSupported()

  useEffect(() => {
    const run = async () => {
      if (enableAutoCheckUpdate && isPlatformSupported) {
        const updater = await checkUpdate()
        if (updater && updaterIgnored !== updater.version) {
          setUpdaterInstance(updater)
        }
      }
    }
    run().catch(console.error)
  }, [
    isPlatformSupported,
    enableAutoCheckUpdate,
    setUpdaterInstance,
    updaterIgnored,
  ])
}

export const UpdaterProvider = () => {
  useUpdater()

  return null
}
