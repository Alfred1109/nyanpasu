import { useTranslation } from 'react-i18next'
import { InstallStage } from '@/hooks/use-service-manager'
import {
  Close as CloseIcon,
} from '@mui/icons-material'
import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material'

export type ServiceOperation = 'install' | 'uninstall' | 'start' | 'stop' | 'restart'

interface ServiceInstallDialogProps {
  /**
   * 是否显示 Dialog
   */
  open: boolean
  /**
   * 服务操作类型
   */
  operation?: ServiceOperation
  /**
   * 当前安装阶段
   */
  installStage: InstallStage | null
  /**
   * 当前阶段是否可以取消
   */
  canCancel: boolean
  /**
   * 取消按钮点击回调
   */
  handleCancel: () => void
}

/**
 * 获取操作类型的标题
 */
const getOperationTitle = (
  operation: ServiceOperation,
  t: (key: string) => string,
): string => {
  switch (operation) {
    case 'install':
      return '正在安装服务'
    case 'uninstall':
      return '正在卸载服务'
    case 'start':
      return '正在启动服务'
    case 'stop':
      return '正在停止服务'
    case 'restart':
      return '正在重启服务'
    default:
      return '服务操作'
  }
}

/**
 * 获取安装阶段的进度百分比
 */
const getStageProgress = (stage: InstallStage): number => {
  switch (stage) {
    case InstallStage.PREPARING:
      return 10
    case InstallStage.INSTALLING:
      return 30
    case InstallStage.VERIFYING:
      return 60
    case InstallStage.STARTING:
      return 80
    case InstallStage.CONFIGURING:
      return 95
    default:
      return 0
  }
}

/**
 * 获取安装阶段的文本描述
 */
const getStageText = (
  stage: InstallStage,
  operation: ServiceOperation,
  t: (key: string) => string,
): string => {
  switch (stage) {
    case InstallStage.PREPARING:
      return operation === 'uninstall' ? '准备卸载服务...' : '准备安装服务...'
    case InstallStage.INSTALLING:
      if (operation === 'uninstall') return '正在卸载服务...'
      if (operation === 'start') return '正在启动服务...'
      if (operation === 'stop') return '正在停止服务...'
      if (operation === 'restart') return '正在重启服务...'
      return '正在安装服务...'
    case InstallStage.VERIFYING:
      if (operation === 'uninstall') return '验证服务卸载状态...'
      return '验证服务安装状态...'
    case InstallStage.STARTING:
      if (operation === 'uninstall') return '清理服务配置...'
      if (operation === 'stop') return '正在停止服务...'
      if (operation === 'restart') return '正在重启服务...'
      return '正在启动服务...'
    case InstallStage.CONFIGURING:
      if (operation === 'uninstall') return '清理TUN模式配置...'
      return '配置TUN模式设置...'
    default:
      return '处理中...'
  }
}

/**
 * 获取安装阶段的详细说明
 */
const getStageDescription = (
  stage: InstallStage,
  operation: ServiceOperation,
  t: (key: string) => string,
): string => {
  switch (stage) {
    case InstallStage.INSTALLING:
      if (operation === 'uninstall') return '正在使用管理员权限卸载系统服务...'
      if (operation === 'start') return '正在使用管理员权限启动服务...'
      if (operation === 'stop') return '正在使用管理员权限停止服务...'
      if (operation === 'restart') return '正在使用管理员权限重启服务...'
      return '正在使用管理员权限安装系统服务...'
    case InstallStage.VERIFYING:
      if (operation === 'uninstall') return '等待服务卸载完成并验证状态。在 Windows 系统上这可能需要 30-40 秒...'
      return '等待服务安装完成并验证状态。在 Windows 系统上这可能需要 30-40 秒...'
    case InstallStage.STARTING:
      if (operation === 'uninstall') return '正在清理服务配置和相关文件...'
      if (operation === 'stop') return '正在停止服务进程...'
      if (operation === 'restart') return '正在重启服务并建立连接...'
      return '正在启动服务并建立连接...'
    case InstallStage.CONFIGURING:
      if (operation === 'uninstall') return '正在清理TUN模式配置...'
      return '正在应用TUN模式配置...'
    default:
      return ''
  }
}

/**
 * 服务安装进度 Dialog 组件
 *
 * 统一的服务安装进度显示组件，展示安装的各个阶段和进度
 *
 * @example
 * ```tsx
 * <ServiceInstallDialog
 *   open={serviceManager.isInstalling}
 *   installStage={serviceManager.installStage}
 *   canCancel={serviceManager.canCancel}
 *   onCancel={serviceManager.cancelInstallation}
 * />
 * ```
 */
const ServiceInstallDialog = ({
  open,
  operation = 'install',
  installStage,
  canCancel,
  handleCancel,
}: ServiceInstallDialogProps) => {
  const { t } = useTranslation()

  if (!installStage) {
    return null
  }

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      onClose={(_, reason) => {
        // 只在可以取消时允许点击背景关闭
        if (canCancel && reason === 'backdropClick') {
          handleCancel()
        }
      }}
    >
      <Box sx={{ p: 3 }}>
        {/* 标题栏 */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6" color="text.primary">
            {getOperationTitle(operation, t)}
          </Typography>
          {canCancel && (
            <IconButton onClick={handleCancel} size="small" aria-label="cancel">
              <CloseIcon />
            </IconButton>
          )}
        </Box>

        {/* 当前阶段描述 */}
        <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
          <CircularProgress size={24} sx={{ mt: 0.5 }} />
          <Box flex={1}>
            <Typography variant="body1" color="text.primary" sx={{ lineHeight: 1.4 }}>
              {getStageText(installStage, operation, t)}
            </Typography>
          </Box>
        </Box>

        {/* 进度条 */}
        <LinearProgress
          variant="determinate"
          value={getStageProgress(installStage)}
          sx={{
            mb: 2,
            height: 8,
            borderRadius: 4,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
            },
          }}
        />

        {/* 详细说明 */}
        {getStageDescription(installStage, operation, t) && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: '0.85rem', lineHeight: 1.5 }}
          >
            {getStageDescription(installStage, operation, t)}
          </Typography>
        )}

        {/* 验证阶段提示 */}
        {installStage === InstallStage.VERIFYING && (
          <Box
            mt={2}
            p={1.5}
            sx={{
              bgcolor: 'info.main',
              color: 'info.contrastText',
              borderRadius: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 'medium', fontSize: '0.85rem' }}
            >
              ℹ️ 此过程可能需要最多 40 秒，请耐心等待...
            </Typography>
          </Box>
        )}
      </Box>
    </Dialog>
  )
}

export default ServiceInstallDialog
