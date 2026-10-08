import path from 'node:path'
import type { R2Bucket } from '@cloudflare/workers-types'
import { mediaConfiguration } from '#/services/r2MediaService'

/** Node development uses the same R2 API through Wrangler's remote binding proxy. */
export async function openNodeMediaStorage(): Promise<{ bucket?: R2Bucket; dispose(): Promise<void> }> {
  if (!process.env.MEDIA_STORAGE_ENVIRONMENT) return { dispose: async () => {} }
  const config = mediaConfiguration()
  if (config.environment !== 'development') throw new Error('Node media proxy is restricted to development; deploy staging and production with Worker bindings')
  const { getPlatformProxy } = await import('wrangler')
  const proxy = await getPlatformProxy<{ MEDIA_BUCKET: R2Bucket }>({
    configPath: path.resolve(__dirname, '../../../../config/r2-development.jsonc'),
    envFiles: [], remoteBindings: true,
  })
  return { bucket: proxy.env.MEDIA_BUCKET, dispose: proxy.dispose }
}
