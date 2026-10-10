import { useState } from 'react'
import { useServiceManager } from '@/hooks/use-service-manager'
import { Box, Divider, Stack, Tab, Tabs, Typography } from '@mui/material'
import SettingApplicationTools from './setting-application-tools'
import SettingAutoLaunch from './setting-auto-launch'
import SettingBackups from './setting-backups'
import SettingDns from './setting-dns'
import SettingProxyMode from './setting-proxy-mode'
import SettingRuntimeFields from './setting-runtime-fields'
import SettingSystemProxy from './setting-system-proxy'
import SettingSystemService from './setting-system-service'
import SettingTunMode from './setting-tun-mode'

const sections = [
  { id: 'application', title: '应用' },
  { id: 'network', title: '网络' },
  { id: 'maintenance', title: '维护' },
] as const

type SectionId = (typeof sections)[number]['id']

export default function SettingPage() {
  const serviceManager = useServiceManager()
  const [activeSection, setActiveSection] = useState<SectionId>('application')
  const manageService = () => {
    setActiveSection('maintenance')
    requestAnimationFrame(() => {
      document
        .getElementById('settings-tab-maintenance')
        ?.focus({ preventScroll: true })
      document
        .getElementById('settings-panel-maintenance')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }
  const contents = {
    application: [
      <SettingAutoLaunch key="startup" />,
      <SettingApplicationTools key="tools" />,
    ],
    network: [<SettingDns key="dns" />, <SettingRuntimeFields key="runtime" />],
    maintenance: [
      <SettingSystemService key="service" serviceManager={serviceManager} />,
      <SettingBackups key="backups" />,
    ],
  }

  return (
    <Box
      sx={{
        maxWidth: 1100,
        mx: 'auto',
        px: { xs: 0, sm: 1 },
        containerType: 'inline-size',
        '& .MuiCard-root': {
          boxShadow: 'none',
          minWidth: 0,
          border: 0,
          backgroundImage: 'none',
        },
        '& .MuiCardContent-root': { p: 2, '&:last-child': { pb: 2 } },
        '& .MuiTypography-h6': {
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.5,
        },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          alignItems: 'start',
          gap: 1.5,
          '@container (min-width: 860px)': {
            gridTemplateColumns: 'minmax(360px, 0.9fr) minmax(0, 1.1fr)',
          },
        }}
      >
        <Box
          component="section"
          aria-labelledby="daily-settings-heading"
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            borderRadius: 3,
            minWidth: 0,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ px: 2, pt: 1.5, pb: 0.5 }}
          >
            <Typography
              id="daily-settings-heading"
              component="h2"
              variant="subtitle1"
              fontWeight={700}
            >
              常用操作
            </Typography>
            <Typography variant="caption" color="text.secondary">
              即时生效
            </Typography>
          </Stack>
          <Stack divider={<Divider sx={{ mx: 1.5 }} />} spacing={0}>
            <SettingProxyMode />
            <SettingSystemProxy />
            <SettingTunMode
              serviceManager={serviceManager}
              onManageService={manageService}
            />
          </Stack>
        </Box>
        <Box
          component="section"
          aria-label="更多设置"
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={activeSection}
            onChange={(_, value: SectionId) => setActiveSection(value)}
            aria-label="设置分类"
            variant="fullWidth"
            sx={{
              minHeight: 42,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '& .MuiTab-root': { minWidth: 0, minHeight: 42, py: 1 },
            }}
          >
            {sections.map(({ id, title }) => (
              <Tab
                key={id}
                value={id}
                id={`settings-tab-${id}`}
                aria-controls={`settings-panel-${id}`}
                label={title}
              />
            ))}
          </Tabs>
          {sections.map(({ id }) => (
            <Box
              key={id}
              role="tabpanel"
              id={`settings-panel-${id}`}
              aria-labelledby={`settings-tab-${id}`}
              hidden={activeSection !== id}
              sx={{ p: 0 }}
            >
              <Stack spacing={0.5} divider={<Divider />}>
                {contents[id]}
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
