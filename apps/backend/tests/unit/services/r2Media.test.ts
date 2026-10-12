import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { R2Bucket } from '@cloudflare/workers-types'
import type { AuthenticatedViewer } from '#/auth'
const boundary = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), commitError: false, read: vi.fn(), reader: vi.fn() }))
vi.mock('#/lib/db', () => ({ query: boundary.query, withTransaction: async (run: (client: { query: typeof boundary.transaction }) => unknown) => { const result = await run({ query: boundary.transaction }); if (boundary.commitError) throw new Error('commit acknowledgement lost'); return result } }))
vi.mock('#/services/cmsArticleService', () => ({ cmsArticleService: { read: boundary.read } }))
vi.mock('#/services/readerService', () => ({ readerService: { getReaderArticle: boundary.reader } }))
import { authorizeMediaRead, emailMediaUrl, permanentEmailMediaUrl, serveEmailMedia, setEmailMediaAccess, mediaBucket, mediaByteRange, mediaConfiguration, signedMediaUrl, uploadMedia, verifyMediaBytes, verifyMediaToken, withMediaBucket, type MediaRow } from '#/services/r2MediaService'
const viewer = { id: '00000000-0000-4000-8000-000000000001', role: 'admin', roles: ['admin'], teacherClassIds: [], parentClassIds: [] } as AuthenticatedViewer
const row = { id: '00000000-0000-4000-8000-000000000002', storage_path: `development/${viewer.id}/image.png`, storage_bucket: 'smz-cms-media-dev-staging', storage_environment: 'development', file_type: 'image', mime_type: 'image/png', file_size: 9 } as MediaRow
const png = Buffer.from([137,80,78,71,13,10,26,10,0])
let put: ReturnType<typeof vi.fn>; let remove: ReturnType<typeof vi.fn>; let bucket: R2Bucket
beforeEach(() => {
  vi.stubEnv('MEDIA_STORAGE_ENVIRONMENT', 'development'); vi.stubEnv('MEDIA_R2_BUCKET', 'smz-cms-media-dev-staging')
  vi.stubEnv('MEDIA_API_ORIGIN', 'http://localhost:8787'); vi.stubEnv('MEDIA_SIGNING_SECRET', 'a'.repeat(64))
  boundary.commitError = false
  boundary.query.mockReset().mockResolvedValue({ rows: [row] }); boundary.transaction.mockReset().mockImplementation(async (sql: string) => ({ rows: sql.includes('sum(file_size)') ? [{ bytes: '0' }] : [row] }))
  boundary.read.mockReset(); boundary.reader.mockReset()
  put = vi.fn().mockResolvedValue({}); remove = vi.fn().mockResolvedValue(undefined)
  bucket = { put, delete: remove } as unknown as R2Bucket
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })
describe('persistent R2 media uploads', () => {
  it('stores validated bytes and records canonical key, uploader, environment and hash', async () => {
    await withMediaBucket(bucket, () => uploadMedia(png, 'image/png', 'garden.png', viewer, { width: 20, height: 30 }))
    expect(put.mock.calls[0][0]).toMatch(new RegExp(`^development/${viewer.id}/[a-f0-9-]+\\.png$`))
    expect(put.mock.calls[0][1]).toEqual(png)
    const insert = boundary.transaction.mock.calls.find(([sql]) => sql.includes('INSERT INTO media_files'))!
    expect(insert[0]).toContain('storage_bucket, storage_environment, content_hash')
    expect(insert[1][7]).toBe(viewer.id)
    expect(insert[1].slice(11,13)).toEqual(['smz-cms-media-dev-staging','development'])
    expect(insert[1][13]).toMatch(/^[a-f0-9]{64}$/)
    expect(remove).not.toHaveBeenCalled()
  })
  it('cleans up the object when metadata commit fails', async () => {
    boundary.transaction.mockRejectedValue(new Error('database unavailable'))
    await expect(withMediaBucket(bucket, () => uploadMedia(png, 'image/png', 'image.png', viewer))).rejects.toThrow('database unavailable')
    expect(remove).toHaveBeenCalledWith(put.mock.calls[0][0])
  })
  it('preserves object bytes when a metadata commit acknowledgement is lost', async () => {
    boundary.commitError = true
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(withMediaBucket(bucket, () => uploadMedia(png, 'image/png', 'image.png', viewer))).rejects.toThrow('commit acknowledgement lost')
      expect(remove).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith(expect.stringContaining('outcome uncertain'), expect.any(String))
    } finally { log.mockRestore() }
  })
  it('enforces owner quota on the backend and compensates after a concurrent upload', async () => {
    boundary.transaction.mockImplementation(async (sql: string) => ({ rows: sql.includes('sum(file_size)') ? [{ bytes: String(500*1024*1024) }] : [] }))
    await expect(withMediaBucket(bucket, () => uploadMedia(png, 'image/png', 'image.png', viewer))).rejects.toMatchObject({ status: 413 })
    expect(remove).toHaveBeenCalledOnce()
  })
  it('rejects parents, MIME spoofing and oversized files before writing storage', async () => {
    await expect(withMediaBucket(bucket, () => uploadMedia(png, 'image/png', 'image.png', { ...viewer, role: 'parent', roles: ['parent'] }))).rejects.toMatchObject({ status: 403 })
    await expect(withMediaBucket(bucket, () => uploadMedia(Buffer.from('<script>'), 'image/png', 'image.png', viewer))).rejects.toMatchObject({ status: 415 })
    await expect(withMediaBucket(bucket, () => uploadMedia(Buffer.alloc(10*1024*1024+1), 'image/png', 'image.png', viewer))).rejects.toMatchObject({ status: 413 })
    expect(put).not.toHaveBeenCalled()
  })
  it('checks article editorial permission before storing an upload', async () => {
    boundary.read.mockResolvedValue({ status: 'published', visibility_type: 'public' })
    const teacher = { ...viewer, role: 'teacher', roles: ['teacher'], teacherClassIds: ['A'] }
    await expect(withMediaBucket(bucket, () => uploadMedia(png, 'image/png', 'image.png', teacher, { articleId: row.id }))).rejects.toMatchObject({ status: 403 })
    expect(put).not.toHaveBeenCalled()
  })
  it('validates audio magic bytes too', () => {
    expect(() => verifyMediaBytes(Buffer.from('RIFF0000WAVE0000'), 'audio/wav')).not.toThrow()
    expect(() => verifyMediaBytes(Buffer.from('ID3000'), 'audio/mpeg')).not.toThrow()
    expect(() => verifyMediaBytes(png, 'audio/mpeg')).toThrow()
  })
})
describe('private media access', () => {
  it('scopes bearer links to media ID, environment and expiry', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-07T00:00:00Z'))
    const url = new URL(await signedMediaUrl(row.storage_path, 300)); const token = url.searchParams.get('token')!
    expect(await verifyMediaToken(row.id, token)).toEqual(row)
    await expect(verifyMediaToken('different', token)).rejects.toMatchObject({ status: 403 })
    vi.stubEnv('MEDIA_STORAGE_ENVIRONMENT', 'staging'); vi.stubEnv('MEDIA_API_ORIGIN', 'https://staging.school.test')
    await expect(verifyMediaToken(row.id, token)).rejects.toMatchObject({ status: 403 })
    vi.stubEnv('MEDIA_STORAGE_ENVIRONMENT', 'development'); vi.stubEnv('MEDIA_API_ORIGIN', 'http://localhost:8787'); vi.advanceTimersByTime(301_000)
    await expect(verifyMediaToken(row.id, token)).rejects.toMatchObject({ status: 403 })
  })
  it('rejects production configured against the development bucket', () => {
    vi.stubEnv('MEDIA_STORAGE_ENVIRONMENT', 'production')
    expect(() => mediaConfiguration()).toThrow('Media bucket does not match environment')
  })
  it('does not use another concurrent request’s R2 binding', async () => {
    const other = { put: vi.fn() } as unknown as R2Bucket
    await Promise.all([withMediaBucket(bucket, async () => { await Promise.resolve(); expect(mediaBucket()).toBe(bucket) }), withMediaBucket(other, async () => { await Promise.resolve(); expect(mediaBucket()).toBe(other) })])
    expect(() => mediaBucket()).toThrow('not configured')
  })
  it('requires an accessible article for readers, including unlinked uploads', async () => {
    boundary.query.mockResolvedValue({ rows: [] })
    await expect(authorizeMediaRead(row, null)).rejects.toMatchObject({ status: 404 })
    boundary.query.mockResolvedValue({ rows: [{ article_id: row.id }] }); boundary.reader.mockResolvedValue({})
    await expect(authorizeMediaRead(row, null)).resolves.toBeUndefined()
  })
  it('accepts valid audio ranges and rejects malformed or out-of-bounds requests', () => {
    expect(mediaByteRange('bytes=2-4', 10)).toEqual({ offset: 2, length: 3 })
    expect(mediaByteRange('bytes=2-', 10)).toEqual({ offset: 2, length: 8 })
    expect(mediaByteRange('bytes=-3', 10)).toEqual({ offset: 7, length: 3 })
    for (const value of ['bytes=20-', 'bytes=-0', 'bytes=4-2', 'bytes=0-1,4-5', 'garbage']) expect(() => mediaByteRange(value, 10)).toThrow()
  })
})


