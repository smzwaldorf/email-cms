import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyHyperdrivePolicy } from './hyperdrive-policy.mjs'

test('staging deployment rejects an oversized or unspecified origin pool', () => {
  const config = { origin: { database: 'smz-cms', port: 6432 }, caching: { disabled: true } }
  for (const origin_connection_limit of [undefined, 10, 20, 100]) {
    assert.throws(() => verifyHyperdrivePolicy({ ...config, origin_connection_limit }, 'smz-cms'), /connection limit/)
  }
  assert.doesNotThrow(() => verifyHyperdrivePolicy({ ...config, origin_connection_limit: 5 }, 'smz-cms'))
  assert.throws(() => verifyHyperdrivePolicy({ ...config, origin_connection_limit: 5 }, 'production-news'), /target/)
  assert.throws(() => verifyHyperdrivePolicy({ ...config, origin_connection_limit: 5, caching: { disabled: false } }, 'smz-cms'), /caching/)
})

test('staging and production application connectors must use PgBouncer', () => {
  for (const database of ['smz-auth', 'smz-cms', 'production-auth', 'production-news']) {
    const config = { origin: { database, port: 6432 }, caching: { disabled: true }, origin_connection_limit: 5 }
    for (const port of [undefined, 5432]) {
      assert.throws(() => verifyHyperdrivePolicy({ ...config, origin: { database, port } }, database), /PgBouncer/)
    }
    assert.doesNotThrow(() => verifyHyperdrivePolicy(config, database))
  }
})
