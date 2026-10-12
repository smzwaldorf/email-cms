/** Recognize exhaustion even when a service wraps the provider's error. */
export function isDatabaseBusy(error: unknown): boolean {
  const seen = new Set<unknown>()
  while (error && typeof error === 'object' && !seen.has(error)) {
    seen.add(error)
    const value = error as { code?: unknown; message?: unknown; cause?: unknown; originalError?: unknown }
    if (value.code === '53300' || (typeof value.message === 'string' && /remaining connection slots are reserved|too many clients already/i.test(value.message))) return true
    error = value.cause ?? value.originalError
  }
  return false
}

export const DATABASE_BUSY_MESSAGE = '服務暫時忙碌，請稍後再試。The service is temporarily busy. Please try again shortly.'
