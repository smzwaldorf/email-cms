import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomUUID } from 'node:crypto'
import type { R2Bucket } from '@cloudflare/workers-types'
import { SignJWT, jwtVerify } from 'jose'
import { canAccessCmsPanel, canPerformCmsAction, type SqlTables } from '@email-cms/shared'
import { HttpError, type AuthenticatedViewer } from '#/auth'
import { query, withTransaction } from '#/lib/db'
import { runtimeEnvironment } from '#/runtime/environment'
import { cmsArticleService } from '#/services/cmsArticleService'
import { readerService } from '#/services/readerService'

export type MediaRow = SqlTables['media_files']
const bucketContext = new AsyncLocalStorage<R2Bucket | undefined>()
export function withMediaBucket<T>(bucket: R2Bucket | undefined, run: () => T): T {
  return bucketContext.run(bucket, run)
}
export function mediaBucket(): R2Bucket {
  const bucket = bucketContext.getStore()
  if (!bucket) throw new HttpError(503, 'R2 media storage is not configured')
  return bucket
}

export function mediaStorageConfiguration() {
  const env = runtimeEnvironment()
  const environment = env.MEDIA_STORAGE_ENVIRONMENT
  if (!environment || !['development', 'staging', 'production'].includes(environment)) throw new HttpError(503, 'Invalid media environment')
  const bucket = env.MEDIA_R2_BUCKET
  const expected = environment === 'production' ? 'smz-cms-media-production' : 'smz-cms-media-dev-staging'
  if (bucket !== expected) throw new HttpError(503, 'Media bucket does not match environment')
  const emailOrigin = environment === 'production' ? 'https://media.smzwaldorf.com' : 'https://staging-media.smzwaldorf.com'
  return { environment, bucket, emailOrigin }
}
export function mediaConfiguration() {
  const config = mediaStorageConfiguration()
  const env = runtimeEnvironment()
  const origin = new URL(env.MEDIA_API_ORIGIN ?? env.APP_URL ?? '')
  if (origin.origin !== (env.MEDIA_API_ORIGIN ?? env.APP_URL) || (origin.protocol !== 'https:' && !(config.environment === 'development' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) throw new HttpError(503, 'Invalid media API origin')
  const secret = env.MEDIA_SIGNING_SECRET ?? env.JWT_SECRET
  if (!secret || secret.length < 32) throw new HttpError(503, 'Media signing secret is not configured')
  return { ...config, origin: origin.origin, secret: new TextEncoder().encode(secret) }
}

const supported: Record<string, { type: 'image' | 'audio'; extension: string }> = {
  'image/jpeg': { type: 'image', extension: 'jpg' }, 'image/png': { type: 'image', extension: 'png' },
  'image/webp': { type: 'image', extension: 'webp' }, 'image/gif': { type: 'image', extension: 'gif' },
  'audio/mpeg': { type: 'audio', extension: 'mp3' }, 'audio/wav': { type: 'audio', extension: 'wav' },
  'audio/x-wav': { type: 'audio', extension: 'wav' }, 'audio/ogg': { type: 'audio', extension: 'ogg' },
  'audio/mp4': { type: 'audio', extension: 'm4a' }, 'audio/webm': { type: 'audio', extension: 'webm' },
}
export function uploadFormat(mime: string) {
  const format = supported[mime]
  if (!format) throw new HttpError(415, 'Only supported image and audio files may be uploaded')
  return { ...format, limit: (format.type === 'image' ? 10 : 50) * 1024 * 1024 }
}
export function verifyMediaBytes(bytes: Buffer, mime: string): void {
  const ascii = (start: number, end: number) => bytes.subarray(start, end).toString('ascii')
  const valid = mime === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mime === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(ascii(0, 6))
    : mime === 'image/webp' ? ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
    : ['audio/wav', 'audio/x-wav'].includes(mime) ? ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE'
    : mime === 'audio/ogg' ? ascii(0, 4) === 'OggS'
    : mime === 'audio/mp4' ? ascii(4, 8) === 'ftyp'
    : mime === 'audio/webm' ? bytes.subarray(0, 4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))
    : mime === 'audio/mpeg' ? ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    : false
  if (!valid) throw new HttpError(415, 'File contents do not match the selected media format')
}

export function mediaByteRange(range: string | undefined, size: number): { offset: number; length: number } | undefined {
  if (!range) return undefined
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match || (!match[1] && !match[2])) throw new HttpError(416, 'Invalid media byte range')
  const suffix = !match[1] ? Number(match[2]) : undefined
  const offset = suffix !== undefined ? Math.max(0, size - suffix) : Number(match[1])
  const end = suffix !== undefined || !match[2] ? size - 1 : Math.min(size - 1, Number(match[2]))
  if ((suffix !== undefined && (!Number.isSafeInteger(suffix) || suffix < 1)) || !Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset >= size || end < offset) throw new HttpError(416, 'Media byte range is not satisfiable')
  return { offset, length: end - offset + 1 }
}

