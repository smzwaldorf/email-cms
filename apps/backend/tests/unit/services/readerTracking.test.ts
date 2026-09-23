import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ bundle: vi.fn(), insert: vi.fn() }))
vi.mock('#/services/readerService', () => ({ readerService: { getWeekBundle: m.bundle } }))
vi.mock('#/lib/supabase', () => ({ getSupabaseClient: () => ({ from: () => ({ insert: m.insert }) }) }))
import { recordReaderEvent } from '#/services/readerTrackingService'
import type { AuthenticatedViewer } from '#/auth'
const articleId = 'de900000-0000-4000-8000-000000000401'
const newsletterId = 'de900000-0000-4000-8000-000000000301'
const event = { event_type: 'page_view', article_id: articleId, newsletter_id: newsletterId, session_id: 'de900000-0000-4000-8000-000000000501' }
beforeEach(() => {
 m.bundle.mockResolvedValue({ newsletter: { id: newsletterId, status: 'published' }, articles: [{ id: articleId, status: 'published' }] })
 m.insert.mockReset().mockResolvedValue({ error: null })
})
describe('reader tracking authorization', () => {
 it.each(['parent', 'admin'])('records ordinary %s reading as the authenticated user', async role => {
  const viewer = { id: 'real-user', role } as AuthenticatedViewer
  await recordReaderEvent({ ...event, user_id: 'forged', metadata: { source: 'resend', time_spent_seconds: 10 } }, viewer)
  expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ ...event, user_id: 'real-user', metadata: { source: 'cms_reader' } }))
 })
 it.each(['email_open', 'email_click', 'email_delivered'])('rejects forged provider event %s', async event_type => {
  await expect(recordReaderEvent({ ...event, event_type }, {} as AuthenticatedViewer)).rejects.toMatchObject({ status: 400 })
  expect(m.insert).not.toHaveBeenCalled()
 })
 it('rejects articles outside the visible newsletter', async () => {
  m.bundle.mockResolvedValue({ newsletter: { status: 'published' }, articles: [] })
  await expect(recordReaderEvent(event, {} as AuthenticatedViewer)).rejects.toMatchObject({ status: 404 })
 })
 it('excludes draft previews even for admins', async () => {
  m.bundle.mockResolvedValue({ newsletter: { status: 'draft' }, articles: [{ id: articleId, status: 'published' }] })
  await expect(recordReaderEvent(event, { role: 'admin' } as AuthenticatedViewer)).rejects.toMatchObject({ status: 404 })
 })
 it('validates session duration', async () => {
  await expect(recordReaderEvent({ ...event, event_type: 'session_end', metadata: { time_spent_seconds: -1 } }, {} as AuthenticatedViewer)).rejects.toMatchObject({ status: 400 })
 })
})
