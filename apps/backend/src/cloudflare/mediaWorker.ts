import type { R2Bucket } from '@cloudflare/workers-types'
import { Pool } from 'pg'
import { HttpError } from '#/auth'
import { withDatabasePool } from '#/lib/db'
import { withRuntimeEnvironment } from '#/runtime/environment'
import { mediaStorageConfiguration, serveEmailMedia, withMediaBucket } from '#/services/r2MediaService'

export interface MediaEnv {
  MEDIA_BUCKET: R2Bucket
  MEDIA_R2_BUCKET: string
  MEDIA_STORAGE_ENVIRONMENT: 'staging' | 'production'
  HYPERDRIVE: { connectionString: string }
}

/** Dedicated media origin: read-only database checks and private R2 reads, no CMS API. */
export async function mediaFetch(request: Request, env: MediaEnv): Promise<Response> {
  const values = { MEDIA_R2_BUCKET: env.MEDIA_R2_BUCKET, MEDIA_STORAGE_ENVIRONMENT: env.MEDIA_STORAGE_ENVIRONMENT }
  return withRuntimeEnvironment(values, async () => {
    let pool: Pool | undefined
    try {
      if (!['staging', 'production'].includes(env.MEDIA_STORAGE_ENVIRONMENT)) throw new Error('Invalid cloud environment')
      const config = mediaStorageConfiguration()
      const url = new URL(request.url)
      if (url.origin !== config.emailOrigin || !['GET', 'HEAD'].includes(request.method) || !/^\/media\/[0-9a-f-]+\.[a-z0-9]+$/.test(url.pathname) || url.search) return new Response('Not found', { status:404, headers:{'Cache-Control':'no-store'} })
      if (!env.MEDIA_BUCKET || !env.HYPERDRIVE?.connectionString) throw new Error('Missing media bindings')
      pool = new Pool({ connectionString: env.HYPERDRIVE.connectionString, max: 1, connectionTimeoutMillis: 10_000 })
      return await withDatabasePool(pool, () => withMediaBucket(env.MEDIA_BUCKET, () => serveEmailMedia(request)))
    } catch (error) {
      return new Response('Media unavailable', { status:error instanceof HttpError ? error.status : 503, headers:{'Cache-Control':'no-store'} })
    } finally { await pool?.end() }
  })
}
export default { fetch: mediaFetch }
