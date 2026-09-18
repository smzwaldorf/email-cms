import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configuration } from './cloudflare-config.mjs'

test('both CMS Worker configurations bind directly to the production SMZ Auth Worker', async () => {
  const generated = configuration({
    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_HYPERDRIVE_ID: 'b'.repeat(32),
    CMS_ORIGIN: 'https://cms.school.test', CMS_API_ORIGIN: 'https://api.school.test',
    SMZ_AUTH_ISSUER: 'https://auth.school.test/api/auth',
    NEWSLETTER_TEST_RECIPIENTS: 'a@school.test,b@school.test',
  })
  const checkedIn = JSON.parse(await readFile(new URL('../apps/backend/wrangler.jsonc', import.meta.url), 'utf8'))
  for (const config of [generated, checkedIn]) {
    assert.deepEqual(config.services, [{ binding: 'SMZ_AUTH', service: 'smz-auth' }], 'CMS requires a direct Auth service binding to avoid Cloudflare 1042')
  }
})

const environment = {CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_HYPERDRIVE_ID:'b'.repeat(32),CMS_ORIGIN:'https://cms.school.test',CMS_API_ORIGIN:'https://api.school.test',SMZ_AUTH_ISSUER:'https://auth.school.test/api/auth'}
test('demo deployment requires two distinct addresses and always disables delivery',()=>{
 assert.throws(()=>configuration(environment),/exactly two/)
 assert.throws(()=>configuration({...environment,NEWSLETTER_TEST_RECIPIENTS:'a@school.test,a@school.test'}),/Duplicate/)
 assert.throws(()=>configuration({...environment,NEWSLETTER_TEST_RECIPIENTS:'invalid,b@school.test'}),/Invalid/)
 const config=configuration({...environment,NEWSLETTER_TEST_RECIPIENTS:'A@school.test,b@school.test',DELIVERY_ENABLED:'true'})
 assert.equal(config.vars.DELIVERY_ENABLED,'false')
 assert.equal(config.vars.NEWSLETTER_DEMO_MODE,'true')
 assert.equal(config.vars.NEWSLETTER_TEST_RECIPIENTS,'a@school.test,b@school.test')
})
