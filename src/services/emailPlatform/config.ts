import {
  EmailPlatformConfig,
  EmailPlatformConfigurationError,
} from '../../types/emailPlatform.ts'

type EnvReader = (key: string) => string | undefined

function parsePositiveInt(
  rawValue: string | undefined,
  fallbackValue: number,
  envKey: string,
): number {
  if (!rawValue) {
    return fallbackValue
  }

  const parsedValue = Number.parseInt(rawValue, 10)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new EmailPlatformConfigurationError(
      `${envKey} must be a positive integer, received "${rawValue}".`,
      { envKey, rawValue },
    )
  }

  return parsedValue
}

function normalizeBaseUrl(rawBaseUrl: string | undefined): string {
  if (!rawBaseUrl) {
    return 'https://api.kit.com'
  }

  return rawBaseUrl.replace(/\/+$/, '')
}

export function resolveEmailPlatformConfig(readEnv: EnvReader): EmailPlatformConfig {
  const apiToken =
    readEnv('KIT_API_TOKEN') ??
    readEnv('KIT_API_KEY') ??
    readEnv('KIT_API_SECRET')

  const webhookSecret = readEnv('KIT_WEBHOOK_SECRET')
  const missingKeys: string[] = []

  if (!apiToken) {
    missingKeys.push('KIT_API_TOKEN (or KIT_API_KEY / KIT_API_SECRET)')
  }

  if (!webhookSecret) {
    missingKeys.push('KIT_WEBHOOK_SECRET')
  }

  if (missingKeys.length > 0) {
    throw new EmailPlatformConfigurationError(
      `Missing Kit configuration: ${missingKeys.join(', ')}. ` +
        'Set the provider secrets before starting outbound sync or webhook handlers.',
      { missingKeys },
    )
  }

  return {
    provider: 'kit',
    apiBaseUrl: normalizeBaseUrl(readEnv('KIT_API_BASE_URL')),
    apiToken: apiToken as string,
    webhookSecret: webhookSecret as string,
    webhookSecretHeader:
      readEnv('KIT_WEBHOOK_SECRET_HEADER')?.toLowerCase() ?? 'x-kit-webhook-secret',
    maxAttempts: parsePositiveInt(readEnv('KIT_MAX_ATTEMPTS'), 5, 'KIT_MAX_ATTEMPTS'),
    initialRetryDelayMs: parsePositiveInt(
      readEnv('KIT_INITIAL_RETRY_DELAY_MS'),
      60_000,
      'KIT_INITIAL_RETRY_DELAY_MS',
    ),
    maxRetryDelayMs: parsePositiveInt(
      readEnv('KIT_MAX_RETRY_DELAY_MS'),
      3_600_000,
      'KIT_MAX_RETRY_DELAY_MS',
    ),
    workerBatchSize: parsePositiveInt(
      readEnv('KIT_WORKER_BATCH_SIZE'),
      25,
      'KIT_WORKER_BATCH_SIZE',
    ),
    reconciliationBatchSize: parsePositiveInt(
      readEnv('KIT_RECONCILIATION_BATCH_SIZE'),
      50,
      'KIT_RECONCILIATION_BATCH_SIZE',
    ),
    classTagPrefix: readEnv('KIT_CLASS_TAG_PREFIX') ?? 'class:',
  }
}
