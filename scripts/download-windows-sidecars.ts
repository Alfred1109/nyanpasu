import { SIDECAR_HOST } from './utils/consts'
import { consola } from './utils/logger'
import { Resolve } from './utils/resolve'

const TARGET = 'x86_64-pc-windows-gnu'

consola.info(`Downloading Windows sidecars for target: ${TARGET}`)

if (!SIDECAR_HOST) {
  consola.error('SIDECAR_HOST not found')
  process.exit(1)
}

const resolve = new Resolve({
  platform: 'win32',
  arch: 'x64',
  sidecarHost: SIDECAR_HOST,
  force: process.argv.includes('--force'),
})

async function downloadWindowsSidecars() {
  try {
    consola.start('Downloading clash...')
    await resolve.clash()
    
    consola.start('Downloading mihomo...')
    await resolve.clashMeta()
    
    consola.start('Downloading mihomo-alpha...')
    await resolve.clashMetaAlpha()
    
    consola.start('Downloading nyanpasu-service...')
    await resolve.service()
    
    consola.success('All Windows sidecars downloaded successfully!')
  } catch (error) {
    consola.error('Failed to download Windows sidecars:', error)
    process.exit(1)
  }
}

downloadWindowsSidecars()
