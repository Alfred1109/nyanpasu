import { Stack, Typography, Box } from '@mui/material'
import SettingSystemService from './setting-system-service'
import SettingTunMode from './setting-tun-mode'

const SettingPage = () => {
  return (
    <Box p={2}>
      <Box mb={3} textAlign="center">
        <Typography variant="h5" gutterBottom>
          🎯 系统服务管理
        </Typography>
        <Typography variant="body2" color="text.secondary">
          管理系统服务和TUN模式，享受更好的代理体验
        </Typography>
      </Box>
      
      <Stack spacing={3} maxWidth={700} mx="auto">
        {/* 系统服务管理 - 放在前面，因为TUN模式依赖于服务 */}
        <SettingSystemService />
        
        {/* TUN模式管理 */}
        <SettingTunMode />
      </Stack>
    </Box>
  )
}

export default SettingPage
