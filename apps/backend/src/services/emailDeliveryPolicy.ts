import { runtimeEnvironment } from '#/runtime/environment'

export class DeliveryPolicyError extends Error {}

export function assertNewsletterDeliveryAllowed(recipients: Array<{ parentEmail?: string | null }>): void {
  const env = runtimeEnvironment()
  if (env.DELIVERY_ENABLED !== 'true') throw new DeliveryPolicyError('Newsletter delivery is disabled (DELIVERY_ENABLED)')
  const allowed = new Set((env.NEWSLETTER_TEST_RECIPIENTS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))
  if (env.NODE_ENV !== 'production' && allowed.size === 0) {
    throw new DeliveryPolicyError('Local newsletter delivery requires NEWSLETTER_TEST_RECIPIENTS')
  }
  if (allowed.size && recipients.some(recipient => !recipient.parentEmail || !allowed.has(recipient.parentEmail.trim().toLowerCase()))) {
    throw new DeliveryPolicyError('Delivery blocked: audience contains recipients outside the test allowlist')
  }
}
