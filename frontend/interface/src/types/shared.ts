/**
 * 共享类型定义库
 * 统一管理项目中重复的接口、类型和枚举，避免跨文件重复定义
 */

/**
 * 支持的Clash核心类型
 */
export enum SupportedClashCore {
  Clash = 'clash',
  Mihomo = 'mihomo',
  MihomoAlpha = 'mihomo-alpha',
}

/**
 * 支持的架构类型（统一从scripts/types中的定义）
 */
export enum SupportedArch {
  WindowsX86_32 = 'windows-i386',
  WindowsX86_64 = 'windows-x86_64',
  WindowsArm64 = 'windows-arm64',
  LinuxAarch64 = 'linux-aarch64',
  LinuxAmd64 = 'linux-amd64',
  LinuxI386 = 'linux-i386',
  LinuxArmv7 = 'linux-armv7',
  LinuxArmv7hf = 'linux-armv7hf',
  DarwinArm64 = 'darwin-arm64',
  DarwinX64 = 'darwin-x64',
}

/**
 * 通用的查询状态类型
 */
export type QueryStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * 通用的API响应包装器
 */
export interface ApiResponse<T> {
  status: 'ok' | 'error'
  data?: T
  error?: string
  message?: string
}

/**
 * 通用的分页信息
 */
export interface PaginationInfo {
  current: number
  pageSize: number
  total: number
  showSizeChanger?: boolean
  showQuickJumper?: boolean
}

/**
 * Clash版本信息（统一定义）
 */
export interface ClashVersion {
  premium?: boolean
  meta?: boolean
  version: string
}

/**
 * Clash延迟测试配置
 */
export interface ClashDelayOptions {
  url?: string
  timeout?: number
}

/**
 * 连接设置配置
 */
export interface ConnectionSetting {
  layout: 'table' | 'list'
}

/**
 * 通用的环境信息接口（避免重复定义）
 */
export interface BaseEnvironmentInfo {
  tauri: boolean
  browser: boolean  
  node: boolean
  current: 'tauri' | 'browser' | 'node' | 'unknown'
}

/**
 * 通用的配置更新函数类型
 */
export type ConfigUpdateFunction<T> = (update: T | ((prev: T) => T)) => void

/**
 * 通用的错误处理函数类型
 */
export type ErrorHandler = (error: Error | unknown) => void

/**
 * 通用的异步操作状态
 */
export interface AsyncOperationState<T = any> {
  loading: boolean
  error: Error | null
  data: T | null
  success: boolean
}

/**
 * 通用的表单验证规则
 */
export interface ValidationRule {
  required?: boolean
  pattern?: RegExp
  min?: number
  max?: number
  message: string
  validator?: (value: any) => boolean | Promise<boolean>
}

/**
 * 通用的选项接口
 */
export interface SelectOption<T = string> {
  label: string
  value: T
  disabled?: boolean
  description?: string
}

/**
 * 文件操作相关类型
 */
export interface FileInfo {
  name: string
  path: string
  size: number
  extension: string
  lastModified: number
}

/**
 * 通用的键值对配置
 */
export interface KeyValueConfig {
  [key: string]: string | number | boolean
}

/**
 * 第三轮冗余修复：统一的React组件通用接口模式
 */

/**
 * 通用组件Props基础接口 - 解决15+文件中重复的Props模式
 */
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

/**
 * 对话框组件通用Props - 解决8+文件中重复的对话框模式
 */
export interface BaseDialogProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
}

/**
 * 扩展对话框Props（带确认操作）
 */
export interface ConfirmDialogProps extends BaseDialogProps {
  onConfirm: () => void
  confirmText?: string
  cancelText?: string
  loading?: boolean
}

/**
 * 表单组件通用Props
 */
export interface BaseFormProps {
  disabled?: boolean
  loading?: boolean
  error?: string | null
  helperText?: string
}

/**
 * 输入组件Props - 统一输入组件的接口
 */
export interface BaseInputProps extends BaseFormProps {
  value?: string
  defaultValue?: string
  placeholder?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
}

/**
 * 按钮组件Props基础接口
 */
export interface BaseButtonProps {
  loading?: boolean
  disabled?: boolean
  variant?: 'contained' | 'outlined' | 'text'
  size?: 'small' | 'medium' | 'large'
  onClick?: () => void
}

/**
 * 列表项组件Props
 */
export interface BaseListItemProps extends BaseComponentProps {
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}

/**
 * 卡片组件Props
 */
export interface BaseCardProps extends BaseComponentProps {
  elevation?: number
  variant?: 'elevation' | 'outlined'
}

/**
 * 权限相关通用类型 - 解决权限对话框的重复模式
 */
export type PermissionType = 'tun' | 'service' | 'proxy' | 'autostart'

export interface BasePermissionDialogProps extends BaseDialogProps {
  permissionType: PermissionType
  onConfirm: () => void
}

/**
 * 服务操作相关类型
 */
export type ServiceOperation = 'install' | 'uninstall' | 'start' | 'stop' | 'restart'

export interface ServiceOperationProps {
  operation?: ServiceOperation
  loading?: boolean
  onOperationComplete?: (operation: ServiceOperation) => void
}

/**
 * 虚拟化列表通用Props
 */
export interface BaseVirtualizedListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  overscan?: number
  className?: string
}

/**
 * 配置文件相关通用Props
 */
export interface BaseProfileProps {
  profile?: any // 具体类型根据使用场景定义
  selected?: boolean
  onSelect?: () => void
}

/**
 * Monaco编辑器通用Props
 */
export interface BaseMonacoProps {
  value?: string
  onChange?: (value: string) => void
  language?: string
  theme?: 'vs' | 'vs-dark' | 'hc-black'
  readOnly?: boolean
  onValidate?: (markers: any[]) => void
}

/**
 * 统计相关通用接口
 */
export interface BaseStatisticData {
  upload: number
  download: number
  uploadSpeed?: number
  downloadSpeed?: number
}

/**
 * 连接相关通用接口
 */
export interface BaseConnectionInfo {
  id: string
  metadata: Record<string, any>
  uploadSpeed?: number
  downloadSpeed?: number
}

/**
 * 通用的内容展示Props
 */
export interface BaseContentDisplayProps extends BaseComponentProps {
  message?: string
  icon?: React.ComponentType
  action?: React.ReactNode
}

/**
 * 通用的空状态Props
 */
export interface BaseEmptyProps {
  text?: React.ReactNode
  extra?: React.ReactNode
  icon?: React.ComponentType
}

/**
 * 通用的错误边界Props
 */
export interface BaseErrorBoundaryProps {
  children?: React.ReactNode
  fallback?: React.ComponentType<{ error: Error }>
  onError?: (error: Error, errorInfo: any) => void
}

/**
 * 通用的加载状态Props
 */
export interface BaseLoadingProps {
  loading?: boolean
  size?: 'small' | 'medium' | 'large'
  text?: string
}

/**
 * 通用的通知Props
 */
export interface BaseNoticeProps {
  type?: 'success' | 'error' | 'warning' | 'info'
  message: React.ReactNode
  duration?: number
  onClose?: () => void
}

/**
 * 导出类型工具函数
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
