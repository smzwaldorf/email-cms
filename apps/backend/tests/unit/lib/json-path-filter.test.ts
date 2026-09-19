import { afterEach, describe, expect, it, vi } from 'vitest'
const database = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [], rowCount: 0 })) }))
vi.mock('#/lib/db', () => database)
import { createHmac } from 'node:crypto'
import { from } from '#/lib/query'
import { emailTrackingEndpointService } from '#/services/emailTrackingEndpointService'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('PostgREST JSON path filters', () => {
  it('translates column->>key filters into JSONB text extraction', async () => {
    await from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'link_click')
      .eq('metadata->>target_url', 'http://localhost:5173/article/a1')
    const [sql, values] = database.query.mock.lastCall!
    expect(sql).toContain(`"analytics_events"."metadata"->>'target_url' = $2`)
    expect(values).toEqual(['link_click', 'http://localhost:5173/article/a1'])
  })

  it('supports nested -> / ->> steps', async () => {
    await from('analytics_events').select('id').eq('metadata->journey->>id', 'j1')
    expect(database.query.mock.lastCall![0]).toContain(`"analytics_events"."metadata"->'journey'->>'id' = $1`)
  })

  it('still rejects identifiers that are not plain columns or JSON paths', async () => {
    database.query.mockClear()
    const result = await from('analytics_events').select('id').eq(`metadata->>'x'; DROP TABLE analytics_events;--`, 'v')
    expect(result.error?.message).toContain('Invalid identifier')
    expect(database.query).not.toHaveBeenCalled()
  })
})

describe('click tracking through the SQL query layer', () => {
  it('redirects a signed click instead of failing on the target_url dedupe lookup', async () => {
    vi.stubEnv('JWT_SECRET', 'synthetic-secret')
    vi.stubEnv('APP_URL', 'http://localhost:5173')
    const target = 'http://localhost:5173/week/2025-W38?jc=j1'
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({ sub: 'p1', nwl: 'n1', jti: 'j1', target, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url')
    const token = `${header}.${payload}.${createHmac('sha256', 'synthetic-secret').update(`${header}.${payload}`).digest('base64url')}`

    const result = await emailTrackingEndpointService.handleClick(token, target, { userAgent: 'Browser' })

    expect(result).toEqual({ status: 302, redirectUrl: target })
    const [dedupeSql] = database.query.mock.calls[0]
    expect(dedupeSql).toContain(`"analytics_events"."metadata"->>'target_url'`)
    const [insertSql] = database.query.mock.calls[1]
    expect(insertSql).toContain('INSERT INTO "analytics_events"')
  })
})
