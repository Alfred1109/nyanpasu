import { useServiceManager } from '@/hooks/use-service-manager'
import { getThemePaletteTokens, tokenAlpha } from '@/utils/theme'
import { AutoMode, Lan, RocketLaunch, Shield } from '@mui/icons-material'
import { Box, Chip, Typography } from '@mui/material'
import { useProxyMode, useSetting } from '@nyanpasu/interface'
import SettingAutoLaunch from './setting-auto-launch'
import SettingProxyMode from './setting-proxy-mode'
import { getOnOffLabel, getTakeoverLabel } from './setting-status'
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
      value: getTakeoverLabel(Boolean(systemProxy.value)),
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
      value: getOnOffLabel(Boolean(tunMode.value)),
      tone: tunMode.value ? ('success' as const) : ('default' as const),
    },
    {
      title: '开机启动',
      value: getOnOffLabel(Boolean(autoLaunch.value)),
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
      eyebrow: '常用控制',
      title: '代理切换与系统接管',
      description: '把常用切换集中在一起，减少来回查找。',
    },
    {
      eyebrow: '服务与权限',
      title: '服务能力与 TUN',
      description: '把服务和权限单独归组，排查时更直接。',
    },
  ] as const

  return (
    <Box
      sx={(theme) => ({
        ...(() => {
          const tokens = getThemePaletteTokens(theme)

          return {
            '--settings-ink': tokens.text.primary,
            '--settings-muted': tokenAlpha(tokens.text.secondary, 0.82),
            '--settings-panel-border': tokenAlpha(tokens.divider, 0.78),
            '--settings-panel-bg': tokenAlpha(tokens.background.paper, 0.96),
            '--settings-panel-bg-soft': tokenAlpha(
              tokens.background.paper,
              0.9,
            ),
            '--settings-panel-shadow': `0 18px 40px ${tokenAlpha(tokens.text.primary, 0.1)}`,
            '--settings-section-bg': tokenAlpha(tokens.background.paper, 0.76),
            '--settings-summary-title': tokenAlpha(tokens.text.primary, 0.72),
            '--settings-summary-default-bg': tokenAlpha(
              tokens.text.primary,
              0.08,
            ),
            '--settings-summary-default-border': tokenAlpha(
              tokens.text.primary,
              0.14,
            ),
            '--settings-summary-default-color': tokenAlpha(
              tokens.text.primary,
              0.82,
            ),
          }
        })(),
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
          ...(() => {
            const tokens = getThemePaletteTokens(theme)

            return {
              backgroundColor: tokenAlpha(tokens.background.paper, 0.98),
              boxShadow: `0 22px 54px ${tokenAlpha(tokens.text.primary, 0.12)}`,
            }
          })(),
          position: 'relative',
          overflow: 'hidden',
          mb: 1.5,
          borderRadius: 4,
          px: { xs: 1.75, sm: 2.25, md: 2.75 },
          py: { xs: 1.5, sm: 1.75, md: 2 },
          border: '1px solid',
          borderColor: 'var(--settings-panel-border)',
          color: 'var(--settings-ink)',
        })}
      >
        <Typography
          variant="overline"
          sx={(theme) => ({
            display: 'block',
            mb: 0.25,
            letterSpacing: '0.16em',
            color: tokenAlpha(getThemePaletteTokens(theme).primary.main, 0.88),
            fontWeight: 700,
            position: 'relative',
            zIndex: 1,
          })}
        >
          设置总览
        </Typography>

        <Typography
          variant="h4"
          sx={{
            mb: 0.5,
            fontWeight: 800,
            fontSize: { xs: '1.4rem', md: '1.7rem' },
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
            maxWidth: 700,
            lineHeight: 1.55,
            fontSize: { xs: '0.9375rem', md: '1rem' },
            color: 'var(--settings-muted)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          把代理切换、系统接管、服务模式和 TUN
          集中到一页，关键状态一眼就能看清。
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
            mt: 1.25,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {featureItems.map((item) => (
            <Box
              key={item.label}
              sx={(theme) => ({
                ...(() => {
                  const tokens = getThemePaletteTokens(theme)

                  return {
                    borderColor: tokenAlpha(tokens.primary.main, 0.2),
                    background: tokenAlpha(tokens.background.paper, 0.78),
                    boxShadow: `0 10px 24px ${tokenAlpha(tokens.text.primary, 0.08)}`,
                  }
                })(),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.625,
                borderRadius: 999,
                border: '1px solid',
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
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(5, minmax(0, 1fr))',
          },
          gap: 1,
          mb: 1.5,
        }}
      >
        {summaryItems.map((item) => (
          <Box
            key={item.title}
            sx={(theme) => ({
              ...(() => {
                const tokens = getThemePaletteTokens(theme)

                return {
                  boxShadow: `0 12px 28px ${tokenAlpha(tokens.text.primary, 0.08)}`,
                }
              })(),
              p: 1.25,
              minHeight: 86,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'var(--settings-panel-border)',
              background: 'var(--settings-panel-bg-soft)',
              backdropFilter: 'blur(10px)',
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
                const tokens = getThemePaletteTokens(theme)
                const toneMap = {
                  primary: {
                    backgroundColor: tokenAlpha(tokens.primary.main, 0.18),
                    color: tokens.text.primary,
                    borderColor: tokenAlpha(tokens.primary.main, 0.22),
                  },
                  success: {
                    backgroundColor: tokenAlpha(tokens.success.main, 0.2),
                    color: tokens.text.primary,
                    borderColor: tokenAlpha(tokens.success.main, 0.22),
                  },
                  warning: {
                    backgroundColor: tokenAlpha(tokens.warning.main, 0.22),
                    color: tokens.text.primary,
                    borderColor: tokenAlpha(tokens.warning.main, 0.24),
                  },
                  default: {
                    backgroundColor: 'var(--settings-summary-default-bg)',
                    color: 'var(--settings-summary-default-color)',
                    borderColor: 'var(--settings-summary-default-border)',
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
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box
          sx={(theme) => ({
            p: { xs: 0, sm: 0 },
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
            p: { xs: 0, sm: 0 },
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
