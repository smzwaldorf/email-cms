import {
  EmailPlatformConfig,
  EmailPlatformWebhookVerificationResult,
} from '../../types/emailPlatform.ts'

export function verifyKitWebhookSecret(
  request: Pick<Request, 'headers' | 'url'>,
  config: Pick<EmailPlatformConfig, 'webhookSecret' | 'webhookSecretHeader'>,
): EmailPlatformWebhookVerificationResult {
  const headerSecret = request.headers.get(config.webhookSecretHeader)
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const providedSecret = headerSecret ?? querySecret

  if (!providedSecret) {
    return {
      isValid: false,
      failureReason:
        `Missing webhook secret. Provide ${config.webhookSecretHeader} header or ?secret= query parameter.`,
    }
  }

  if (providedSecret !== config.webhookSecret) {
    return {
      isValid: false,
      failureReason: 'Invalid webhook secret.',
    }
  }

  return { isValid: true }
}
