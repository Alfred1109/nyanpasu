import assert from 'node:assert/strict'
import test from 'node:test'

type ProxyModeUpdate = (options: {
  mode: string
  currentMode?: string
  queryError?: unknown
  patch: () => Promise<unknown>
  clearConnections: () => Promise<unknown>
}) => Promise<{
  changed: boolean
  connectionsCleared: boolean
  cleanupError?: Error
}>
const proxyModeModuleUrl = new URL(
  '../../frontend/interface/src/ipc/proxy-mode-update.ts',
  import.meta.url,
).href
const { updateProxyMode } = (await import(proxyModeModuleUrl)) as {
  updateProxyMode: ProxyModeUpdate
}

test('same mode returns without patching or clearing connections', async () => {
  const calls: string[] = []
  const result = await updateProxyMode({
    mode: 'RULE',
    currentMode: 'rule',
    patch: async () => {
      calls.push('patch')
    },
    clearConnections: async () => {
      calls.push('clear')
    },
  })

  assert.deepEqual(result, { changed: false, connectionsCleared: false })
  assert.deepEqual(calls, [])
})

test('failed patch leaves existing connections untouched', async () => {
  const calls: string[] = []

  await assert.rejects(
    updateProxyMode({
      mode: 'global',
      currentMode: 'rule',
      patch: async () => {
        calls.push('patch')
        throw new Error('patch failed')
      },
      clearConnections: async () => {
        calls.push('clear')
      },
    }),
    /patch failed/,
  )

  assert.deepEqual(calls, ['patch'])
})

test('clears connections only after patch succeeds', async () => {
  const calls: string[] = []
  const result = await updateProxyMode({
    mode: 'global',
    currentMode: 'rule',
    patch: async () => {
      calls.push('patch')
    },
    clearConnections: async () => {
      calls.push('clear')
    },
  })

  assert.deepEqual(result, { changed: true, connectionsCleared: true })
  assert.deepEqual(calls, ['patch', 'clear'])
})

test('cleanup failure is returned separately after a successful mode change', async () => {
  const cleanupError = new Error('cleanup failed')
  const result = await updateProxyMode({
    mode: 'global',
    currentMode: 'rule',
    patch: async () => undefined,
    clearConnections: async () => {
      throw cleanupError
    },
  })

  assert.equal(result.changed, true)
  assert.equal(result.connectionsCleared, false)
  assert.equal(result.cleanupError, cleanupError)
})

test('failed config reads and missing modes reject before any mutation', async () => {
  const calls: string[] = []
  const options = {
    mode: 'global',
    patch: async () => {
      calls.push('patch')
    },
    clearConnections: async () => {
      calls.push('clear')
    },
  }

  await assert.rejects(
    updateProxyMode({
      ...options,
      currentMode: 'rule',
      queryError: new Error('read failed'),
    }),
    /读取失败/,
  )
  await assert.rejects(updateProxyMode({ ...options }), /有效模式/)
  assert.deepEqual(calls, [])
})

test('concurrent changes share a lock and it releases after failure', async () => {
  let rejectPatch!: (error: Error) => void
  const patch = new Promise<void>((_resolve, reject) => {
    rejectPatch = reject
  })
  const first = updateProxyMode({
    mode: 'global',
    currentMode: 'rule',
    patch: () => patch,
    clearConnections: async () => {},
  })
  await assert.rejects(
    updateProxyMode({
      mode: 'direct',
      currentMode: 'rule',
      patch: async () => assert.fail('concurrent patch'),
      clearConnections: async () => assert.fail('concurrent cleanup'),
    }),
    /正在切换/,
  )
  rejectPatch(new Error('failed'))
  await assert.rejects(first, /failed/)
  const next = await updateProxyMode({
    mode: 'direct',
    currentMode: 'rule',
    patch: async () => {},
    clearConnections: async () => {},
  })
  assert.equal(next.changed, true)
})
