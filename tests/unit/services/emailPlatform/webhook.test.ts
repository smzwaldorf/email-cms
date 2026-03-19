import { describe, expect, it } from 'vitest'

import { verifyKitWebhookSecret } from '@/services/emailPlatform/webhook.ts'

describe('verifyKitWebhookSecret', () => {
  const config = {
    webhookSecret: 'shared-secret',
    webhookSecretHeader: 'x-kit-webhook-secret',
  }

  it('accepts the shared secret from a header', () => {
    const request = new Request('https://example.com/webhook', {
      headers: {
        'x-kit-webhook-secret': 'shared-secret',
      },
    })

    expect(verifyKitWebhookSecret(request, config)).toEqual({ isValid: true })
  })

  it('accepts the shared secret from a query parameter fallback', () => {
    const request = new Request('https://example.com/webhook?secret=shared-secret')

    expect(verifyKitWebhookSecret(request, config)).toEqual({ isValid: true })
  })

  it('rejects missing or invalid secrets', () => {
    const missingSecretRequest = new Request('https://example.com/webhook')
    const invalidSecretRequest = new Request('https://example.com/webhook', {
      headers: {
        'x-kit-webhook-secret': 'wrong-secret',
      },
    })

    expect(verifyKitWebhookSecret(missingSecretRequest, config)).toEqual(
      expect.objectContaining({ isValid: false }),
    )
    expect(verifyKitWebhookSecret(invalidSecretRequest, config)).toEqual(
      expect.objectContaining({ isValid: false }),
    )
  })
})
