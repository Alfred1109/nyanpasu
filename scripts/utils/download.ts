import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import path from 'path'
import zlib from 'zlib'
import AdmZip from 'adm-zip'
import fs from 'fs-extra'
import * as tar from 'tar'
import { BinInfo } from 'types'
import { fetch, type RequestInit } from 'undici'
import { getProxyAgent } from './'
import { TAURI_APP_DIR } from './env'
import { colorize, consola } from './logger'

/**
 * download sidecar and rename
 */
export const downloadFile = async (url: string, path: string) => {
  const options: Partial<RequestInit> = {}

  const httpProxy = getProxyAgent()

  if (httpProxy) {
    options.dispatcher = httpProxy
  }

  consola.debug(colorize`download {gray "${url}"} to {gray "${path}"}`)

  const response = await fetch(url, {
    ...options,
    method: 'GET',
    headers: {
      'Content-Type': 'application/octet-stream',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
    },
  })

  // check status code
  if (response.status !== 200) {
    throw new Error(`download failed: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()

  await fs.writeFile(path, new Uint8Array(buffer))

  consola.success(colorize`download finished {gray "${url.split('/').at(-1)}"}`)
}

export const resolveSidecar = async (
  binInfo: PromiseLike<BinInfo> | BinInfo,
  platform: string,
  option?: { force?: boolean },
) => {
  const { name, targetFile, tmpFile, exeFile, downloadURL, sha256 } =
    await binInfo

  consola.debug(colorize`resolve {cyan ${name}}...`)

  const sidecarDir = path.join(TAURI_APP_DIR, 'sidecar')

  const sidecarPath = path.join(sidecarDir, targetFile)

  await fs.mkdirp(sidecarDir)

  const receiptPath = `${sidecarPath}.source.json`
  if (!option?.force && (await fs.pathExists(sidecarPath))) {
    const receipt = await fs.readJSON(receiptPath).catch(() => null)
    const binaryHash = crypto
      .createHash('sha256')
      .update(await fs.readFile(sidecarPath))
      .digest('hex')
    if (
      receipt?.downloadURL === downloadURL &&
      receipt?.archiveSha256 === sha256 &&
      receipt?.binarySha256 === binaryHash
    )
      return
  }
  // Unique staging keeps concurrent preparations separate and leaves the
  // previously usable sidecar intact if downloading or extraction fails.

  const tempDir = await fs.mkdtemp(path.join(sidecarDir, `.${name}-`))

  const tempFile = path.join(tempDir, tmpFile)

  const tempExe = path.join(tempDir, exeFile)
  const stagedPath = path.join(tempDir, targetFile)

  await fs.mkdirp(tempDir)

  try {
    if (!(await fs.pathExists(tempFile))) {
      await downloadFile(downloadURL, tempFile)
    }
    if (sha256) {
      const actual = crypto
        .createHash('sha256')
        .update(await fs.readFile(tempFile))
        .digest('hex')
      if (actual !== sha256)
        throw new Error(`SHA256 mismatch for ${tmpFile}: ${actual}`)
    }
    if (tmpFile.endsWith('.zip')) {
      const zip = new AdmZip(tempFile)

      let entryName
      zip.getEntries().forEach((entry) => {
        consola.debug(colorize`"{green ${name}}" entry name ${entry.entryName}`)
        if (
          (entry.entryName.includes(name) &&
            entry.entryName.endsWith('.exe')) ||
          (entry.entryName.includes(
            name
              .split('-')
              .filter((o) => o !== 'alpha')
              .join('-'),
          ) &&
            entry.entryName.endsWith('.exe'))
        ) {
          entryName = entry.entryName
        }
      })

      zip.extractAllTo(tempDir, true)

      if (!entryName) {
        throw new Error('cannot find exe file in zip')
      }

      await fs.rename(path.join(tempDir, entryName), stagedPath)

      consola.debug(colorize`{green "${name}"} unzip finished`)
    } else if (tmpFile.endsWith('.tar.gz')) {
      // decompress and untar the file
      await tar.x({
        file: tempFile,
        cwd: tempDir,
      })
      await fs.rename(tempExe, stagedPath)
      consola.debug(colorize`{green "${name}"} untar finished`)
    } else if (tmpFile.endsWith('.gz')) {
      await pipeline(
        fs.createReadStream(tempFile),
        zlib.createGunzip(),
        fs.createWriteStream(stagedPath),
      )
    } else {
      // Common Files
      await fs.rename(tempFile, stagedPath)

      consola.info(colorize`{green "${name}"} rename finished`)
    }
    if (platform !== 'win32') await fs.chmod(stagedPath, 0o755)
    const binarySha256 = crypto
      .createHash('sha256')
      .update(await fs.readFile(stagedPath))
      .digest('hex')
    await fs.rename(stagedPath, sidecarPath)
    await fs.writeJSON(
      receiptPath,
      { downloadURL, archiveSha256: sha256, binarySha256 },
      { spaces: 2 },
    )

    consola.success(colorize`resolve {green ${name}} finished`)
  } finally {
    // delete temp dir
    await fs.remove(tempDir)
  }
}
