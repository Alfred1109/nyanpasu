import { Stack, Typography, Box } from '@mui/material'
import SettingSystemService from './setting-system-service'
import SettingSystemProxy from './setting-system-proxy'

const SettingPage = () => {
  return (
    <Box p={2}>
      <Box mb={3} textAlign="center">
        <Typography variant="h5" gutterBottom>
          🎯 核心设置
        </Typography>
        <Typography variant="body2" color="text.secondary">
          简化版本，只保留最重要的功能
        </Typography>
      </Box>
      
      <Stack spacing={3} maxWidth={600} mx="auto">
        <SettingSystemService />
        <SettingSystemProxy />
      </Stack>
    </Box>
  )
}

export default SettingPage
