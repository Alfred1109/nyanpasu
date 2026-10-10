import { useState } from 'react'
import {
  Backup,
  CheckCircleOutline,
  ErrorOutline,
  ExpandLess,
  ExpandMore,
  FolderOpen,
  Refresh,
  VerifiedUser,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Stack,
  Typography,
} from '@mui/material'
import { useBackups } from '@nyanpasu/interface'
import { isInTauri } from '@nyanpasu/utils'

const formatDate = (value: string) => {
  if (!value) return '时间未知'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const SettingBackups = () => {
  const desktop = isInTauri()
  const backups = useBackups()
  const [showAllBackups, setShowAllBackups] = useState(false)
  const [showRestoreGuide, setShowRestoreGuide] = useState(false)
  const items = backups.query.data ?? []
  const visibleItems = showAllBackups ? items : items.slice(0, 2)
  const latest = items[0]
  const error =
    backups.create.error ??
    backups.query.error ??
    backups.openDirectory.error ??
    backups.verify.error

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.25}>
          <Box>
            <Stack alignItems="flex-start" gap={0.75}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Backup color="primary" />
                <Typography variant="subtitle1" fontWeight={750}>
                  配置备份
                </Typography>
              </Stack>
              {latest && (
                <Chip
                  size="small"
                  icon={latest.valid ? <VerifiedUser /> : <ErrorOutline />}
                  label={latest.valid ? '最近备份校验通过' : '最近备份异常'}
                  color={latest.valid ? 'success' : 'error'}
                  variant="outlined"
                />
              )}
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block', overflowWrap: 'anywhere' }}
            >
              包含应用配置、订阅与本地持久数据；迁移前会自动创建并校验备份。
            </Typography>
          </Box>

          {!desktop && (
            <Alert severity="info">
              备份功能仅在桌面应用中可用；浏览器预览不会读取或创建本地备份。
            </Alert>
          )}

          {error && (
            <Alert severity="error">
              {error instanceof Error ? error.message : String(error)}
            </Alert>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              startIcon={
                backups.create.isPending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <Backup />
                )
              }
              disabled={!desktop || backups.create.isPending}
              onClick={() => backups.create.mutate()}
            >
              立即备份
            </Button>
            <Button
              variant="outlined"
              startIcon={<FolderOpen />}
              disabled={!desktop || backups.openDirectory.isPending}
              onClick={() => backups.openDirectory.mutate()}
            >
              打开备份目录
            </Button>
            <Button
              variant="text"
              startIcon={
                backups.query.isFetching ? (
                  <CircularProgress size={16} />
                ) : (
                  <Refresh />
                )
              }
              disabled={!desktop || backups.query.isFetching}
              onClick={async () => {
                await backups.query.refetch()
              }}
            >
              刷新
            </Button>
          </Stack>

          {!desktop ? null : backups.query.isLoading ? (
            <Box display="flex" justifyContent="center" py={1}>
              <CircularProgress size={22} />
            </Box>
          ) : items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              暂无备份，可手动创建；迁移前也会自动备份。
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {visibleItems.map((item) => (
                <Box
                  key={item.name}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      sm: 'minmax(0, 1fr) auto',
                    },
                    alignItems: 'center',
                    gap: 1,
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={650}>
                      {item.kind === 'migration'
                        ? '迁移前自动备份'
                        : '手动备份'}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ minWidth: 0, mt: 0.25 }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {formatDate(item.created_at)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.file_count} 个文件
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        v{item.app_version}
                      </Typography>
                    </Stack>
                    {!item.valid && item.validation_error && (
                      <Typography
                        display="block"
                        variant="caption"
                        color="error"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {item.validation_error}
                      </Typography>
                    )}
                  </Box>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent={{ xs: 'space-between', sm: 'flex-end' }}
                    spacing={0.5}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    <Chip
                      size="small"
                      icon={
                        item.valid ? <CheckCircleOutline /> : <ErrorOutline />
                      }
                      label={item.valid ? '校验通过' : '校验失败'}
                      color={item.valid ? 'success' : 'error'}
                      variant="outlined"
                    />
                    <Button
                      size="small"
                      disabled={!desktop || backups.verify.isPending}
                      onClick={() => backups.verify.mutate(item.name)}
                    >
                      重新校验
                    </Button>
                  </Stack>
                </Box>
              ))}
              {items.length > 2 && (
                <Button
                  size="small"
                  onClick={() => setShowAllBackups((current) => !current)}
                  endIcon={showAllBackups ? <ExpandLess /> : <ExpandMore />}
                  sx={{ alignSelf: 'flex-start', px: 0.5 }}
                >
                  {showAllBackups
                    ? '收起备份记录'
                    : `查看全部备份（${items.length}）`}
                </Button>
              )}
            </Stack>
          )}

          <Box>
            <Button
              size="small"
              onClick={() => setShowRestoreGuide((current) => !current)}
              endIcon={showRestoreGuide ? <ExpandLess /> : <ExpandMore />}
              aria-expanded={showRestoreGuide}
              sx={{ px: 0.5 }}
            >
              离线恢复说明
            </Button>
            <Collapse in={showRestoreGuide} unmountOnExit>
              <Alert
                severity="info"
                variant="outlined"
                sx={{
                  mt: 0.5,
                  '& .MuiAlert-message': {
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                  },
                }}
              >
                离线恢复：先退出应用；将备份中的 config
                文件夹内容复制回应用配置目录；如果备份含有
                data/storage.db，再替换应用数据目录中的
                storage.db；然后重新启动应用。恢复前请先将现有配置和数据另行改名保存。
              </Alert>
            </Collapse>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default SettingBackups
