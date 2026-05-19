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

  const featureItems = [
    { icon: <AutoMode fontSize="small" />, label: '规则与模式切换' },
    { icon: <Lan fontSize="small" />, label: '系统代理接管' },
    { icon: <Shield fontSize="small" />, label: '服务模式与 TUN' },
    { icon: <RocketLaunch fontSize="small" />, label: '开机启动行为' },
  ]

  const pageSections = [
    {
      eyebrow: 'Quick Controls',
      title: '代理切换与系统接管',
      description: '日常最常用的模式切换、系统代理和启动行为集中放在一起。',
    },
    {
      eyebrow: 'System Capability',
      title: '服务能力与 TUN',
      description: '和底层权限、系统服务相关的能力单独分组，排查时更顺手。',
    },
  ] as const

  return (
    <Box
      sx={(theme) => ({
        ...(theme.palette.mode === 'dark'
          ? {
              '--settings-ink': '#ebf3ff',
              '--settings-muted': alpha('#ebf3ff', 0.72),
              '--settings-panel-border': alpha(
                theme.palette.common.white,
                0.12,
              ),
              '--settings-panel-bg': `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.94)} 0%, ${alpha(theme.palette.primary.main, 0.12)} 100%)`,
              '--settings-panel-bg-soft': `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.92)} 0%, ${alpha(theme.palette.common.white, 0.03)} 100%)`,
              '--settings-panel-shadow': `0 20px 44px ${alpha(theme.palette.common.black, 0.28)}`,
              '--settings-section-bg': `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.6)} 0%, ${alpha(theme.palette.common.black, 0.14)} 100%)`,
            }
          : {
              '--settings-ink': '#10203a',
              '--settings-muted': alpha('#10203a', 0.7),
              '--settings-panel-border': alpha(
                theme.palette.common.black,
                0.08,
              ),
              '--settings-panel-bg': `linear-gradient(180deg, ${alpha('#ffffff', 0.96)} 0%, ${alpha('#f8fafc', 0.92)} 100%)`,
              '--settings-panel-bg-soft': `linear-gradient(180deg, ${alpha('#ffffff', 0.98)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              '--settings-panel-shadow': `0 18px 40px ${alpha(theme.palette.common.black, 0.08)}`,
              '--settings-section-bg': `linear-gradient(180deg, ${alpha('#ffffff', 0.72)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
            }),
        maxWidth: 1240,
        mx: 'auto',
        px: { xs: 1.5, sm: 2, lg: 3 },
        py: { xs: 1.5, sm: 2 },
        color: 'var(--settings-ink)',
        '& .MuiCard-root': {
          color: 'var(--settings-ink)',
          border: '1px solid',
          borderColor: 'var(--settings-panel-border)',
          background: 'var(--settings-panel-bg)',
          boxShadow: 'var(--settings-panel-shadow)',
        },
        '& .MuiCard-root .MuiTypography-colorTextSecondary': {
          color: 'var(--settings-muted)',
        },
        '& .MuiCard-root .MuiDivider-root': {
          borderColor: alpha(theme.palette.common.black, 0.08),
        },
      })}
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
          borderColor: 'var(--settings-panel-border)',
          background:
            theme.palette.mode === 'dark'
              ? `
                radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.26)} 0%, transparent 34%),
                radial-gradient(circle at bottom left, ${alpha(theme.palette.success.main, 0.18)} 0%, transparent 30%),
                linear-gradient(135deg, ${alpha('#122033', 0.94)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 52%, ${alpha('#10211f', 0.92)} 100%)
              `
              : `
                radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.16)} 0%, transparent 32%),
                radial-gradient(circle at bottom left, ${alpha(theme.palette.success.main, 0.14)} 0%, transparent 28%),
                linear-gradient(135deg, ${alpha('#e8f1ff', 0.95)} 0%, ${alpha('#f8fafc', 0.98)} 50%, ${alpha('#ecfdf5', 0.94)} 100%)
              `,
          boxShadow:
            theme.palette.mode === 'dark'
              ? `0 24px 56px ${alpha(theme.palette.common.black, 0.34)}`
              : `0 22px 54px ${alpha(theme.palette.common.black, 0.12)}`,
          color: 'var(--settings-ink)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(120deg, transparent 20%, ${alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.1 : 0.42)} 46%, transparent 58%)`,
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 'auto -80px -100px auto',
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: alpha(
              theme.palette.primary.main,
              theme.palette.mode === 'dark' ? 0.16 : 0.12,
            ),
            filter: 'blur(18px)',
          },
        })}
      >
        <Typography
          variant="overline"
          sx={(theme) => ({
            display: 'block',
            mb: 0.75,
            letterSpacing: '0.16em',
            color:
              theme.palette.mode === 'dark'
                ? alpha('#d7e6ff', 0.7)
                : alpha('#17325c', 0.78),
            fontWeight: 700,
            position: 'relative',
            zIndex: 1,
          })}
        >
          System Control Center
        </Typography>

        <Typography
          variant="h4"
          sx={{
            mb: 1,
            fontWeight: 800,
            fontSize: { xs: '1.75rem', md: '2.1rem' },
            color: 'var(--settings-ink)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          系统与代理设置
        </Typography>

        <Typography
          variant="body1"
          sx={{
            maxWidth: 760,
            lineHeight: 1.7,
            color: 'var(--settings-muted)',
            position: 'relative',
            zIndex: 1,
          }}
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
            position: 'relative',
            zIndex: 1,
          }}
        >
          {featureItems.map((item) => (
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
                borderColor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.24 : 0.16,
                ),
                background:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.06)
                    : alpha('#ffffff', 0.84),
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? `0 10px 24px ${alpha(theme.palette.common.black, 0.22)}`
                    : `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
                backdropFilter: 'blur(12px)',
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
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: 'var(--settings-ink)' }}
              >
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
              borderColor: 'var(--settings-panel-border)',
              background: 'var(--settings-panel-bg-soft)',
              boxShadow:
                theme.palette.mode === 'dark'
                  ? `0 14px 28px ${alpha(theme.palette.common.black, 0.22)}`
                  : `0 12px 28px ${alpha(theme.palette.common.black, 0.06)}`,
            })}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mb: 1,
                color: 'var(--settings-muted)',
                fontWeight: 600,
              }}
            >
              {item.title}
            </Typography>
            <Chip
              label={item.value}
              color={item.tone}
              variant="filled"
              size="small"
              sx={(theme) => {
                const toneMap = {
                  primary: {
                    backgroundColor: alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === 'dark' ? 0.28 : 0.16,
                    ),
                    color:
                      theme.palette.mode === 'dark'
                        ? '#dce9ff'
                        : theme.palette.primary.dark,
                    borderColor: alpha(theme.palette.primary.main, 0.18),
                  },
                  success: {
                    backgroundColor: alpha(
                      theme.palette.success.main,
                      theme.palette.mode === 'dark' ? 0.28 : 0.18,
                    ),
                    color:
                      theme.palette.mode === 'dark'
                        ? '#d8ffe4'
                        : theme.palette.success.dark,
                    borderColor: alpha(theme.palette.success.main, 0.18),
                  },
                  warning: {
                    backgroundColor: alpha(
                      theme.palette.warning.main,
                      theme.palette.mode === 'dark' ? 0.28 : 0.2,
                    ),
                    color:
                      theme.palette.mode === 'dark' ? '#ffe6b5' : '#7a4b00',
                    borderColor: alpha(theme.palette.warning.main, 0.22),
                  },
                  default: {
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.08)
                        : alpha(theme.palette.common.black, 0.06),
                    color:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.8)
                        : alpha(theme.palette.common.black, 0.76),
                    borderColor:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.1)
                        : alpha(theme.palette.common.black, 0.08),
                  },
                }

                return {
                  fontWeight: 800,
                  border: '1px solid',
                  ...toneMap[item.tone],
                }
              }}
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
        <Box
          sx={(theme) => ({
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'var(--settings-panel-border)',
            background: 'var(--settings-section-bg)',
            boxShadow:
              theme.palette.mode === 'dark'
                ? `0 16px 36px ${alpha(theme.palette.common.black, 0.22)}`
                : `0 14px 32px ${alpha(theme.palette.common.black, 0.05)}`,
            p: { xs: 1.5, sm: 2, md: 2.5 },
          })}
        >
          <Box sx={{ mb: 2.5 }}>
            <Typography
              variant="overline"
              sx={{ display: 'block', color: 'primary.main', fontWeight: 700 }}
            >
              {pageSections[0].eyebrow}
            </Typography>
            <Typography variant="h5" sx={{ mb: 0.75, fontWeight: 800 }}>
              {pageSections[0].title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {pageSections[0].description}
            </Typography>
          </Box>

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
        </Box>

        <Box
          sx={(theme) => ({
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'var(--settings-panel-border)',
            background: 'var(--settings-section-bg)',
            boxShadow:
              theme.palette.mode === 'dark'
                ? `0 16px 36px ${alpha(theme.palette.common.black, 0.22)}`
                : `0 14px 32px ${alpha(theme.palette.common.black, 0.05)}`,
            p: { xs: 1.5, sm: 2, md: 2.5 },
          })}
        >
          <Box sx={{ mb: 2.5 }}>
            <Typography
              variant="overline"
              sx={{ display: 'block', color: 'success.main', fontWeight: 700 }}
            >
              {pageSections[1].eyebrow}
            </Typography>
            <Typography variant="h5" sx={{ mb: 0.75, fontWeight: 800 }}>
              {pageSections[1].title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {pageSections[1].description}
            </Typography>
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
    </Box>
  )
}

export default SettingPage
