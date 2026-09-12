import { runtimeEnvironment } from '#/runtime/environment'
export interface BackendConfig {
  port: number
  corsOrigin: string
  workerId: string
  workerPollIntervalMs: number
  workerBatchSize: number
}

function readPositiveInt(key: string, fallback: number): number {
  const raw = runtimeEnvironment()[key]
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
    corsOrigin: runtimeEnvironment().BACKEND_CORS_ORIGIN ?? 'http://localhost:5174',
    workerId: runtimeEnvironment().NEWSLETTER_WORKER_ID ?? `newsletter-worker-${process.pid}`,
    workerPollIntervalMs: readPositiveInt('NEWSLETTER_WORKER_POLL_INTERVAL_MS', 5_000),
    workerBatchSize: readPositiveInt('NEWSLETTER_WORKER_BATCH_SIZE', 3),
  }
}
