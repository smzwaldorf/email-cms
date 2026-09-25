import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configuration, pagesConfiguration } from './cloudflare-config.mjs'

test('Pages API proxy returns Worker redirects so the session cookie can be stored', async () => {
  const source = await readFile(new URL('./cloudflare-pages.mjs', import.meta.url), 'utf8')
  assert.match(source, /redirect: 'manual'/, 'OAuth callback is a 303 with Set-Cookie; service-binding fetch must not follow it')
  assert.match(source, /new Request\(request\.url,/, 'Pages must rebuild the downstream request without Pages-only request metadata')
})

test('both CMS Worker configurations bind directly to the staging SMZ Auth Worker', async () => {
  const generated = configuration({
    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_HYPERDRIVE_ID: 'b'.repeat(32),
    CMS_ORIGIN: 'https://cms.school.test', CMS_API_ORIGIN: 'https://api.school.test',
    SMZ_AUTH_ISSUER: 'https://auth.school.test/api/auth',
    NEWSLETTER_TEST_RECIPIENTS: 'a@school.test,b@school.test',
  })
  const checkedIn = JSON.parse(await readFile(new URL('../apps/backend/wrangler.jsonc', import.meta.url), 'utf8'))
  for (const config of [generated, checkedIn]) {
    assert.deepEqual(config.services, [{ binding: 'SMZ_AUTH', service: 'staging-smz-auth' }], 'CMS requires a direct Auth service binding to avoid Cloudflare 1042')
  }
})

const environment = {CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_HYPERDRIVE_ID:'b'.repeat(32),CMS_ORIGIN:'https://cms.school.test',CMS_API_ORIGIN:'https://api.school.test',SMZ_AUTH_ISSUER:'https://auth.school.test/api/auth'}
test('demo deployment requires two distinct addresses and enables delivery by default',()=>{
 assert.throws(()=>configuration({...environment,NEWSLETTER_DEMO_MODE:'true'}),/exactly two/)
 assert.throws(()=>configuration({...environment,NEWSLETTER_TEST_RECIPIENTS:'a@school.test,a@school.test'}),/Duplicate/)
 assert.throws(()=>configuration({...environment,NEWSLETTER_TEST_RECIPIENTS:'invalid,b@school.test'}),/Invalid/)
 const config=configuration({...environment,NEWSLETTER_DEMO_MODE:'true',NEWSLETTER_TEST_RECIPIENTS:'A@school.test,b@school.test'})
 assert.equal(config.vars.DELIVERY_ENABLED,'true')
 assert.equal(config.vars.NEWSLETTER_DEMO_MODE,'true')
 assert.equal(config.vars.NEWSLETTER_TEST_RECIPIENTS,'a@school.test,b@school.test')
})

test('production delivery needs no demo recipient configuration',()=>{
 const config=configuration(environment)
 assert.equal(config.vars.DELIVERY_ENABLED,'true')
 assert.equal(config.vars.NEWSLETTER_DEMO_MODE,'false')
 assert.equal(Object.hasOwn(config.vars,'NEWSLETTER_TEST_RECIPIENTS'),false)
})

for (const stage of ['staging', 'production']) test(`${stage} resources and bindings stay in the same environment`, () => {
 const env = {...environment, DEPLOYMENT_ENVIRONMENT: stage}
 const config = configuration(env), pages = pagesConfiguration(env)
 assert.equal(config.name, `${stage}-smz-news-api`)
 assert.equal(pages.name, `${stage}-smz-news`)
 assert.equal(config.services[0].service, `${stage}-smz-auth`)
 assert.equal(pages.services[0].service, config.name)
 assert.deepEqual(config.routes, [{pattern: 'api.school.test', custom_domain: true}])
})
test('rejects unknown deployment environments', () => assert.throws(() => configuration({...environment, DEPLOYMENT_ENVIRONMENT: 'typo'}), /Invalid DEPLOYMENT_ENVIRONMENT/))
