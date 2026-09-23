import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types'
import { createServer } from 'node:http'
import { httpServerHandler } from 'cloudflare:node'
import { Pool } from 'pg'
import { createCmsApplication } from '#/application'
import { query, withDatabasePool } from '#/lib/db'
import { getSupabaseClient } from '#/lib/supabase'
import { withRuntimeEnvironment } from '#/runtime/environment'
import { NewsletterDeliveryWorker } from '#/worker/deliveryWorker'

import { validateEnvironment, type Env } from './config'

function poolFor(env: Env) {
  return new Pool({ connectionString: env.HYPERDRIVE.connectionString, max: 3, connectionTimeoutMillis: 10_000 })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let config: Record<string, string | undefined>
    try { config = validateEnvironment(env) } catch {
      return Response.json({ error: 'Service configuration unavailable' }, { status: 503 })
    }
    const pool = poolFor(env)
    let finish!: () => void
    const completed = new Promise<void>(resolve => { finish = resolve })
    let invoked = false
    const server = createServer((incoming, outgoing) => {
      invoked = true
      void withRuntimeEnvironment(config, () => withDatabasePool(pool, async () => {
        if (incoming.url === '/health' && incoming.method === 'GET') {
          await pool.query('SELECT 1')
          outgoing.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
          outgoing.end(JSON.stringify({ status: 'ok', database: 'connected', deliveryEnabled: config.DELIVERY_ENABLED === 'true' }))
          return
        }
        await createCmsApplication({ supabase: getSupabaseClient(), corsOrigin: env.BACKEND_CORS_ORIGIN }).handle(incoming, outgoing)
      }), env.SMZ_AUTH).catch(() => {
        if (!outgoing.headersSent) { outgoing.writeHead(500, { 'Content-Type': 'application/json' }); outgoing.end('{"error":"Internal server error"}') }
        else outgoing.destroy()
      }).finally(finish)
    })
    try {
      return await httpServerHandler(server).fetch(request, env, ctx)
    } finally {
      if (invoked) await completed
      server.close()
      await pool.end()
    }
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const config = validateEnvironment(env)
    if (env.CMS_SESSION_ENABLED === 'true') {
      const cleanupPool = poolFor(env)
      try { await withDatabasePool(cleanupPool, async () => {
        await query('DELETE FROM cms_login_flows WHERE state_hash IN (SELECT state_hash FROM cms_login_flows WHERE expires_at < now() LIMIT 100)')
        await query("DELETE FROM cms_browser_sessions WHERE id_hash IN (SELECT id_hash FROM cms_browser_sessions WHERE remembered_until < now() LIMIT 100)")
      }) } finally { await cleanupPool.end() }
    }
    if (config.DELIVERY_ENABLED !== 'true') return
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.JWT_SECRET) throw new Error('Delivery secrets are required before activation')
    const pool = poolFor(env)
    try {
      await withRuntimeEnvironment(config, () => withDatabasePool(pool, () => new NewsletterDeliveryWorker({
        port: 8787, corsOrigin: env.BACKEND_CORS_ORIGIN, workerId: `cloudflare-${crypto.randomUUID()}`,
        workerPollIntervalMs: 60_000, workerBatchSize: 1,
      }, getSupabaseClient()).runOnce()), env.SMZ_AUTH)
    } finally { await pool.end() }
  },
}
