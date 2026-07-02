export interface BackendConfig {
  port: number
  corsOrigin: string
  workerId: string
  workerPollIntervalMs: number
  workerBatchSize: number
}

function readPositiveInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`)
  }
  return parsed
}

export function loadBackendConfig(): BackendConfig {
  return {
    port: readPositiveInt('PORT', 8787),
    corsOrigin: process.env.BACKEND_CORS_ORIGIN ?? 'http://localhost:5173',
    workerId: process.env.NEWSLETTER_WORKER_ID ?? `newsletter-worker-${process.pid}`,
    workerPollIntervalMs: readPositiveInt('NEWSLETTER_WORKER_POLL_INTERVAL_MS', 5_000),
    workerBatchSize: readPositiveInt('NEWSLETTER_WORKER_BATCH_SIZE', 3),
  }
}
