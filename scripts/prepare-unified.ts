import { execSync } from 'child_process'
import path from 'node:path'
import fs from 'fs-extra'
import { merge } from 'lodash-es'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import {
  cwd,
  TAURI_APP_DIR,
  TAURI_FIXED_WEBVIEW2_CONFIG_OVERRIDE_PATH,
} from './utils/env'
import { consola } from './utils/logger'

const argv = yargs(hideBin(process.argv))
  .option('nightly', {
    type: 'boolean',
    default: false,
    description: 'Prepare nightly build configuration',
  })
  .option('release', {
    type: 'boolean',
    default: false,
    description: 'Prepare release build configuration',
  })
  .option('preview', {
    type: 'boolean',
    default: false,
    description: 'Prepare preview build configuration',
  })
  .option('nsis', {
    type: 'boolean',
    default: false,
    description: 'Only build NSIS installer',
  })
  .option('msi', {
    type: 'boolean',
    default: false,
    description: 'Only build MSI installer',
  })
  .option('fixed-webview', {
    type: 'boolean',
    default: false,
    description: 'Use fixed WebView2 runtime',
  })
  .option('disable-updater', {
    type: 'boolean',
    default: false,
    description: 'Disable updater artifacts generation',
  })
  .help()
  .parseSync()

// Define paths
const TAURI_APP_CONF = path.join(TAURI_APP_DIR, 'tauri.conf.json')
const TAURI_DEV_APP_OVERRIDES_PATH = path.join(
  TAURI_APP_DIR,
  'overrides/nightly.conf.json',
)
const TAURI_DEV_APP_CONF_PATH = path.join(
  TAURI_APP_DIR,
  'tauri.nightly.conf.json',
)
const TAURI_PREVIEW_APP_CONF_PATH = path.join(
  TAURI_APP_DIR,
  'tauri.preview.conf.json',
)
const ROOT_PACKAGE_JSON_PATH = path.join(cwd, 'package.json')
const NYANPASU_PACKAGE_JSON_PATH = path.join(
  cwd,
  'frontend/nyanpasu/package.json',
)

const prepareNightly = async () => {
  consola.info('Preparing nightly build configuration...')
  
  const tauriAppConf = await fs.readJSON(TAURI_APP_CONF)
  const tauriAppOverrides = await fs.readJSON(TAURI_DEV_APP_OVERRIDES_PATH)
  let tauriConf = merge(tauriAppConf, tauriAppOverrides)
  
  const packageJson = await fs.readJSON(NYANPASU_PACKAGE_JSON_PATH)
  const rootPackageJson = await fs.readJSON(ROOT_PACKAGE_JSON_PATH)

  // Apply fixed webview configuration if needed
  if (argv.fixedWebview) {
    tauriConf = await applyFixedWebviewConfig(tauriConf, true)
  }

  // Apply build target restrictions
  if (argv.nsis) {
    tauriConf.bundle.targets = ['nsis']
  }

  if (argv.disableUpdater) {
    tauriConf.bundle.createUpdaterArtifacts = false
  }

  // Get git hash and update version
  consola.debug('Get current git short hash')
  const shortHash = execSync('git rev-parse --short HEAD')
    .toString()
    .replace('\n', '')
    .replace('\r', '')
    .slice(0, 7)

  const nightlyVersion = `${tauriConf.version}-alpha+${shortHash}`
  consola.info(`Nightly version: ${nightlyVersion}`)
  
  tauriConf.version = nightlyVersion
  packageJson.version = nightlyVersion
  rootPackageJson.version = nightlyVersion

  // Write updated configurations
  await fs.writeJSON(TAURI_DEV_APP_CONF_PATH, tauriConf, { spaces: 2 })
  await fs.writeJSON(NYANPASU_PACKAGE_JSON_PATH, packageJson, { spaces: 2 })
  await fs.writeJSON(ROOT_PACKAGE_JSON_PATH, rootPackageJson, { spaces: 2 })

  consola.success('Nightly configuration prepared successfully')
}

const prepareRelease = async () => {
  consola.info('Preparing release build configuration...')
  
  const tauriAppConf = await fs.readJSON(TAURI_APP_CONF)
  let tauriConf = tauriAppConf

  // Apply fixed webview configuration if needed
  if (argv.fixedWebview) {
    tauriConf = await applyFixedWebviewConfig(tauriConf, false)
  }

  await fs.writeJSON(TAURI_APP_CONF, tauriConf, { spaces: 2 })
  consola.success('Release configuration prepared successfully')
}

const preparePreview = async () => {
  consola.info('Preparing preview build configuration...')
  
  const tauriAppConf = await fs.readJSON(TAURI_APP_CONF)
  
  // For preview, we use dist directory as dev path
  tauriAppConf.build.devPath = tauriAppConf.build.distDir
  tauriAppConf.build.beforeDevCommand = tauriAppConf.build.beforeBuildCommand

  await fs.writeJSON(TAURI_PREVIEW_APP_CONF_PATH, tauriAppConf, { spaces: 2 })
  consola.success('Preview configuration prepared successfully')
}

const applyFixedWebviewConfig = async (tauriConf: any, isNightly: boolean) => {
  consola.debug('Applying fixed WebView2 configuration...')
  
  const fixedWebview2Config = await fs.readJSON(
    TAURI_FIXED_WEBVIEW2_CONFIG_OVERRIDE_PATH,
  )
  
  const webviewPath = (await fs.readdir(TAURI_APP_DIR)).find((file) =>
    file.includes('WebView2'),
  )
  
  if (!webviewPath) {
    throw new Error('WebView2 runtime not found')
  }

  const updatedConf = merge(tauriConf, fixedWebview2Config)
  delete updatedConf.bundle.windows.webviewInstallMode.silent
  updatedConf.bundle.windows.webviewInstallMode.path = `./${path.basename(webviewPath)}`
  
  if (isNightly && updatedConf.plugins?.updater?.endpoints) {
    updatedConf.plugins.updater.endpoints =
      updatedConf.plugins.updater.endpoints.map((endpoint: string) =>
        endpoint.replace('update-', 'update-nightly-'),
      )
  }

  return updatedConf
}

const main = async () => {
  try {
    if (argv.nightly) {
      await prepareNightly()
    } else if (argv.release) {
      await prepareRelease()
    } else if (argv.preview) {
      await preparePreview()
    } else {
      consola.error('Please specify build type: --nightly, --release, or --preview')
      process.exit(1)
    }
  } catch (error) {
    consola.error('Preparation failed:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main as prepareBuild }
