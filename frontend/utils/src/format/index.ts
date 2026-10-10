/**
 * Error formatting utility
 */
export interface StructuredErrorPayload {
  code?: unknown
  message: string
  details?: unknown
}

function structuredError(value: unknown): StructuredErrorPayload | undefined {
  if (!value || typeof value !== 'object') return undefined
  const payload = value as Record<string, unknown>
  if (typeof payload.message !== 'string') return undefined
  if (typeof payload.code !== 'string' && typeof payload.details !== 'string') {
    return undefined
  }
  return {
    code: payload.code,
    message: payload.message,
    details: payload.details,
  }
}

export function formatErrorDetails(err: unknown): string {
  const structured = structuredError(err)
  if (structured) {
    const details = [
      `Code: ${typeof structured.code === 'string' ? structured.code : 'unknown'}`,
      `Message: ${structured.message}`,
      typeof structured.details === 'string' && structured.details.trim()
        ? `Details:\n${structured.details}`
        : undefined,
    ]
      .filter((line): line is string => line !== undefined)
      .join('\n')
    if (err instanceof Error && err.stack)
      return `${details}\nStack:\n${err.stack}`
    return details
  }

  if (err instanceof Error) {
    return [err.name, err.message, err.stack].filter(Boolean).join('\n')
  }
  return String(err)
}

export function formatError(err: unknown): string {
  const structured = structuredError(err)
  const rawMessage = structured
    ? structured.message
    : err instanceof Error
      ? err.message
      : String(err)

  const invalidRuleMatch = rawMessage.match(
    /rules\[(\d+)\]\s+\[([^\]]+)\]\s+error:\s+proxy\s+\[([^\]]+)\]\s+not found/i,
  )

  if (invalidRuleMatch) {
    const [, ruleIndex, ruleText, missingProxy] = invalidRuleMatch
    const hint =
      missingProxy === 'no-resolve'
        ? '这条规则很可能把 `no-resolve` 写到了策略名的位置，缺少真正的策略名。正确格式通常是 `IP-CIDR,网段,策略名,no-resolve`。'
        : `这条规则引用了不存在的策略组或代理：\`${missingProxy}\`。`

    return [
      `配置规则校验失败：第 ${Number(ruleIndex) + 1} 条规则有误。`,
      `规则内容：${ruleText}`,
      hint,
    ].join('\n')
  }

  if (structured) {
    const code =
      typeof structured.code === 'string' ? `[${structured.code}] ` : ''
    return `Error: ${code}${rawMessage}`
  }

  return `Error: ${rawMessage}`
}

interface EnvInfosInput {
  os: string
  arch: string
  core: { [key: string]: string }
  device: {
    cpu: Array<string>
    memory: string
  }
  build_info: { [key: string]: string }
}

/**
 * Environment info formatting utility
 */
export function formatEnvInfos(envs: EnvInfosInput) {
  let result = '----------- System -----------\n'
  result += `OS: ${envs.os}\n`
  result += `Arch: ${envs.arch}\n`
  result += `----------- Device -----------\n`
  for (const cpu of envs.device.cpu) {
    result += `CPU: ${cpu}\n`
  }
  result += `Memory: ${envs.device.memory}\n`
  result += `----------- Core -----------\n`
  for (const key in envs.core) {
    result += `${key}: \`${envs.core[key]}\`\n`
  }
  result += `----------- Build Info -----------\n`
  for (const k of Object.keys(envs.build_info) as string[]) {
    const key = k
      .split('_')
      .map((v) => v.charAt(0).toUpperCase() + v.slice(1))
      .join(' ')
    result += `${key}: ${envs.build_info[k]}\n`
  }
  return result
}
