import { useInterval } from 'ahooks'
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

  useInterval(async () => {
    try {
      setHealth(healthCache.current)

      setRefreshCount(refreshCount + REFRESH_SECONDS)

      if (!isInTauri) {
        healthCache.current = {
          Google: 0,
          GitHub: 0,
          BingCN: 0,
          Baidu: 0,
        }
        return
      }

      healthCache.current = {
        Google: await timing.Google(),
        GitHub: await timing.GitHub(),
        BingCN: await timing.BingCN(),
        Baidu: await timing.Baidu(),
      }
    } catch {}
  }, 1000 * REFRESH_SECONDS)

  return (
    <>
      <TimingPanel data={health} />

      <IPASNPanel refreshCount={refreshCount} />
    </>
  )
}

export default HealthPanel
