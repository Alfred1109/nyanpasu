import { execSync } from 'node:child_process'
import fs from 'fs-extra'
import { GIT_SUMMARY_INFO_PATH, TAURI_APP_TEMP_DIR } from './utils/env'
import { consola } from './utils/logger'

async function main() {
  let hash = 'unknown'
  let author = process.env.GIT_AUTHOR_NAME || process.env.USER || 'unknown'
  let time = new Date().toISOString()

  try {
    const [gitHash, gitAuthor, gitTime] = execSync(
      "git show --pretty=format:'%H,%cn,%cI' --no-patch --no-notes",
      {
        cwd: process.cwd(),
      },
    )
      .toString()
      .replace(/'/g, '')
      .split(',')

    if (gitHash) hash = gitHash
    if (gitAuthor) author = gitAuthor
    if (gitTime) time = gitTime
  } catch (error) {
    consola.warn(
      `Failed to read git metadata, falling back to local build metadata: ${String(error)}`,
    )
  }

  const summary = {
    hash,
    author,
    time,
  }
  consola.info(summary)
  if (!(await fs.exists(TAURI_APP_TEMP_DIR))) {
    await fs.mkdir(TAURI_APP_TEMP_DIR)
  }

  await fs.writeJSON(GIT_SUMMARY_INFO_PATH, summary, { spaces: 2 })
  consola.success('Git summary info generated')
}

main().catch(consola.error)
