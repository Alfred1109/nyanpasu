import { useInterval, useMount } from 'ahooks'
import { useRef, useState } from 'react'
import { IS_IN_TAURI } from '@/utils/tauri'
import { timing } from '@nyanpasu/interface'
import IPASNPanel from './modules/ipasn-panel'
import TimingPanel from './modules/timing-panel'

const REFRESH_SECONDS = 5

const isInTauri = IS_IN_TAURI

const HealthPanel = () => {
  const [health, setHealth] = useState({
    Google: 0,
    GitHub: 0,
    BingCN: 0,
    Baidu: 0,
  })

  const healthCache = useRef({
    Google: 0,
    GitHub: 0,
    BingCN: 0,
    Baidu: 0,
  })

  const [refreshCount, setRefreshCount] = useState(0)

  const refreshHealth = async () => {
    try {
      setHealth(healthCache.current)

      if (!isInTauri) {
        healthCache.current = {
          Google: 0,
          GitHub: 0,
          BingCN: 0,
          Baidu: 0,
        }
        setHealth(healthCache.current)
        return
      }

      healthCache.current = {
        Google: await timing.Google(),
        GitHub: await timing.GitHub(),
        BingCN: await timing.BingCN(),
        Baidu: await timing.Baidu(),
      }

      setHealth(healthCache.current)
    } catch {}
  }

  useMount(() => {
    void refreshHealth()
  })

  useInterval(async () => {
    setRefreshCount(refreshCount + REFRESH_SECONDS)
    await refreshHealth()
  }, 1000 * REFRESH_SECONDS)

  return (
    <>
      <TimingPanel data={health} />

      <IPASNPanel refreshCount={refreshCount} />
    </>
  )
}

export default HealthPanel