export async function requireMediaUpload(viewer: AuthenticatedViewer, articleId?: string): Promise<void> {
  if (!canAccessCmsPanel(viewer)) throw new HttpError(403, 'Media uploads require CMS editor access')
  if (articleId) {
    const article = await cmsArticleService.read(articleId, viewer)
    if (!canPerformCmsAction(viewer, 'article:edit', article)) throw new HttpError(403, 'Article edit permission required')
  }
}

export async function uploadMedia(bytes: Buffer, mime: string, filename: string, viewer: AuthenticatedViewer,
  metadata: { articleId?: string; width?: number; height?: number; duration?: number } = {}): Promise<MediaRow> {
  await requireMediaUpload(viewer, metadata.articleId)
  const config = mediaStorageConfiguration()
  const format = uploadFormat(mime)
  if (!bytes.length || bytes.length > format.limit) throw new HttpError(413, 'Media file is empty or exceeds the upload limit')
  if (!filename.trim() || filename.length > 255 || /[/\\]/.test(filename) || [...filename].some(char => char.charCodeAt(0) < 32)) throw new HttpError(400, 'Invalid filename')
  verifyMediaBytes(bytes, mime)
  const id = randomUUID()
  const path = `${config.environment}/${viewer.id}/${id}.${format.extension}`
  const storage = mediaBucket()
  // The object is written before its metadata is committed. A failed metadata commit removes this new object.
  await storage.put(path, bytes, { httpMetadata: { contentType: mime }, customMetadata: { mediaId: id, originalFilename: filename } })
  let metadataInserted = false
  try {
    return await withTransaction(async client => {
      // Serialize concurrent uploads by owner so quota checks cannot race.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`media-upload:${viewer.id}`])
      const used = await client.query<{ bytes: string }>('SELECT coalesce(sum(file_size),0)::text AS bytes FROM media_files WHERE uploaded_by = $1', [viewer.id])
      if (Number(used.rows[0].bytes) + bytes.length > 500 * 1024 * 1024) throw new HttpError(413, 'Media storage quota exceeded')
      const positive = (value?: number) => value !== undefined && Number.isFinite(value) && value > 0 ? value : null
      const result = await client.query<MediaRow>(`INSERT INTO media_files
        (id, filename, file_type, mime_type, file_size, storage_path, storage_provider, public_url,
         uploaded_by, width, height, duration, storage_bucket, storage_environment, content_hash)
        VALUES ($1,$2,$3,$4,$5,$6,'s3',$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, filename, format.type, mime, bytes.length, path, `storage://media/${path}`, viewer.id,
        format.type === 'image' ? positive(metadata.width) : null, format.type === 'image' ? positive(metadata.height) : null,
        format.type === 'audio' ? positive(metadata.duration) : null, config.bucket, config.environment, createHash('sha256').update(bytes).digest('hex')])
      metadataInserted = true
      return result.rows[0]
    })
  } catch (error) {
    // A lost COMMIT acknowledgement may follow a successful commit. Preserve that
    // object for reconciliation rather than deleting bytes a committed row needs.
    if (metadataInserted) console.error('Media metadata commit outcome uncertain; object preserved', id)
    else try { await storage.delete(path) } catch { console.error('Failed to clean up uncommitted media object', id) }
    throw error
  }
}

export async function mediaForPath(path: string): Promise<MediaRow> {
  const config = mediaStorageConfiguration()
  const { rows } = await query<MediaRow>('SELECT * FROM media_files WHERE storage_path = $1 AND storage_bucket = $2 AND storage_environment = $3', [path, config.bucket, config.environment])
  if (!rows[0]) throw new HttpError(404, 'Media not found')
  return rows[0]
}
export async function authorizeMediaRead(row: MediaRow, viewer: AuthenticatedViewer | null): Promise<void> {
  if (viewer && canAccessCmsPanel(viewer)) return
  const references = await query<{ article_id: string }>('SELECT article_id FROM article_media_references WHERE media_id = $1', [row.id])
  for (const reference of references.rows) {
    try { await readerService.getReaderArticle(reference.article_id, undefined, viewer); return } catch (error) {
      if (!(error instanceof HttpError) || ![403,404].includes(error.status)) throw error
    }
  }
  throw new HttpError(404, 'Media not found')
}
export async function signedMediaUrl(path: string, expiresIn = 300): Promise<string> {
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 60 * 60 * 24 * 30) throw new HttpError(400, 'Invalid media URL expiry')
  const config = mediaConfiguration()
  const row = await mediaForPath(path)
  const token = await new SignJWT({ path, bucket: config.bucket, environment: config.environment })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(row.id).setAudience('cms-media').setIssuedAt().setExpirationTime(`${expiresIn}s`).sign(config.secret)
  return `${config.origin}/api/media/${row.id}/content?token=${encodeURIComponent(token)}`
}
export async function verifyMediaToken(id: string, token: string): Promise<MediaRow> {
  const config = mediaConfiguration()
  try {
    const { payload } = await jwtVerify(token, config.secret, { algorithms: ['HS256'], audience: 'cms-media' })
    if (payload.sub !== id || payload.bucket !== config.bucket || payload.environment !== config.environment || typeof payload.path !== 'string') throw new Error('Wrong media scope')
    const row = await mediaForPath(payload.path)
    if (row.id !== id) throw new Error('Wrong media ID')
    return row
  } catch { throw new HttpError(403, 'Media URL is invalid or expired') }
}


