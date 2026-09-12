import { createServer, type Server } from 'node:http'
import type { CmsApplication } from '#/application'

export interface NodeHttpOptions {
  application: CmsApplication
  port: number
  host?: string
  /** Close only resources owned by this runtime, after all handlers settle. */
  closeResources(): Promise<void>
}

export interface NodeHttpRuntime {
  server: Server
  stop(): Promise<void>
}

export async function startNodeHttp(options: NodeHttpOptions): Promise<NodeHttpRuntime> {
  let stopping = false
  let stopped: Promise<void> | undefined
  const active = new Set<Promise<void>>()
  const server = createServer((request, response) => {
    if (stopping) {
      response.writeHead(503, { Connection: 'close' })
      response.end()
      return
    }
    // Track application completion, even if the response/socket closes earlier.
    const work = Promise.resolve()
      .then(() => options.application.handle(request, response))
      .catch(error => {
        console.error('CMS request failed:', error)
        if (response.headersSent) response.destroy()
        else if (!response.destroyed) {
          response.writeHead(500, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ error: 'Internal server error' }))
        }
      })
      .finally(() => active.delete(work))
    active.add(work)
  })

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => { server.off('listening', onListening); reject(error) }
      const onListening = () => { server.off('error', onError); resolve() }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(options.port, options.host)
    })
  } catch (error) {
    try { await options.closeResources() } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'CMS startup and cleanup failed')
    }
    throw error
  }

  return {
    server,
    stop() {
      if (!stopped) {
        stopping = true
        stopped = (async () => {
          const closed = new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve())
            server.closeIdleConnections()
          })
          const results = await Promise.allSettled([closed, ...active])
          const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
          try { await options.closeResources() } catch (error) { errors.push(error) }
          if (errors.length) throw new AggregateError(errors, 'CMS shutdown failed')
        })()
      }
      return stopped
    },
  }
}
