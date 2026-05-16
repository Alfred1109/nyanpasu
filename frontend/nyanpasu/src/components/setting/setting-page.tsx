import { useServiceManager } from '@/hooks/use-service-manager'
import { Box, Stack, Typography } from '@mui/material'
import SettingAutoLaunch from './setting-auto-launch'
import SettingProxyMode from './setting-proxy-mode'
import SettingSystemProxy from './setting-system-proxy'
import SettingSystemService from './setting-system-service'
import SettingTunMode from './setting-tun-mode'

const SettingPage = () => {
  const serviceManager = useServiceManager()

  return (
    <Box p={2}>
      <Box mb={3} textAlign="center">
        <Typography variant="h5" gutterBottom>
          🎯 系统与代理设置
        </Typography>
        <Typography variant="body2" color="text.secondary">
          启动行为、代理接管、系统服务与 TUN 配置
        </Typography>
      </Box>

      <Stack spacing={3} maxWidth={700} mx="auto">
        <SettingAutoLaunch />

        <SettingSystemProxy />

        <SettingProxyMode />

        <SettingSystemService serviceManager={serviceManager} />

        <SettingTunMode serviceManager={serviceManager} />
      </Stack>
    </Box>
  )
}

export default SettingPage
