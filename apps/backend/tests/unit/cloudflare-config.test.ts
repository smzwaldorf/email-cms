import { describe, expect, it } from 'vitest'
import { validateEnvironment, type Env } from '#/cloudflare/config'
const valid: Env = {
  HYPERDRIVE: { connectionString: 'postgres://local:local@localhost/smz-cms' },
  SMZ_AUTH_ISSUER: 'https://auth.school.test/api/auth', APP_URL: 'https://cms.school.test', BACKEND_CORS_ORIGIN: 'https://cms.school.test', DELIVERY_ENABLED: 'false',
}
describe('Worker production configuration', () => {
  it('does not expose the database binding through runtime environment', () => {
    const config = validateEnvironment(valid)
    expect(config.APP_URL).toBe(valid.APP_URL)
    expect(config.NODE_ENV).toBe('production')
    expect(config.HYPERDRIVE).toBeUndefined()
    expect(config.DATABASE_URL).toBeUndefined()
  })
  it('enables delivery when no switch is configured', () => {
    expect(validateEnvironment({ ...valid, DELIVERY_ENABLED: undefined }).DELIVERY_ENABLED).toBe('true')
  })
  it.each([
    { APP_URL: 'http://localhost:5174' }, { APP_URL: 'https://cms.example.com' },
    { BACKEND_CORS_ORIGIN: 'https://different.school.test' }, { SMZ_AUTH_ISSUER: 'https://auth.school.test/wrong' },
    { HYPERDRIVE: undefined }, { DELIVERY_ENABLED: 'yes' },
  ])('rejects invalid configuration %j', changes => {
    expect(() => validateEnvironment({ ...valid, ...changes } as Env)).toThrow()
  })
})
