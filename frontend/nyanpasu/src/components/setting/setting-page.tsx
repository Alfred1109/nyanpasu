import { useSize } from 'ahooks'
import { useAtomValue } from 'jotai'
import { useIsAppImage } from '@/hooks/use-consts'
import { atomIsDrawerOnlyIcon } from '@/store'
import Masonry from '@mui/lab/Masonry'
import SettingClashBase from './setting-clash-base'
import SettingClashCore from './setting-clash-core'
import SettingClashExternal from './setting-clash-external'
import SettingClashField from './setting-clash-field'
import SettingClashPort from './setting-clash-port'
import SettingClashWeb from './setting-clash-web'
import SettingNyanpasuMisc from './setting-nyanpasu-misc'
import SettingNyanpasuPath from './setting-nyanpasu-path'
import SettingNyanpasuTasks from './setting-nyanpasu-tasks'
import SettingNyanpasuUI from './setting-nyanpasu-ui'
import SettingNyanpasuVersion from './setting-nyanpasu-version'
import SettingSystemBehavior from './setting-system-behavior'
import SettingSystemProxy from './setting-system-proxy'

export const SettingPage = () => {
  const isAppImage = useIsAppImage()

  const isDrawerOnlyIcon = useAtomValue(atomIsDrawerOnlyIcon)

  const size = useSize(document.documentElement)
  const width = size?.width || 0

  return (
    <Masonry
      className="w-full"
      columns={{
        xs: 1,
        sm: 1,
        md: isDrawerOnlyIcon ? 2 : width > 1000 ? 2 : 1,
        lg: 2,
        xl: 2,
      }}
      spacing={3}
      sequential
    >
      <SettingSystemProxy />

      <SettingNyanpasuUI />

      <SettingClashBase />

      <SettingClashPort />

      <SettingClashExternal />

      <SettingClashWeb />

      <SettingClashField />

      <SettingClashCore />

      <SettingSystemBehavior />

      <SettingNyanpasuTasks />

      <SettingNyanpasuMisc />

      <SettingNyanpasuPath />

      <SettingNyanpasuVersion />
    </Masonry>
  )
}

export default SettingPage
