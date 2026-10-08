// Offline, durable R2 API smoke test. No Cloudflare requests or real bucket writes.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPlatformProxy } from 'wrangler'
const directory = await mkdtemp(join(tmpdir(),'cms-r2-binding-'))
const options = {configPath:fileURLToPath(new URL('../config/r2-development.jsonc',import.meta.url)),envFiles:[],remoteBindings:false,persist:{path:directory}}
let proxy
try {
 proxy=await getPlatformProxy(options)
 const key='development/smoke/persistent-audio.wav', data=Buffer.from('RIFF0000WAVE0123456789')
 await proxy.env.MEDIA_BUCKET.put(key,data,{httpMetadata:{contentType:'audio/wav'}})
 assert.equal((await proxy.env.MEDIA_BUCKET.head(key)).size,data.length)
 await proxy.dispose();proxy=undefined
 proxy=await getPlatformProxy(options)
 const object=await proxy.env.MEDIA_BUCKET.get(key,{range:{offset:12,length:4}})
 assert.equal(object.size,data.length);assert.equal(object.range.offset,12);assert.equal(object.range.length,4)
 assert.equal(Buffer.from(await object.arrayBuffer()).toString(),'0123')
 console.info('Local R2 binding verified: binary upload, metadata, persistence across proxy restart and audio byte ranges. No cloud objects created.')
}finally{await proxy?.dispose();await rm(directory,{recursive:true,force:true})}
