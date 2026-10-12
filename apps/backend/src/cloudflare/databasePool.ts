import { Pool } from 'pg'

/** Hyperdrive shares origin connections; Worker clients remain invocation-scoped. */
export function poolFor(env: { HYPERDRIVE: { connectionString: string }; MEDIA_STORAGE_ENVIRONMENT?: string }): Pool {
  return new Pool({
    connectionString: env.HYPERDRIVE.connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
  })
}
