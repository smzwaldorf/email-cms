import { describe, expect, it } from 'vitest'

import { resolveEmailPlatformConfig } from '@/services/emailPlatform/config.ts'

describe('resolveEmailPlatformConfig', () => {
  it('uses defaults and accepts KIT_API_KEY', () => {
    const config = resolveEmailPlatformConfig((key) => {
      const values: Record<string, string> = {
        KIT_API_KEY: 'kit-token',
        KIT_WEBHOOK_SECRET: 'shared-secret',
      }

      return values[key]
    })

    expect(config.apiBaseUrl).toBe('https://api.kit.com')
    expect(config.apiToken).toBe('kit-token')
    expect(config.classTagPrefix).toBe('class:')
    expect(config.maxAttempts).toBe(5)
    expect(config.webhookSecretHeader).toBe('x-kit-webhook-secret')
  })

  it('throws a clear error when required secrets are missing', () => {
    expect(() => resolveEmailPlatformConfig(() => undefined)).toThrow(
      /Missing Kit configuration/i,
    )
  })

  it('validates numeric overrides', () => {
    expect(() =>
      resolveEmailPlatformConfig((key) => {
        const values: Record<string, string> = {
          KIT_API_TOKEN: 'kit-token',
          KIT_WEBHOOK_SECRET: 'shared-secret',
          KIT_MAX_ATTEMPTS: '0',
        }

        return values[key]
      }),
    ).toThrow(/KIT_MAX_ATTEMPTS must be a positive integer/i)
  })
})
