import { createServer, get, Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { connect, type AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCmsApplication } from '#/application'
import { handleApiRequest } from '#/routes'
import { getSupabaseClient } from '#/lib/supabase'
import { startNodeHttp } from '#/runtime/nodeHttp'
import { createPollingWorker } from '#/runtime/pollingWorker'
import { installShutdownSignals } from '#/runtime/signals'

const boundaries = vi.hoisted(() => ({ env: vi.fn(), query: vi.fn(), close: vi.fn() }))
vi.mock('#/env', () => { boundaries.env(); return {} })
vi.mock('#/lib/db', () => ({
  query: boundaries.query,
  withTransaction: vi.fn(),
  withClient: vi.fn(),
  closePool: boundaries.close,
}))
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
const baseUrl = (server: Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}`
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks() })

describe('application and entrypoint isolation', () => {
  it('imports CLI entries without environment, listeners, polling or DB work', async () => {
    const listen = vi.spyOn(Server.prototype, 'listen')
    const timeout = vi.spyOn(globalThis, 'setTimeout')
    const interval = vi.spyOn(globalThis, 'setInterval')
    const before = [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]
    await import('#/index')
    await import('#/worker/index')
    createCmsApplication({ supabase: getSupabaseClient(), corsOrigin: 'http://localhost:5174' })
    expect(boundaries.env).not.toHaveBeenCalled()
    expect(boundaries.query).not.toHaveBeenCalled()
    expect(boundaries.close).not.toHaveBeenCalled()
    expect(listen).not.toHaveBeenCalled()
    expect(timeout).not.toHaveBeenCalled()
    expect(interval).not.toHaveBeenCalled()
    expect([process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]).toEqual(before)
  })

  it.each([['GET', '/', 404], ['OPTIONS', '/api/auth/session', 204], ['GET', '/api/auth/session', 401], ['GET', '/api/admin/newsletters', 401]])(
    'preserves %s %s response parity', async (method, path, expectedStatus) => {
      const context = { supabase: getSupabaseClient(), corsOrigin: 'https://cms.example.test' }
      let directStatus = 0
      let directHeaders: Record<string, string> = {}
      let directBody = ''
      const request = Object.assign(Readable.from([]), { method, url: path, headers: {} }) as IncomingMessage
      const response = {
        writeHead: (status: number, headers: Record<string, string>) => { directStatus = status; directHeaders = headers },
        end: (body: string) => { directBody = body },
      } as unknown as ServerResponse
      await handleApiRequest(request, response, context)
      const close = vi.fn(async () => {})
      const runtime = await startNodeHttp({ application: createCmsApplication(context), port: 0, host: '127.0.0.1', closeResources: close })
      try {
        const result = await fetch(baseUrl(runtime.server) + path, { method })
        expect(result.status).toBe(expectedStatus)
        expect(result.status).toBe(directStatus)
        expect(result.headers.get('access-control-allow-origin')).toBe(directHeaders['Access-Control-Allow-Origin'])
        expect(await result.text()).toBe(expectedStatus === 204 ? '' : directBody)
      } finally { await runtime.stop() }
      expect(close).toHaveBeenCalledOnce()
    },
  )
})

describe('Node HTTP lifecycle', () => {
  it('rejects further requests on an existing socket after stop begins', async () => {
    const entered = deferred(); const release = deferred()
    const handle = vi.fn(async (_request: IncomingMessage, response: ServerResponse) => {
      entered.resolve(); await release.promise; response.end('first')
    })
    const runtime = await startNodeHttp({ port: 0, host: '127.0.0.1', application: { handle }, closeResources: async () => {} })
    const socket = connect((runtime.server.address() as AddressInfo).port, '127.0.0.1')
    let received = ''
    socket.on('data', chunk => { received += chunk.toString() })
    const ended = new Promise<void>((resolve, reject) => { socket.on('end', resolve); socket.on('error', reject) })
    socket.write('GET /first HTTP/1.1\r\nHost: localhost\r\n\r\n')
    await entered.promise
    const stopped = runtime.stop()
    socket.write('GET /second HTTP/1.1\r\nHost: localhost\r\n\r\n')
    // Observe the server-side request event before allowing the first response to finish.
    await new Promise<void>(resolve => runtime.server.once('request', () => resolve()))
    release.resolve()
    await ended; await stopped
    expect(handle).toHaveBeenCalledOnce()
    expect(received).toContain('503 Service Unavailable')
  })

  it('drains an active request before closing owned resources and shares stop completion', async () => {
    const entered = deferred(); const release = deferred(); const events: string[] = []
    const runtime = await startNodeHttp({ port: 0, host: '127.0.0.1', application: {
      async handle(_request, response) { entered.resolve(); await release.promise; events.push('handled'); response.end('done') },
    }, closeResources: async () => { events.push('closed') } })
    const url = baseUrl(runtime.server)
    const response = fetch(url).then(async result => result.text())
    await entered.promise
    const stopped = runtime.stop()
    expect(runtime.stop()).toBe(stopped)
    await flush()
    expect(events).toEqual([])
    release.resolve()
    expect(await response).toBe('done')
    await stopped
    expect(events).toEqual(['handled', 'closed'])
    await expect(fetch(url)).rejects.toThrow()
  })

  it('keeps draining handler work after the client disconnects', async () => {
    const entered = deferred(); const release = deferred(); const disconnected = deferred()
    const close = vi.fn(async () => {})
    const runtime = await startNodeHttp({ port: 0, host: '127.0.0.1', application: {
      async handle(_request, response) { response.on('close', disconnected.resolve); entered.resolve(); await release.promise },
    }, closeResources: close })
    const request = get(baseUrl(runtime.server))
    request.on('error', () => {})
    await entered.promise
    request.destroy()
    await disconnected.promise
    const stopped = runtime.stop()
    await flush()
    expect(close).not.toHaveBeenCalled()
    release.resolve()
    await stopped
    expect(close).toHaveBeenCalledOnce()
  })

  it('cleans owned resources on bind failure and preserves both startup/cleanup errors', async () => {
    const owner = createServer()
    await new Promise<void>((resolve, reject) => { owner.once('error', reject); owner.listen(0, '127.0.0.1', resolve) })
    const close = vi.fn(async () => { throw new Error('cleanup failed') })
    try {
      await expect(startNodeHttp({ application: { handle: async () => {} }, port: (owner.address() as AddressInfo).port,
        host: '127.0.0.1', closeResources: close })).rejects.toMatchObject({
        errors: [expect.objectContaining({ code: 'EADDRINUSE' }), expect.objectContaining({ message: 'cleanup failed' })],
      })
      expect(close).toHaveBeenCalledOnce()
    } finally { await new Promise<void>(resolve => owner.close(() => resolve())) }
  })

  it('converts uncaught handler errors to 500 and still closes resources', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const close = vi.fn(async () => {})
    const runtime = await startNodeHttp({ port: 0, host: '127.0.0.1', closeResources: close,
      application: { handle: async () => { throw new Error('private failure') } } })
    try {
      const result = await fetch(baseUrl(runtime.server))
      expect(result.status).toBe(500)
      expect(await result.text()).not.toContain('private failure')
    } finally { await runtime.stop() }
    expect(close).toHaveBeenCalledOnce()
  })

  it('surfaces shutdown cleanup errors without closing twice', async () => {
    const close = vi.fn(async () => { throw new Error('close failed') })
    const runtime = await startNodeHttp({ port: 0, host: '127.0.0.1', closeResources: close,
      application: { handle: async (_request, response) => { response.end() } } })
    await expect(runtime.stop()).rejects.toThrow('CMS shutdown failed')
    await expect(runtime.stop()).rejects.toThrow('CMS shutdown failed')
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('worker polling lifecycle', () => {
  it('does not begin queued work when stop immediately follows start', async () => {
    const runOnce = vi.fn()
    const worker = createPollingWorker({ executor: { runOnce }, pollIntervalMs: 10, closeResources: async () => {} })
    worker.start(); await worker.stop()
    expect(runOnce).not.toHaveBeenCalled()
  })

  it('is inert until start, never overlaps slow runs, and drains before close', async () => {
    vi.useFakeTimers()
    const release = deferred(); const events: string[] = []
    const runOnce = vi.fn(async () => { await release.promise; events.push('run'); return 1 })
    const worker = createPollingWorker({ executor: { runOnce }, pollIntervalMs: 10, closeResources: async () => { events.push('close') } })
    expect(runOnce).not.toHaveBeenCalled()
    worker.start(); worker.start()
    await vi.advanceTimersByTimeAsync(100)
    expect(runOnce).toHaveBeenCalledOnce()
    const stopped = worker.stop()
    expect(worker.stop()).toBe(stopped)
    expect(events).toEqual([])
    release.resolve(); await stopped
    await vi.advanceTimersByTimeAsync(100)
    expect(events).toEqual(['run', 'close'])
    expect(runOnce).toHaveBeenCalledOnce()
    expect(() => worker.start()).toThrow('Cannot restart')
  })

  it('reports failed runs then resumes after the configured delay', async () => {
    vi.useFakeTimers()
    const error = new Error('temporary DB failure')
    const runOnce = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(2)
    const onError = vi.fn(); const onProcessed = vi.fn(); const close = vi.fn(async () => {})
    const worker = createPollingWorker({ executor: { runOnce }, pollIntervalMs: 10, onError, onProcessed, closeResources: close })
    worker.start(); await flush()
    expect(onError).toHaveBeenCalledWith(error)
    await vi.advanceTimersByTimeAsync(9); expect(runOnce).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1); expect(runOnce).toHaveBeenCalledTimes(2)
    expect(onProcessed).toHaveBeenCalledWith(2)
    await worker.stop(); await vi.advanceTimersByTimeAsync(100)
    expect(runOnce).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledOnce()
  })

  it('stop before start closes once without executing and surfaces cleanup failure', async () => {
    const runOnce = vi.fn(); const close = vi.fn(async () => { throw new Error('close failed') })
    const worker = createPollingWorker({ executor: { runOnce }, pollIntervalMs: 10, closeResources: close })
    await expect(worker.stop()).rejects.toThrow('close failed')
    await expect(worker.stop()).rejects.toThrow('close failed')
    expect(runOnce).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce()
    expect(() => worker.start()).toThrow('Cannot restart')
  })

  it.each([0, -1, Infinity, 0.5, 2_147_483_648])('rejects unsafe timer interval %s', pollIntervalMs => {
    const runOnce = vi.fn()
    expect(() => createPollingWorker({ executor: { runOnce }, pollIntervalMs, closeResources: async () => {} })).toThrow('timer-safe')
    expect(runOnce).not.toHaveBeenCalled()
  })
})

describe('process signals', () => {
  it('coalesces repeated signals and removes handlers after drain', async () => {
    const release = deferred(); const stop = vi.fn(() => release.promise)
    const before = [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]
    const dispose = installShutdownSignals(stop)
    try {
      process.emit('SIGINT'); process.emit('SIGTERM'); await flush()
      expect(stop).toHaveBeenCalledOnce()
      release.resolve(); await flush()
      expect([process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]).toEqual(before)
    } finally { dispose() }
  })

  it('reports shutdown failure and sets an unsuccessful exit code', async () => {
    const oldCode = process.exitCode
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dispose = installShutdownSignals(async () => { throw new Error('drain failed') })
    try {
      process.emit('SIGTERM'); await flush()
      expect(process.exitCode).toBe(1)
      expect(log).toHaveBeenCalledWith('CMS runtime shutdown failed:', expect.any(Error))
    } finally { dispose(); process.exitCode = oldCode }
  })
})
