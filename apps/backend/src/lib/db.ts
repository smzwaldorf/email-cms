import { AsyncLocalStorage } from 'node:async_hooks'
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

const transactionClient = new AsyncLocalStorage<PoolClient>()

let pool: Pool | null = null

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('Missing required backend environment variable: DATABASE_URL')
  }
  return url
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
    })
  }
  return pool
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return (transactionClient.getStore() ?? getPool()).query<T>(text, values)
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

export async function closePool(): Promise<void> {
  if (!pool) return
  await pool.end()
  pool = null
}

/** Keep service queries on the same connection until the entire business operation commits. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  if (transactionClient.getStore()) throw new Error('Nested transactions are not supported')
  return withClient(async client => {
    await client.query('BEGIN')
    try {
      const result = await transactionClient.run(client, () => fn(client))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}
