import { config } from 'dotenv'
import { resolve } from 'node:path'
import { Pool } from 'pg'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required. Start Postgres with npm run db:up')
  }
  return url
}

let pool: Pool | null = null

export function createPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: databaseUrl() })
  return pool
}

function ident(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`)
  }
  return `"${name}"`
}

function authNotMigrated(): never {
  throw new Error('Auth is not migrated yet. OCID will replace Supabase Auth.')
}

export function createClient(..._args: unknown[]) {
  const db = createPool()
  return {
    from(table: string) {
      const state = { limit: 1 }
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        ilike() {
          return builder
        },
        limit(count: number) {
          state.limit = count
          return builder
        },
        then(
          resolve: (value: { data: unknown; error: { message: string } | null; count: number | null }) => unknown,
        ) {
          return db
            .query(`SELECT * FROM public.${ident(table)} LIMIT ${state.limit}`)
            .then((result) => resolve({ data: result.rows, error: null, count: result.rowCount }))
            .catch((err: unknown) => {
              const message = err instanceof Error ? err.message : String(err)
              return resolve({ data: null, error: { message }, count: null })
            })
        },
      }
      return builder
    },
    async rpc() {
      return { data: null, error: { message: 'Database RPCs that depended on Supabase were removed.' } }
    },
    auth: {
      signInWithPassword: authNotMigrated,
      signInWithOtp: authNotMigrated,
      signInWithOAuth: authNotMigrated,
      async signOut() {
        return { error: null }
      },
      admin: {
        createUser: authNotMigrated,
        deleteUser: authNotMigrated,
        listUsers: authNotMigrated,
        signOut: authNotMigrated,
      },
    },
  }
}
