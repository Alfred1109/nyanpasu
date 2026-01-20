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
 * 导出类型工具函数
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type Required<T, K extends keyof T> = Omit<T, K> & Pick<T, K>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
