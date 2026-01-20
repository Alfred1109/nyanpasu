/**
 * Tauri环境检测工具
 * 统一管理Tauri运行时环境检测逻辑，避免在多个文件中重复定义
 */

/**
 * 检测当前是否在Tauri环境中运行
 * @returns {boolean} 如果在Tauri环境中返回true，否则返回false
 */
export const isInTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * 检测是否在浏览器环境中（非Tauri）
 * @returns {boolean} 如果在浏览器环境中返回true，否则返回false
 */
export const isInBrowser = (): boolean => {
  return typeof window !== 'undefined' && !('__TAURI__' in window)
}

/**
 * 检测是否在Node.js环境中
 * @returns {boolean} 如果在Node.js环境中返回true，否则返回false
 */
export const isInNode = (): boolean => {
  return typeof process !== 'undefined' && process.versions && !!process.versions.node
}

/**
 * 获取当前运行环境的描述
 * @returns {string} 环境描述字符串
 */
export const getCurrentEnvironment = (): string => {
  if (isInTauri()) return 'tauri'
  if (isInBrowser()) return 'browser'
  if (isInNode()) return 'node'
  return 'unknown'
}

/**
 * 环境检测结果接口
 */
export interface EnvironmentInfo {
  /** 是否在Tauri环境中 */
  tauri: boolean
  /** 是否在浏览器环境中 */
  browser: boolean
  /** 是否在Node.js环境中 */
  node: boolean
  /** 当前环境类型 */
  current: 'tauri' | 'browser' | 'node' | 'unknown'
}

/**
 * 获取完整的环境检测信息
 * @returns {EnvironmentInfo} 环境信息对象
 */
export const getEnvironmentInfo = (): EnvironmentInfo => {
  return {
    tauri: isInTauri(),
    browser: isInBrowser(),
    node: isInNode(),
    current: getCurrentEnvironment() as EnvironmentInfo['current'],
  }
}
