import { useTranslation } from 'react-i18next'
import LogoSvg from '@/assets/image/logo.svg?react'
import { Box, List, ListItem, Paper, Typography } from '@mui/material'
import { alpha, BaseCard } from '@nyanpasu/ui'
import { version } from '@root/package.json'

export const SettingNyanpasuVersion = () => {
  const { t } = useTranslation()

  const displayVersion = version.split('.').slice(0, 2).join('.')

  return (
    <BaseCard label={t('Nyanpasu Version')}>
      <List disablePadding>
        <ListItem sx={{ pl: 0, pr: 0 }}>
          <Paper
            elevation={0}
            sx={(theme) => ({
              mt: 1,
              padding: 2,
              backgroundColor: alpha(theme.vars.palette.primary.main, 0.1),
              borderRadius: 6,
              width: '100%',
            })}
          >
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap={2}
            >
              <LogoSvg className="h-32 w-32" />

              <Typography fontWeight={700} noWrap>
                {'nyanpasu'}&nbsp;
              </Typography>

              <Typography>
                <b>Version: </b>v{displayVersion}
              </Typography>
            </Box>
          </Paper>
        </ListItem>

        {/* 更新功能已禁用 */}
      </List>
    </BaseCard>
  )
}

export default SettingNyanpasuVersion
