import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { R2Bucket } from '@cloudflare/workers-types'
const boundary = vi.hoisted(() => ({ query:vi.fn(), end:vi.fn(), pools:0 }))
vi.mock('pg', () => ({ Pool:class { constructor() { boundary.pools++ } query=boundary.query; end=boundary.end } }))
import { mediaFetch, type MediaEnv } from '#/cloudflare/mediaWorker'
const id='00000000-0000-4000-8000-000000000001'
const bytes=new Uint8Array([137,80,78,71,13,10,26,10])
const object=()=>({size:bytes.length,httpEtag:'"test"',body:new ReadableStream({start(c){c.enqueue(bytes);c.close()}})})
const env: MediaEnv={MEDIA_BUCKET:{get:vi.fn(async()=>object())} as unknown as R2Bucket,MEDIA_R2_BUCKET:'smz-cms-media-dev-staging',MEDIA_STORAGE_ENVIRONMENT:'staging',HYPERDRIVE:{connectionString:'postgres://test:test@localhost/smz-cms'}}
const row={id,storage_path:'staging/u/image.png',storage_bucket:env.MEDIA_R2_BUCKET,storage_environment:'staging',mime_type:'image/png',file_size:bytes.length,email_serving_enabled:true,email_approved_by:id,email_approved_at:'2026-10-07T00:00:00Z'}
beforeEach(()=>{boundary.pools=0;boundary.query.mockReset().mockResolvedValue({rows:[row]});boundary.end.mockReset().mockResolvedValue(undefined)})
describe('dedicated media origins',()=>{
 it('serves approved images without CMS login or signing secrets and closes the database pool',async()=>{
  const response=await mediaFetch(new Request(`https://staging-media.smzwaldorf.com/media/${id}.png`),env)
  expect(response.status).toBe(200);expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  expect(boundary.end).toHaveBeenCalledOnce()
 })
 it('exposes no CMS endpoints, previews, writes, host aliases or query parameters',async()=>{
  for(const request of [new Request('https://staging-media.smzwaldorf.com/'),new Request('https://staging-media.smzwaldorf.com/api/media/upload',{method:'POST'}),new Request(`https://wrong.smzwaldorf.com/media/${id}.png`),new Request(`https://staging-media.smzwaldorf.com/media/${id}.png?token=x`)]) expect((await mediaFetch(request,env)).status).toBe(404)
  expect(boundary.pools).toBe(0);expect(boundary.query).not.toHaveBeenCalled()
 })
 it('keeps legacy metadata private until approval fields exist',async()=>{
  boundary.query.mockResolvedValue({rows:[{id,mime_type:'image/png'}]})
  expect((await mediaFetch(new Request(`https://staging-media.smzwaldorf.com/media/${id}.png`),env)).status).toBe(404)
 })
 it('fails closed when the database is unavailable or the environment binding is wrong',async()=>{
  boundary.query.mockRejectedValue(new Error('database unavailable'))
  expect((await mediaFetch(new Request(`https://staging-media.smzwaldorf.com/media/${id}.png`),env)).status).toBe(503)
  expect(boundary.end).toHaveBeenCalledOnce()
  expect((await mediaFetch(new Request(`https://media.smzwaldorf.com/media/${id}.png`),{...env,MEDIA_STORAGE_ENVIRONMENT:'production'})).status).toBe(503)
 })
})
