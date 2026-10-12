import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { R2Bucket } from '@cloudflare/workers-types'
import type { AuthenticatedViewer } from '#/auth'
const boundary = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), viewer: null as AuthenticatedViewer | null }))
vi.mock('#/lib/db', () => ({ query: boundary.query, withTransaction: (run: (client: { query: typeof boundary.transaction }) => unknown) => run({ query: boundary.transaction }), withClient: vi.fn() }))
vi.mock('#/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('#/auth')>()
  return { ...actual, requireViewer: async () => { if (!boundary.viewer) throw new actual.HttpError(401, 'Authentication required'); return boundary.viewer }, optionalViewer: async () => boundary.viewer }
})
import { createCmsApplication } from '#/application'
import { startNodeHttp } from '#/runtime/nodeHttp'
import { getSupabaseClient } from '#/lib/supabase'
let stop: (() => Promise<void>) | undefined
let origin: string
const objects = new Map<string, Buffer>()
beforeEach(async () => {
  objects.clear(); boundary.query.mockReset(); boundary.transaction.mockReset()
  boundary.viewer = { id: '00000000-0000-4000-8000-000000000001', role: 'admin', roles: ['admin'], teacherClassIds: [], parentClassIds: [] } as AuthenticatedViewer
  vi.stubEnv('CMS_SESSION_ENABLED', 'false'); vi.stubEnv('MEDIA_STORAGE_ENVIRONMENT', 'development'); vi.stubEnv('MEDIA_R2_BUCKET', 'smz-cms-media-dev-staging'); vi.stubEnv('MEDIA_SIGNING_SECRET', 'a'.repeat(64))
  boundary.transaction.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes('sum(file_size)')) return { rows: [{ bytes: '0' }] }
    if (sql.includes('INSERT INTO media_files')) {
      const row = { id: values[0], filename: values[1], file_type: values[2], mime_type: values[3], file_size: values[4], storage_path: values[5], public_url: values[6], uploaded_by: values[7], storage_bucket: values[11], storage_environment: values[12] }
      boundary.query.mockResolvedValue({ rows: [row] }); return { rows: [row] }
    }
    return { rows: [] }
  })
  const bucket = {
    put: async (path: string, value: Buffer) => { objects.set(path, value); return {} },
    delete: async (path: string) => { objects.delete(path) },
    get: async (path: string, options?: { range?: { offset: number; length: number } }) => {
      const value = objects.get(path); if (!value) return null
      const range = options?.range
      const data = range ? value.subarray(range.offset, range.offset + range.length) : value
      return { size: value.length, range, httpEtag: '"test"', body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(data); controller.close() } }) }
    },
  } as unknown as R2Bucket
  const runtime = await startNodeHttp({ application: createCmsApplication({ supabase: getSupabaseClient(), corsOrigin: 'http://localhost:5173', mediaBucket: bucket }), host: '127.0.0.1', port: 0, closeResources: async () => {} })
  stop = runtime.stop; origin = `http://127.0.0.1:${(runtime.server.address() as AddressInfo).port}`; vi.stubEnv('MEDIA_API_ORIGIN', origin)
})
afterEach(async () => { await stop?.(); vi.unstubAllEnvs() })
const upload = (body: Buffer, mime: string, filename: string) => fetch(`${origin}/api/media/upload?filename=${filename}`, { method: 'POST', headers: { 'Content-Type': mime }, body })
describe('R2 upload and playback HTTP contract', () => {
  it('persists binary uploads and serves only signed image URLs', async () => {
    const bytes=Buffer.from([137,80,78,71,13,10,26,10,0]);const uploaded=await upload(bytes,'image/png','garden.png')
    expect(uploaded.status).toBe(201)
    const row=await uploaded.json();expect(row.uploaded_by).toBe(boundary.viewer!.id)
    const signed=await fetch(`${origin}/api/media/sign?path=${encodeURIComponent(row.storage_path)}`);expect(signed.status).toBe(200)
    const {url}=await signed.json();const response=await fetch(url)
    expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe('image/png');expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
    expect((await fetch(`${origin}/api/media/${row.id}/content`)).status).toBe(403)
    expect((await fetch(url,{method:'HEAD'})).headers.get('content-length')).toBe(String(bytes.length))
  })
  it('supports seeking in audio without disclosing the unsigned object', async () => {
    const bytes=Buffer.from('RIFF0000WAVE0123456789');const row=await (await upload(bytes,'audio/wav','story.wav')).json()
    const {url}=await (await fetch(`${origin}/api/media/sign?path=${encodeURIComponent(row.storage_path)}`)).json()
    const response=await fetch(url,{headers:{Range:'bytes=12-15'}})
    expect(response.status).toBe(206);expect(response.headers.get('content-range')).toBe(`bytes 12-15/${bytes.length}`);expect(await response.text()).toBe('0123')
    expect((await fetch(url,{headers:{Range:'bytes=100-'}})).status).toBe(416)
  })
  it('requires admin rights and explicit public acknowledgement for email approval', async () => {
    const row = await (await upload(Buffer.from([137,80,78,71,13,10,26,10,0]),'image/png','garden.png')).json()
    const setAccess = (payload: unknown) => fetch(`${origin}/api/media/${row.id}/email-access`, { method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload) })
    expect((await setAccess({enabled:true})).status).toBe(400)
    expect((await setAccess(null)).status).toBe(400)
    boundary.viewer={...boundary.viewer!,role:'teacher',roles:['teacher']}
    expect((await setAccess({enabled:true,acknowledgePublicAccess:true})).status).toBe(403)
    boundary.viewer=null
    expect((await setAccess({enabled:true,acknowledgePublicAccess:true})).status).toBe(401)
  })
  it('rejects untrusted uploads and prevents parents from uploading', async () => {
    expect((await upload(Buffer.from('<script>'),'image/png','garden.png')).status).toBe(415)
    boundary.viewer={...boundary.viewer!,role:'parent',roles:['parent']}
    expect((await upload(Buffer.from('ID3audio'),'audio/mpeg','story.mp3')).status).toBe(403)
    boundary.viewer=null
    expect((await upload(Buffer.from('ID3audio'),'audio/mpeg','story.mp3')).status).toBe(401)
    expect(objects.size).toBe(0)
  })
})
