import { useTranslation } from 'react-i18next'
import { InstallStage } from '@/hooks/use-service-manager'
import {
  Close as CloseIcon,
  Security as SecurityIcon,
} from '@mui/icons-material'
import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material'

interface ServiceInstallDialogProps {
  /**
   * 是否显示 Dialog
   */
  open: boolean
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
 * 获取安装阶段的进度百分比
 */
const getStageProgress = (stage: InstallStage): number => {
  switch (stage) {
    case InstallStage.PREPARING:
      return 10
    case InstallStage.WAITING_UAC:
      return 25
    case InstallStage.INSTALLING:
      return 40
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
  t: (key: string) => string,
): string => {
  switch (stage) {
    case InstallStage.PREPARING:
      return t('Preparing service installation...')
    case InstallStage.WAITING_UAC:
      return t('Waiting for UAC permission confirmation')
    case InstallStage.INSTALLING:
      return t('Installing service...')
    case InstallStage.VERIFYING:
      return t('Verifying service installation...')
    case InstallStage.STARTING:
      return t('Starting service...')
    case InstallStage.CONFIGURING:
      return t('Configuring system proxy...')
    default:
      return t('Processing...')
  }
}

/**
 * 获取安装阶段的详细说明
 */
const getStageDescription = (
  stage: InstallStage,
  t: (key: string) => string,
): string => {
  switch (stage) {
    case InstallStage.WAITING_UAC:
      return t(
        "Please confirm the Windows User Account Control (UAC) permission prompt. If you don't see it, check your taskbar or other windows.",
      )
    case InstallStage.INSTALLING:
      return t('Installing the system service with administrator privileges...')
    case InstallStage.VERIFYING:
      return t(
        'Waiting for service installation to complete and verifying status. This may take 30-40 seconds on Windows...',
      )
    case InstallStage.STARTING:
      return t('Starting the service and establishing connection...')
    case InstallStage.CONFIGURING:
      return t('Applying system proxy configuration...')
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
export const ServiceInstallDialog = ({
  open,
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
            {t('Installing Service')}
          </Typography>
          {canCancel && (
            <IconButton onClick={handleCancel} size="small" aria-label="cancel">
              <CloseIcon />
            </IconButton>
          )}
        </Box>

        {/* 当前阶段描述 */}
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {installStage === InstallStage.WAITING_UAC ? (
            <SecurityIcon color="warning" sx={{ fontSize: 24 }} />
          ) : (
            <CircularProgress size={24} />
          )}
          <Typography variant="body1" color="text.primary">
            {getStageText(installStage, t)}
          </Typography>
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
        {getStageDescription(installStage, t) && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: '0.85rem', lineHeight: 1.5 }}
          >
            {getStageDescription(installStage, t)}
          </Typography>
        )}

        {/* UAC 特殊提示 */}
        {installStage === InstallStage.WAITING_UAC && (
          <Box
            mt={2}
            p={1.5}
            sx={{
              bgcolor: 'warning.main',
              color: 'warning.contrastText',
              borderRadius: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 'medium', fontSize: '0.85rem' }}
            >
              ⚠️ {t('Please check for UAC permission dialog')}
            </Typography>
          </Box>
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
              ℹ️{' '}
              {t(
                'This process may take up to 40 seconds, please be patient...',
              )}
            </Typography>
          </Box>
        )}
      </Box>
    </Dialog>
  )
}

export default ServiceInstallDialog
