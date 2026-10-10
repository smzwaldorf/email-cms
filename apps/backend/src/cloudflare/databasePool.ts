import { Pool } from 'pg'

/** Hyperdrive shares origin connections; Worker clients remain invocation-scoped. */
export function poolFor(env: { HYPERDRIVE: { connectionString: string }; MEDIA_STORAGE_ENVIRONMENT?: string }): Pool {
  return new Pool({
    connectionString: env.HYPERDRIVE.connectionString,
    max: env.MEDIA_STORAGE_ENVIRONMENT === 'staging' ? 1 : 3,
    connectionTimeoutMillis: 10_000,
  })
}
