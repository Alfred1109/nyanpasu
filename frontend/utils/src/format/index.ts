/**
 * Error formatting utility
 */
export function formatError(err: unknown): string {
  return `Error: ${err instanceof Error ? err.message : String(err)}`
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
