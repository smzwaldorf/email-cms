import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertNewsletterDeliveryAllowed } from '#/services/emailDeliveryPolicy'
afterEach(() => vi.unstubAllEnvs())
describe('controlled newsletter delivery', () => {
  it('requires explicit enablement and a local recipient allowlist', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DELIVERY_ENABLED', 'false')
    expect(() => assertNewsletterDeliveryAllowed([])).toThrow('disabled')
    vi.stubEnv('DELIVERY_ENABLED', 'true')
    vi.stubEnv('NEWSLETTER_TEST_RECIPIENTS', '')
    expect(() => assertNewsletterDeliveryAllowed([])).toThrow('NEWSLETTER_TEST_RECIPIENTS')
    vi.stubEnv('NEWSLETTER_TEST_RECIPIENTS', 'tester@example.test')
    expect(() => assertNewsletterDeliveryAllowed([{ parentEmail: 'Tester@example.test' }])).not.toThrow()
    expect(() => assertNewsletterDeliveryAllowed([{ parentEmail: 'other@example.test' }])).toThrow('outside the test allowlist')
  })
})

it('requires an exact recipient allowlist for a hosted production demo', () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('DELIVERY_ENABLED', 'true')
  vi.stubEnv('NEWSLETTER_DEMO_MODE', 'true')
  vi.stubEnv('NEWSLETTER_TEST_RECIPIENTS', '')
  expect(() => assertNewsletterDeliveryAllowed([{ parentEmail: 'a@example.test' }])).toThrow('NEWSLETTER_TEST_RECIPIENTS')
  vi.stubEnv('NEWSLETTER_TEST_RECIPIENTS', 'a@example.test,b@example.test')
  expect(() => assertNewsletterDeliveryAllowed([{ parentEmail: 'a@example.test' }, { parentEmail: 'b@example.test' }])).not.toThrow()
  expect(() => assertNewsletterDeliveryAllowed([{ parentEmail: 'unexpected@example.test' }])).toThrow('outside the test allowlist')
})