describe('explicit permanent email access', () => {
  const approved = { ...row, email_serving_enabled: true, email_approved_by: viewer.id, email_approved_at: '2026-10-07T00:00:00Z' }
  it('does not sign outbound images and refuses assets lacking approval', async () => {
    await expect(emailMediaUrl(row.storage_path)).rejects.toMatchObject({ status: 409 })
    boundary.query.mockResolvedValue({ rows: [approved] })
    const url = await emailMediaUrl(row.storage_path)
    expect(url).toBe(`https://staging-media.smzwaldorf.com/media/${row.id}.png`)
    expect(url).not.toContain('token=')
    expect(() => permanentEmailMediaUrl({ ...approved, storage_bucket: 'smz-cms-media-production' })).toThrow('Media not found')
  })
  it('serves approved bytes anonymously, rejects unapproved audio and checks revocation every time', async () => {
    const get = vi.fn().mockImplementation(async () => ({ size: png.length, httpEtag: '"test"', body: new ReadableStream({ start(c) { c.enqueue(png); c.close() } }) }))
    const storage = { get } as unknown as R2Bucket
    const url = `https://staging-media.smzwaldorf.com/media/${row.id}.png`
    const serve = (request: Request) => withMediaBucket(storage, () => serveEmailMedia(request))
    boundary.query.mockResolvedValue({ rows: [approved] })
    const response = await serve(new Request(url))
    expect(response.status).toBe(200); expect(Buffer.from(await response.arrayBuffer())).toEqual(png)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect((await serve(new Request(url, { method: 'HEAD' }))).body).toBeNull()
    boundary.query.mockResolvedValue({ rows: [{ ...approved, email_serving_enabled: false }] })
    expect((await serve(new Request(url))).status).toBe(404)
    boundary.query.mockResolvedValue({ rows: [{ ...approved, mime_type: 'audio/mpeg', file_type: 'audio', email_serving_enabled: false }] })
    expect((await serve(new Request(url.replace('.png','.mp3')))).status).toBe(404)
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('isolates production, rejects wrong hosts, extensions and API routes on the media hostname', async () => {
    boundary.query.mockResolvedValue({ rows: [approved] })
    expect((await serveEmailMedia(new Request(`https://media.smzwaldorf.com/media/${row.id}.png`))).status).toBe(404)
    expect((await serveEmailMedia(new Request('https://staging-media.smzwaldorf.com/api/media/upload', { method:'POST' }))).status).toBe(404)
    expect((await serveEmailMedia(new Request(`https://staging-media.smzwaldorf.com/media/${row.id}.jpg`))).status).toBe(404)
    vi.stubEnv('MEDIA_STORAGE_ENVIRONMENT','production'); vi.stubEnv('MEDIA_R2_BUCKET','smz-cms-media-production'); vi.stubEnv('MEDIA_API_ORIGIN','https://cms.smzwaldorf.com')
    expect((await serveEmailMedia(new Request(`https://media.smzwaldorf.com/media/${row.id}.png`))).status).toBe(404)
  })
  it('requires administrator approval and records an audit event in the same transaction', async () => {
    await expect(setEmailMediaAccess(row.id, true, { ...viewer, role:'teacher', roles:['teacher'] })).rejects.toMatchObject({ status:403 })
    boundary.transaction.mockResolvedValue({ rows:[approved] })
    await setEmailMediaAccess(row.id,true,viewer)
    expect(boundary.transaction.mock.calls.find(([sql]) => sql.includes('UPDATE media_files'))?.[1]).toEqual([row.id,true,viewer.id])
    expect(boundary.transaction.mock.calls.find(([sql]) => sql.includes('INSERT INTO media_email_access_events'))?.[1]).toEqual([row.id,viewer.id,true])
  })
})
