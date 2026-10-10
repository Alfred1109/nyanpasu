import type { DnsConfig } from '@nyanpasu/interface'

export const DNS_LIST_FIELDS = [
  'nameserver',
  'default-nameserver',
  'fallback',
  'proxy-server-nameserver',
  'direct-nameserver',
  'fake-ip-filter',
] as const

export function parseDnsDraft(
  text: string,
): { value: DnsConfig; error: null } | { value: null; error: string } {
  try {
    const value: unknown = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { value: null, error: 'DNS 配置必须是 JSON 对象。' }
    }
    const config = value as DnsConfig
    for (const key of ['enable', 'ipv6', 'use-hosts', 'respect-rules']) {
      if (
        key in config &&
        config[key] !== null &&
        typeof config[key] !== 'boolean'
      ) {
        return { value: null, error: `${key} 必须是 true 或 false。` }
      }
    }
    for (const key of DNS_LIST_FIELDS) {
      const items = config[key]
      if (
        key in config &&
        items !== null &&
        (!Array.isArray(items) ||
          items.some((item) => typeof item !== 'string' || !item.trim()))
      ) {
        return { value: null, error: `${key} 必须是非空字符串组成的数组。` }
      }
    }
    if (
      'enhanced-mode' in config &&
      config['enhanced-mode'] !== null &&
      !['fake-ip', 'redir-host'].includes(String(config['enhanced-mode']))
    ) {
      return { value: null, error: '解析模式必须为 fake-ip 或 redir-host。' }
    }
    for (const key of ['listen', 'fake-ip-range']) {
      if (
        key in config &&
        config[key] !== null &&
        typeof config[key] !== 'string'
      ) {
        return { value: null, error: `${key} 必须是字符串。` }
      }
    }
    return { value: config, error: null }
  } catch {
    return { value: null, error: 'JSON 格式不正确，请检查引号、逗号和括号。' }
  }
}

export const dnsListText = (value: unknown) =>
  Array.isArray(value) ? value.join('\n') : ''

export const parseDnsList = (value: string) => [
  ...new Set(
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
  ),
]
