import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ query: vi.fn(), renew: vi.fn() }))
vi.mock('#/lib/db', () => ({ query: mocks.query }))
vi.mock('#/session/oidc', () => ({ RenewalUnavailable: class extends Error { exchangeStarted = false }, issuer: () => 'https://identity.test/api/auth', appOrigin: () => 'https://cms.test', renew: mocks.renew, terminalRefreshError: (e: unknown) => (e as { code?: string })?.code === 'invalid_grant' }))
import { withRuntimeEnvironment } from '#/runtime/environment'
import { seal, unseal } from '#/session/crypto'
import { sessionCredentials, type BrowserSession } from '#/session/store'
import { checkSessionCsrf } from '#/session/http'
import type { IncomingMessage } from 'node:http'
const env = { CMS_SESSION_SECRET: 'a'.repeat(64), APP_URL: 'https://cms.test' }
const run = <T>(fn: () => T) => withRuntimeEnvironment(env, fn)
function session(): BrowserSession {
  return { id_hash: 'session-hash', issuer: 'https://identity.test/api/auth', subject: 'person', credentials: seal({ access_token: 'old', refresh_token: 'refresh', expires_in: 900 }, 'session-hash'), access_expires_at: new Date(Date.now() + 45_000), identity_snapshot: null, state: 'active', generation: 1, refresh_owner: null, refresh_until: null }
}
beforeEach(() => { vi.resetAllMocks() })
describe('persistent server session boundaries', () => {
  it('encrypts credentials and binds ciphertext to the session', () => run(() => {
    const ciphertext = seal({ refresh: 'private-token' }, 'session-a')
    expect(ciphertext).not.toContain('private-token')
    expect(unseal(ciphertext, 'session-a')).toEqual({ refresh: 'private-token' })
    expect(() => unseal(ciphertext, 'session-b')).toThrow()
    expect(() => unseal(ciphertext.slice(0, -8) + 'tampered', 'session-a')).toThrow()
  }))
  it('rejects missing key and cross-origin mutations', () => {
    expect(() => withRuntimeEnvironment({}, () => seal({}, 'test'))).toThrow()
    run(() => {
      expect(() => checkSessionCsrf({ method: 'POST', headers: { origin: 'https://evil.test', 'x-cms-request': '1' } } as unknown as IncomingMessage)).toThrow()
      expect(() => checkSessionCsrf({ method: 'POST', headers: { origin: 'https://cms.test' } } as unknown as IncomingMessage)).toThrow()
      expect(() => checkSessionCsrf({ method: 'POST', headers: { origin: 'https://cms.test', 'x-cms-request': '1' } } as unknown as IncomingMessage)).not.toThrow()
    })
  })
  it('keeps still-valid authorization during a proactive refresh outage without replaying refresh', async () => run(async () => {
    const current = session()
    mocks.query.mockResolvedValueOnce({ rowCount: 1, rows: [current] })
    mocks.renew.mockRejectedValue(new TypeError('network unavailable'))
    await expect(sessionCredentials(current)).resolves.toMatchObject({ access_token: 'old' })
    expect(current.state).toBe('active')
    expect(mocks.query).toHaveBeenCalledTimes(1)
  }))
  it('atomically persists renewed credentials before using them', async () => run(async () => {
    const current = session()
    mocks.query.mockResolvedValueOnce({ rowCount: 1, rows: [current] }).mockImplementationOnce(async (_sql, values) => ({ rowCount: 1, rows: [{ ...current, credentials: values[2], generation: 2 }] }))
    mocks.renew.mockResolvedValue({ access_token: 'new', refresh_token: 'rotated', expires_in: 900 })
    await expect(sessionCredentials(current)).resolves.toMatchObject({ access_token: 'new' })
    expect(current.generation).toBe(2)
    expect(unseal(current.credentials!, current.id_hash)).toMatchObject({ refresh_token: 'rotated' })
  }))
  it('does not restore a session revoked while refresh is in flight', async () => run(async () => {
    const current = session()
    mocks.query.mockResolvedValueOnce({ rowCount: 1, rows: [current] }).mockResolvedValueOnce({ rowCount: 0, rows: [] })
    mocks.renew.mockResolvedValue({ access_token: 'new', refresh_token: 'rotated', expires_in: 900 })
    await expect(sessionCredentials(current)).rejects.toMatchObject({ status: 403, code: 'access_revoked' })
  }))
  it('retains remembered identity when refresh credentials are terminally rejected', async () => run(async () => {
    const current = session()
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [current] })
    mocks.renew.mockRejectedValue({ code: 'invalid_grant' })
    await expect(sessionCredentials(current)).rejects.toMatchObject({ code: 'reauthentication_required' })
    expect(mocks.query.mock.calls[1][0]).not.toContain('identity_snapshot=NULL')
  }))
})
