import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const request = vi.hoisted(() => vi.fn())
vi.mock('@/services/backendApi', () => ({ backendRequest: request }))
import { trackingService } from '@/services/trackingService'
const event = { event_type: 'page_view' as const, article_id: 'a1', newsletter_id: 'n1', user_id: 'untrusted', session_id: 's1', metadata: {} }
beforeEach(() => { request.mockReset().mockResolvedValue({ accepted: true }) })
afterEach(() => vi.unstubAllEnvs())
describe('reader tracking transport', () => {
 it('records views by default without the legacy tracking flag or a client-supplied identity', async () => {
  vi.stubEnv('VITE_TRACKING_ENABLED', '')
  await trackingService.logEvent(event)
  expect(request).toHaveBeenCalledWith('/api/reader/events', expect.objectContaining({ method: 'POST', keepalive: true }))
  const payload = JSON.parse(request.mock.calls[0][1].body)
  expect(payload).toMatchObject({ article_id: 'a1', newsletter_id: 'n1', event_type: 'page_view' })
  expect(payload).not.toHaveProperty('user_id')
 })
 it('does not disrupt reading when recording fails', async () => {
  request.mockRejectedValue(new Error('offline'))
  await expect(trackingService.logEvent(event)).resolves.toBeUndefined()
 })
 it('loads only the signed-in readers history via the reader API', async () => {
  request.mockResolvedValue(['a1'])
  expect(await trackingService.getReadArticles('ignored-user', '2026-W39')).toEqual(['a1'])
  expect(request).toHaveBeenCalledWith('/api/reader/read-articles?newsletterId=2026-W39')
 })
 it('returns an empty history on failure', async () => {
  request.mockRejectedValue(new Error('offline'))
  expect(await trackingService.getReadArticles('u1', 'n1')).toEqual([])
 })
})
