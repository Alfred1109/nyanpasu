import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const project = process.cwd()
const reservePort = async () => {
  const server = http.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return port
}

test(
  'packaged Mihomo exposes group URL/status, pinning, latency, and config updates',
  { timeout: 40_000 },
  async () => {
    const server = http.createServer((incoming, response) => {
      if (incoming.url === '/provider.yaml') {
        response.writeHead(200, { 'Content-Type': 'application/yaml' })
        response.end(
          JSON.stringify({
            proxies: [
              {
                name: 'smoke-provider-node',
                type: 'http',
                server: '127.0.0.1',
                port: (server.address() as { port: number }).port,
              },
            ],
          }),
        )
        return
      }
      setTimeout(() => {
        response.writeHead(204)
        response.end()
      }, 25)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const targetPort = (server.address() as { port: number }).port
    server.on('connect', (incoming, socket, head) => {
      if (incoming.url !== `127.0.0.1:${targetPort}`) {
        socket.destroy()
        return
      }
      const upstream = net.connect(targetPort, '127.0.0.1', () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length) upstream.write(head)
        socket.pipe(upstream).pipe(socket)
      })
      upstream.on('error', () => socket.destroy())
      socket.on('error', () => upstream.destroy())
      socket.on('close', () => upstream.destroy())
    })
    const controllerPort = await reservePort()
    const mixedPort = await reservePort()
    const directory = await fs.mkdtemp(path.join(project, '.run/core-smoke-'))
    const config = path.join(directory, 'config.json')
    const testUrl = `http://127.0.0.1:${targetPort}/generate_204`
    const group = 'smoke-auto'
    const initial = {
      'mixed-port': mixedPort,
      'external-controller': `127.0.0.1:${controllerPort}`,
      secret: 'local-smoke-test',
      'log-level': 'warning',
      'unified-delay': false,
      'tcp-concurrent': false,
      dns: { enable: false },
      'proxy-providers': {
        'smoke-provider': {
          type: 'http',
          url: `http://127.0.0.1:${targetPort}/provider.yaml`,
          path: `./provider-${controllerPort}.yaml`,
          interval: 3600,
          'health-check': {
            enable: true,
            url: testUrl,
            interval: 3600,
            lazy: true,
            'expected-status': 204,
          },
        },
      },
      'proxy-groups': [
        { name: 'provider-group', type: 'select', use: ['smoke-provider'] },
        {
          name: group,
          type: 'url-test',
          proxies: ['DIRECT', 'REJECT'],
          url: testUrl,
          'expected-status': 204,
          interval: 3600,
          lazy: true,
        },
      ],
      rules: ['MATCH,DIRECT'],
    }
    const request = async (route: string, method = 'GET', body?: unknown) => {
      const response = await fetch(
        `http://127.0.0.1:${controllerPort}${route}`,
        {
          method,
          headers: {
            Authorization: 'Bearer local-smoke-test',
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      )
      assert.equal(
        response.ok,
        true,
        `${method} ${route}: ${response.status} ${await response.clone().text()}`,
      )
      return response.status === 204
        ? {}
        : ((await response.json()) as Record<string, unknown>)
    }
    try {
      await fs.writeFile(config, JSON.stringify(initial))
      await exec(path.join(project, 'start.sh'), ['--core'], {
        cwd: project,
        env: { ...process.env, NYANPASU_CORE_CONFIG: config },
      })
      const version = await request('/version')
      assert.equal(version.version, 'v1.19.32')
      const snapshot = await request(`/proxies/${group}`)
      assert.equal(snapshot.testUrl, testUrl)
      assert.equal(snapshot.expectedStatus, '204')
      assert.equal(snapshot.fixed, '')
      const delay = await request(
        `/proxies/DIRECT/delay?timeout=5000&url=${encodeURIComponent(testUrl)}&expected=204`,
      )
      assert.ok(typeof delay.delay === 'number' && delay.delay > 0)
      await request(`/proxies/${group}`, 'PUT', { name: 'DIRECT' })
      assert.equal((await request(`/proxies/${group}`)).fixed, 'DIRECT')
      await request(`/proxies/${group}`, 'DELETE')
      assert.equal((await request(`/proxies/${group}`)).fixed, '')
      await request('/providers/proxies/smoke-provider/healthcheck')
      type ProviderNode = {
        name: string
        alive: boolean
        history: { delay: number }[]
      }
      let healthy: ProviderNode | undefined
      for (let attempt = 0; attempt < 50; attempt++) {
        const provider = await request('/providers/proxies/smoke-provider')
        healthy = (provider.proxies as ProviderNode[]).find(
          (node) => node.name === 'smoke-provider-node',
        )
        if (healthy?.alive && healthy.history.some((item) => item.delay > 0))
          break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      assert.equal(healthy?.alive, true, JSON.stringify(healthy))
      assert.ok(healthy?.history.some((item) => item.delay > 0))
      await fs.writeFile(
        config,
        JSON.stringify({
          ...initial,
          'unified-delay': true,
          'tcp-concurrent': true,
        }),
      )
      await request('/configs', 'PUT', {
        payload: await fs.readFile(config, 'utf8'),
      })
      assert.equal((await request('/configs'))['unified-delay'], true)
    } finally {
      await exec(path.join(project, 'stop.sh'), ['--core'], {
        cwd: project,
      }).catch(() => {})
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await fs.rm(directory, { recursive: true, force: true })
      await fs.rm(
        path.join(project, '.run/core', `provider-${controllerPort}.yaml`),
        { force: true },
      )
    }
  },
)
