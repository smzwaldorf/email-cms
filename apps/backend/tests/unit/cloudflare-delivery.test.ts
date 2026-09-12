import { afterEach, describe, expect, it, vi } from 'vitest'
import { Pool } from 'pg'
vi.mock('cloudflare:node', () => ({ httpServerHandler: vi.fn() }))
import worker from '#/cloudflare/worker'
import type { Env } from '#/cloudflare/config'
import { NewsletterDeliveryWorker } from '#/worker/deliveryWorker'
import { runtimeEnvironment } from '#/runtime/environment'
const env: Env = {
  HYPERDRIVE: { connectionString: 'postgres://test:test@localhost/smz-cms' },
  SMZ_AUTH_ISSUER: 'https://auth.school.test/api/auth', APP_URL: 'https://cms.school.test', BACKEND_CORS_ORIGIN: 'https://cms.school.test',
  DELIVERY_ENABLED: 'false',
}
afterEach(() => vi.restoreAllMocks())
describe('scheduled delivery activation', () => {
  it('never runs jobs or opens a pool when deployment leaves delivery disabled', async () => {
    const execute = vi.spyOn(NewsletterDeliveryWorker.prototype, 'runOnce')
    const close = vi.spyOn(Pool.prototype, 'end')
    await worker.scheduled({} as ScheduledController, env)
    expect(execute).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
  it('rejects activation without secrets before executing', async () => {
    const execute = vi.spyOn(NewsletterDeliveryWorker.prototype, 'runOnce')
    await expect(worker.scheduled({} as ScheduledController, { ...env, DELIVERY_ENABLED: 'true' })).rejects.toThrow('Delivery secrets')
    expect(execute).not.toHaveBeenCalled()
  })
  it('closes the invocation pool on executor failure and restores environment', async () => {
    vi.spyOn(NewsletterDeliveryWorker.prototype, 'runOnce').mockImplementation(async () => {
      expect(runtimeEnvironment().APP_URL).toBe(env.APP_URL)
      throw new Error('simulated job failure')
    })
    const close = vi.spyOn(Pool.prototype, 'end')
    await expect(worker.scheduled({} as ScheduledController, { ...env, DELIVERY_ENABLED: 'true', KIT_API_TOKEN: 'fake', KIT_WEBHOOK_SECRET: 'fake', JWT_SECRET: 'fake' })).rejects.toThrow('simulated job failure')
    expect(close).toHaveBeenCalledOnce()
    expect(runtimeEnvironment()).toBe(process.env)
  })
})