/** Email URLs have no bearer token or expiry. Approval intentionally grants public access. */
export function permanentEmailMediaUrl(row: MediaRow): string {
  const config = mediaStorageConfiguration()
  if (row.storage_bucket !== config.bucket || row.storage_environment !== config.environment) throw new HttpError(404, 'Media not found')
  if (!row.email_serving_enabled || !row.email_approved_by || !row.email_approved_at) throw new HttpError(409, `Media ${row.id} requires explicit public email approval`)
  const extension = uploadFormat(row.mime_type).extension
  return `${config.emailOrigin}/media/${row.id}.${extension}`
}

export async function emailMediaUrl(path: string): Promise<string> {
  return permanentEmailMediaUrl(await mediaForPath(path))
}

export async function setEmailMediaAccess(id: string, enabled: boolean, actor: AuthenticatedViewer): Promise<MediaRow> {
  if (!canPerformCmsAction(actor, 'cms:manage')) throw new HttpError(403, 'Admin role required to approve public email media')
  const config = mediaStorageConfiguration()
  return withTransaction(async client => {
    const found = await client.query<MediaRow>('SELECT * FROM media_files WHERE id=$1 AND storage_bucket=$2 AND storage_environment=$3 FOR UPDATE', [id, config.bucket, config.environment])
    const row = found.rows[0]
    if (!row) throw new HttpError(404, 'Media not found')
    uploadFormat(row.mime_type)
    const updated = await client.query<MediaRow>(`UPDATE media_files SET email_serving_enabled=$2,
      email_approved_by=CASE WHEN $2 THEN $3::uuid ELSE NULL END,
      email_approved_at=CASE WHEN $2 THEN now() ELSE NULL END, updated_at=now() WHERE id=$1 RETURNING *`, [id, enabled, actor.id])
    await client.query('INSERT INTO media_email_access_events (media_id,actor_id,enabled) VALUES ($1,$2,$3)', [id, actor.id, enabled])
    return updated.rows[0]
  })
}

/** Only this endpoint is available on the dedicated media hostname. Never cache approval decisions. */
export async function serveEmailMedia(request: Request): Promise<Response> {
  const config = mediaStorageConfiguration()
  const url = new URL(request.url)
  const missing = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  if (url.origin !== config.emailOrigin || !['GET', 'HEAD'].includes(request.method)) return missing()
  const match = /^\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp|gif|mp3|wav|ogg|m4a|webm)$/.exec(url.pathname)
  if (!match || url.search) return missing()
  const environments = config.environment === 'production' ? ['production'] : ['development', 'staging']
  const result = await query<MediaRow>(`SELECT * FROM media_files WHERE id=$1 AND to_jsonb(media_files)->>'storage_bucket'=$2
    AND to_jsonb(media_files)->>'storage_environment'=ANY($3::text[])
    AND to_jsonb(media_files)->>'email_serving_enabled'='true'
    AND to_jsonb(media_files)->>'email_approved_by' IS NOT NULL
    AND to_jsonb(media_files)->>'email_approved_at' IS NOT NULL`, [match[1], config.bucket, environments])
  const row = result.rows[0]
  if (!row || !row.email_serving_enabled || !row.email_approved_by || !row.email_approved_at || row.storage_bucket !== config.bucket || !environments.includes(row.storage_environment ?? '') || uploadFormat(row.mime_type).extension !== match[2]) return missing()
  const range = mediaByteRange(request.headers.get('range') ?? undefined, Number(row.file_size))
  const object = await mediaBucket().get(row.storage_path, range ? { range } : undefined)
  if (!object) return missing()
  const headers: Record<string,string> = { 'Content-Type': row.mime_type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', ETag: object.httpEtag, 'Referrer-Policy': 'no-referrer' }
  const selected = object.range
  if (selected && 'offset' in selected && 'length' in selected && selected.offset !== undefined && selected.length !== undefined) {
    headers['Content-Range'] = `bytes ${selected.offset}-${selected.offset + selected.length - 1}/${object.size}`
    headers['Content-Length'] = String(selected.length)
  } else headers['Content-Length'] = String(object.size)
  if (request.method === 'HEAD') { await object.body.cancel(); return new Response(null, { status: headers['Content-Range'] ? 206 : 200, headers }) }
  return new Response(object.body as unknown as ReadableStream, { status: headers['Content-Range'] ? 206 : 200, headers })
}
