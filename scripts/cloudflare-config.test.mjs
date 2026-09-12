import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configuration } from './cloudflare-config.mjs'

test('both CMS Worker configurations bind directly to the production SMZ Auth Worker', async () => {
  const generated = configuration({
    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_HYPERDRIVE_ID: 'b'.repeat(32),
    CMS_ORIGIN: 'https://cms.school.test', CMS_API_ORIGIN: 'https://api.school.test',
    SMZ_AUTH_ISSUER: 'https://auth.school.test/api/auth',
  })
  const checkedIn = JSON.parse(await readFile(new URL('../apps/backend/wrangler.jsonc', import.meta.url), 'utf8'))
  for (const config of [generated, checkedIn]) {
    assert.deepEqual(config.services, [{ binding: 'SMZ_AUTH', service: 'smz-auth' }], 'CMS requires a direct Auth service binding to avoid Cloudflare 1042')
  }
})
