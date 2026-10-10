import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { resolveSidecar } from '../utils/download'
import { TAURI_APP_DIR } from '../utils/env'

// Exercise the real download/extract/cache pipeline against an isolated local
// origin. The test sidecar never shares a filename with packaged cores.
test('sidecar cache tracks source and bytes; failed upgrade preserves old core', async () => {
  const original = Buffer.from('old core')
  const updated = Buffer.from('new core')
  let response = gzipSync(original)
  let requests = 0
  const server = http.createServer((_request, res) => {
    requests++
    res.writeHead(200)
    res.end(response)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const filename = `test-sidecar-${crypto.randomUUID()}`
  const binary = path.join(TAURI_APP_DIR, 'sidecar', filename)
  const receipt = `${binary}.source.json`
  const info = (version: string, archive = response) => ({
    name: filename,
    targetFile: filename,
    exeFile: filename,
    tmpFile: `${filename}.gz`,
    downloadURL: `http://127.0.0.1:${address.port}/${version}`,
    sha256: crypto.createHash('sha256').update(archive).digest('hex'),
  })
  try {
    const oldInfo = info('v1')
    await resolveSidecar(oldInfo, 'linux')
    assert.deepEqual(await fs.readFile(binary), original)
    await resolveSidecar(oldInfo, 'linux')
    assert.equal(requests, 1, 'verified unchanged cache must not download')
    await fs.writeFile(binary, 'corrupted cached binary')
    await resolveSidecar(oldInfo, 'linux')
    assert.deepEqual(await fs.readFile(binary), original)
    assert.equal(requests, 2, 'tampering must invalidate the receipt')

    response = gzipSync(updated)
    await assert.rejects(
      resolveSidecar({ ...info('v2'), sha256: '0'.repeat(64) }, 'linux'),
      /SHA256 mismatch/,
    )
    assert.deepEqual(
      await fs.readFile(binary),
      original,
      'failed upgrade must preserve the usable binary',
    )
    await resolveSidecar(info('v2'), 'linux')
    assert.deepEqual(await fs.readFile(binary), updated)
    assert.equal(
      JSON.parse(await fs.readFile(receipt, 'utf8')).downloadURL,
      info('v2').downloadURL,
    )
    assert.equal((await fs.stat(binary)).mode & 0o111, 0o111)
  } finally {
    await fs.rm(binary, { force: true })
    await fs.rm(receipt, { force: true })
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
