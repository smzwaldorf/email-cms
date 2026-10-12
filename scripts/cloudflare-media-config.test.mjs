import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mediaWorkerConfiguration} from './cloudflare-media-config.mjs'
const base={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_HYPERDRIVE_ID:'b'.repeat(32)}
test('media domains are owned by isolated read-only Workers with their matching buckets',()=>{
 for(const environment of ['staging','production']) {
  const config=mediaWorkerConfiguration({...base,CMS_DEPLOY_ENVIRONMENT:environment})
  assert.equal(config.name,`${environment}-smz-news-media`)
  assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false)
  assert.deepEqual(config.routes,[{pattern:environment==='production'?'media.smzwaldorf.com':'staging-media.smzwaldorf.com',custom_domain:true}])
  assert.deepEqual(config.r2_buckets,[{binding:'MEDIA_BUCKET',bucket_name:environment==='production'?'smz-cms-media-production':'smz-cms-media-dev-staging'}])
  assert.equal(config.services,undefined);assert.equal(config.triggers,undefined)
  assert.deepEqual(Object.keys(config.vars).sort(),['MEDIA_R2_BUCKET','MEDIA_STORAGE_ENVIRONMENT'])
 }
 assert.throws(()=>mediaWorkerConfiguration({...base,CMS_DEPLOY_ENVIRONMENT:'development'}),/Select staging or production/)
})
