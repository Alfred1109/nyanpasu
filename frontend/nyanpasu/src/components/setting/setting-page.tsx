import { useServiceManager } from '@/hooks/use-service-manager'
import { applyDarkStyles } from '@/utils/theme'
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
        '--settings-ink': theme.palette.text.primary,
        '--settings-muted': alpha(theme.palette.text.secondary, 0.78),
        '--settings-panel-border': alpha(theme.palette.divider, 0.76),
        '--settings-panel-bg': `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
        '--settings-panel-bg-soft': `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
        '--settings-panel-shadow': `0 18px 40px ${alpha(theme.palette.common.black, 0.08)}`,
        '--settings-section-bg': `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.76)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
        '--settings-summary-title': alpha(theme.palette.text.primary, 0.68),
        '--settings-summary-default-bg': alpha(
          theme.palette.text.primary,
          0.06,
        ),
        '--settings-summary-default-border': alpha(
          theme.palette.text.primary,
          0.1,
        ),
        '--settings-summary-default-color': alpha(
          theme.palette.text.primary,
          0.76,
        ),
        ...applyDarkStyles(theme, {
          '--settings-muted': alpha(theme.palette.text.secondary, 0.84),
          '--settings-panel-border': alpha(theme.palette.divider, 0.72),
          '--settings-panel-bg': `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.94)} 0%, ${alpha(theme.palette.primary.main, 0.12)} 100%)`,
          '--settings-panel-bg-soft': `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.96)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
          '--settings-panel-shadow': `0 20px 44px ${alpha(theme.palette.common.black, 0.28)}`,
          '--settings-section-bg': `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.68)} 0%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`,
          '--settings-summary-title': alpha(theme.palette.text.primary, 0.78),
          '--settings-summary-default-bg': alpha(
            theme.palette.text.primary,
            0.1,
          ),
          '--settings-summary-default-border': alpha(
            theme.palette.text.primary,
            0.16,
          ),
          '--settings-summary-default-color': alpha(
            theme.palette.text.primary,
            0.9,
          ),
        }),
        maxWidth: 1180,
        mx: 'auto',
        px: { xs: 1, sm: 1.5, lg: 2 },
        py: { xs: 1, sm: 1.5 },
        color: 'var(--settings-ink)',
        '& .MuiCard-root': {
          color: 'var(--settings-ink)',
          border: '1px solid',
          borderColor: 'var(--settings-panel-border)',
          background: 'var(--settings-panel-bg)',
          boxShadow: 'var(--settings-panel-shadow)',
        },
        '& .MuiCardContent-root': {
          padding: theme.spacing(2),
        },
        '& .MuiCardContent-root:last-child': {
          paddingBottom: theme.spacing(2),
        },
        '& .MuiCard-root .MuiTypography-colorTextSecondary': {
          color: 'var(--settings-muted)',
        },
        '& .MuiCard-root .MuiDivider-root': {
          borderColor: 'var(--settings-panel-border)',
        },
      })}
    >
      <Box
        sx={(theme) => ({
          position: 'relative',
          overflow: 'hidden',
          mb: 2,
          borderRadius: 4,
          px: { xs: 2, sm: 2.5, md: 3 },
          py: { xs: 2, sm: 2.25, md: 2.5 },
          border: '1px solid',
          borderColor: 'var(--settings-panel-border)',
          background: `
            radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.16)} 0%, transparent 32%),
            radial-gradient(circle at bottom left, ${alpha(theme.palette.success.main, 0.14)} 0%, transparent 28%),
            linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 50%, ${alpha(theme.palette.success.main, 0.08)} 100%)
          `,
          boxShadow: `0 22px 54px ${alpha(theme.palette.common.black, 0.12)}`,
          color: 'var(--settings-ink)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(120deg, transparent 20%, ${alpha(theme.palette.common.white, 0.42)} 46%, transparent 58%)`,
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 'auto -80px -100px auto',
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: alpha(theme.palette.primary.main, 0.12),
            filter: 'blur(18px)',
          },
          ...applyDarkStyles(theme, {
            background: `
              radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.26)} 0%, transparent 34%),
              radial-gradient(circle at bottom left, ${alpha(theme.palette.success.main, 0.18)} 0%, transparent 30%),
              linear-gradient(135deg, ${alpha(theme.palette.background.default, 0.96)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 52%, ${alpha(theme.palette.background.default, 0.94)} 100%)
            `,
            boxShadow: `0 24px 56px ${alpha(theme.palette.common.black, 0.34)}`,
            '&::before': {
              background: `linear-gradient(120deg, transparent 20%, ${alpha(theme.palette.common.white, 0.1)} 46%, transparent 58%)`,
            },
            '&::after': {
              background: alpha(theme.palette.primary.main, 0.16),
            },
          }),
        })}
      >
        <Typography
          variant="overline"
          sx={(theme) => ({
            display: 'block',
            mb: 0.5,
            letterSpacing: '0.16em',
            color: alpha(theme.palette.primary.dark, 0.86),
            fontWeight: 700,
            position: 'relative',
            zIndex: 1,
            ...applyDarkStyles(theme, {
              color: alpha(theme.palette.text.primary, 0.72),
            }),
          })}
        >
          System Control Center
        </Typography>

        <Typography
          variant="h4"
          sx={{
            mb: 0.75,
            fontWeight: 800,
            fontSize: { xs: '1.55rem', md: '1.9rem' },
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
            lineHeight: 1.6,
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
            gap: 0.75,
            mt: 1.75,
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
                gap: 0.5,
                px: 1,
                py: 0.625,
                borderRadius: 999,
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.16),
                background: alpha(theme.palette.background.paper, 0.84),
                boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
                backdropFilter: 'blur(12px)',
                ...applyDarkStyles(theme, {
                  borderColor: alpha(theme.palette.primary.main, 0.24),
                  background: alpha(theme.palette.common.white, 0.06),
                  boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.22)}`,
                }),
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
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  color: 'var(--settings-ink)',
                }}
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
          gap: 1,
          mb: 2,
        }}
      >
        {summaryItems.map((item) => (
          <Box
            key={item.title}
            sx={(theme) => ({
              p: 1.25,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'var(--settings-panel-border)',
              background: 'var(--settings-panel-bg-soft)',
              boxShadow: `0 12px 28px ${alpha(theme.palette.common.black, 0.06)}`,
              backdropFilter: 'blur(10px)',
              ...applyDarkStyles(theme, {
                boxShadow: `0 14px 28px ${alpha(theme.palette.common.black, 0.22)}`,
              }),
            })}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mb: 0.75,
                color: 'var(--settings-summary-title)',
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
                    backgroundColor: alpha(theme.palette.primary.main, 0.16),
                    color: theme.palette.primary.dark,
                    borderColor: alpha(theme.palette.primary.main, 0.18),
                  },
                  success: {
                    backgroundColor: alpha(theme.palette.success.main, 0.18),
                    color: theme.palette.success.dark,
                    borderColor: alpha(theme.palette.success.main, 0.18),
                  },
                  warning: {
                    backgroundColor: alpha(theme.palette.warning.main, 0.2),
                    color: theme.palette.text.primary,
                    borderColor: alpha(theme.palette.warning.main, 0.22),
                  },
                  default: {
                    backgroundColor: 'var(--settings-summary-default-bg)',
                    color: 'var(--settings-summary-default-color)',
                    borderColor: 'var(--settings-summary-default-border)',
                  },
                }
                const darkToneMap = {
                  primary: {
                    backgroundColor: alpha(theme.palette.primary.main, 0.28),
                    color: theme.palette.primary.light,
                  },
                  success: {
                    backgroundColor: alpha(theme.palette.success.main, 0.28),
                    color: theme.palette.success.light,
                  },
                  warning: {
                    backgroundColor: alpha(theme.palette.warning.main, 0.28),
                    color: theme.palette.warning.light,
                  },
                  default: {},
                }

                return {
                  fontWeight: 800,
                  border: '1px solid',
                  ...toneMap[item.tone],
                  ...applyDarkStyles(theme, darkToneMap[item.tone]),
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
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box
          sx={(theme) => ({
            borderRadius: 3.5,
            border: '1px solid',
            borderColor: 'var(--settings-panel-border)',
            background: 'var(--settings-section-bg)',
            boxShadow: `0 14px 32px ${alpha(theme.palette.common.black, 0.05)}`,
            p: { xs: 1.25, sm: 1.5, md: 2 },
            ...applyDarkStyles(theme, {
              boxShadow: `0 16px 36px ${alpha(theme.palette.common.black, 0.22)}`,
            }),
          })}
        >
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="overline"
              sx={{ display: 'block', color: 'primary.main', fontWeight: 700 }}
            >
              {pageSections[0].eyebrow}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                mb: 0.5,
                fontWeight: 800,
                fontSize: { xs: '1.2rem', md: '1.35rem' },
              }}
            >
              {pageSections[0].title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {pageSections[0].description}
            </Typography>
          </Box>

          <Box display="grid" gap={2}>
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
                gap: 2,
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
            borderRadius: 3.5,
            border: '1px solid',
            borderColor: 'var(--settings-panel-border)',
            background: 'var(--settings-section-bg)',
            boxShadow: `0 14px 32px ${alpha(theme.palette.common.black, 0.05)}`,
            p: { xs: 1.25, sm: 1.5, md: 2 },
            ...applyDarkStyles(theme, {
              boxShadow: `0 16px 36px ${alpha(theme.palette.common.black, 0.22)}`,
            }),
          })}
        >
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="overline"
              sx={{ display: 'block', color: 'success.main', fontWeight: 700 }}
            >
              {pageSections[1].eyebrow}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                mb: 0.5,
                fontWeight: 800,
                fontSize: { xs: '1.2rem', md: '1.35rem' },
              }}
            >
              {pageSections[1].title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {pageSections[1].description}
            </Typography>
          </Box>

          <Box display="grid" gap={2}>
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
