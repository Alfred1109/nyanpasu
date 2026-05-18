import { useServiceManager } from '@/hooks/use-service-manager'
import { AutoMode, Lan, RocketLaunch, Shield } from '@mui/icons-material'
import { Box, Chip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useProxyMode, useSetting } from '@nyanpasu/interface'
import SettingAutoLaunch from './setting-auto-launch'
import SettingProxyMode from './setting-proxy-mode'
import SettingSystemProxy from './setting-system-proxy'
import SettingSystemService from './setting-system-service'
import SettingTunMode from './setting-tun-mode'

const SettingPage = () => {
  const serviceManager = useServiceManager()
  const { value: proxyMode } = useProxyMode()
  const autoLaunch = useSetting('enable_auto_launch')
  const systemProxy = useSetting('enable_system_proxy')
  const tunMode = useSetting('enable_tun_mode')
  const cardWrapperSx = {
    display: 'flex',
    minWidth: 0,
    '& > .MuiCard-root': {
      width: '100%',
      height: '100%',
    },
  }

  const currentMode = proxyMode.rule
    ? '规则模式'
    : proxyMode.global
      ? '全局模式'
      : '直连模式'

  const summaryItems = [
    {
      title: '当前代理模式',
      value: currentMode,
      tone: 'primary' as const,
    },
    {
      title: '系统代理',
      value: systemProxy.value ? '已接管' : '未接管',
      tone: systemProxy.value ? ('success' as const) : ('default' as const),
    },
    {
      title: '服务状态',
      value: serviceManager.serviceStatus === 'running' ? '运行中' : '待处理',
      tone:
        serviceManager.serviceStatus === 'running'
          ? ('success' as const)
          : ('warning' as const),
    },
    {
      title: 'TUN 模式',
      value: tunMode.value ? '已开启' : '未开启',
      tone: tunMode.value ? ('success' as const) : ('default' as const),
    },
    {
      title: '开机启动',
      value: autoLaunch.value ? '已启用' : '未启用',
      tone: autoLaunch.value ? ('primary' as const) : ('default' as const),
    },
  ]

  return (
    <Box
      sx={{
        maxWidth: 1240,
        mx: 'auto',
        px: { xs: 1.5, sm: 2, lg: 3 },
        py: { xs: 1.5, sm: 2 },
      }}
    >
      <Box
        sx={(theme) => ({
          position: 'relative',
          overflow: 'hidden',
          mb: 3,
          borderRadius: 5,
          px: { xs: 2.5, sm: 3, md: 4 },
          py: { xs: 2.5, sm: 3, md: 3.5 },
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.16),
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.2)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 52%, ${alpha(theme.palette.success.light, 0.14)} 100%)`,
          boxShadow: `0 18px 48px ${alpha(theme.palette.common.black, 0.08)}`,
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 'auto -80px -100px auto',
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: alpha(theme.palette.primary.main, 0.08),
            filter: 'blur(6px)',
          },
        })}
      >
        <Typography
          variant="overline"
          sx={{
            display: 'block',
            mb: 0.75,
            letterSpacing: '0.16em',
            color: 'primary.main',
            fontWeight: 700,
          }}
        >
          System Control Center
        </Typography>

        <Typography
          variant="h4"
          sx={{
            mb: 1,
            fontWeight: 800,
            fontSize: { xs: '1.75rem', md: '2.1rem' },
          }}
        >
          系统与代理设置
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: 760, lineHeight: 1.7 }}
        >
          把代理切换、系统接管、服务模式和 TUN
          能力集中到一页处理，减少来回查找，也让关键状态更容易一眼看清。
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            mt: 2.5,
          }}
        >
          {[
            { icon: <AutoMode fontSize="small" />, label: '规则与模式切换' },
            { icon: <Lan fontSize="small" />, label: '系统代理接管' },
            { icon: <Shield fontSize="small" />, label: '服务模式与 TUN' },
            { icon: <RocketLaunch fontSize="small" />, label: '开机启动行为' },
          ].map((item) => (
            <Box
              key={item.label}
              sx={(theme) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.75,
                borderRadius: 999,
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.12),
                backgroundColor: alpha(theme.palette.background.paper, 0.76),
                backdropFilter: 'blur(8px)',
              })}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  color: 'primary.main',
                }}
              >
                {item.icon}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(5, minmax(0, 1fr))',
          },
          gap: 1.5,
          mb: 3,
        }}
      >
        {summaryItems.map((item) => (
          <Box
            key={item.title}
            sx={(theme) => ({
              p: 1.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.12),
              backgroundColor: alpha(theme.palette.background.paper, 0.92),
              boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.04)}`,
            })}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 1 }}
            >
              {item.title}
            </Typography>
            <Chip
              label={item.value}
              color={item.tone}
              variant={item.tone === 'default' ? 'outlined' : 'filled'}
              size="small"
              sx={{ fontWeight: 700 }}
            />
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1.08fr) minmax(320px, 0.92fr)',
          },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box display="grid" gap={3}>
          <Box sx={cardWrapperSx}>
            <SettingProxyMode />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'repeat(2, minmax(0, 1fr))',
              },
              gap: 3,
            }}
          >
            <Box sx={cardWrapperSx}>
              <SettingSystemProxy />
            </Box>

            <Box sx={cardWrapperSx}>
              <SettingAutoLaunch />
            </Box>
          </Box>
        </Box>

        <Box display="grid" gap={3}>
          <Box sx={cardWrapperSx}>
            <SettingTunMode serviceManager={serviceManager} />
          </Box>

          <Box sx={cardWrapperSx}>
            <SettingSystemService serviceManager={serviceManager} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default SettingPage
