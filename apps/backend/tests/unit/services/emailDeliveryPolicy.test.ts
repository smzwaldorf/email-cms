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
