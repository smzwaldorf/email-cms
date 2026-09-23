import { beforeEach, expect, it, vi } from 'vitest'
import { createCmsMemoryStore } from '../../helpers/cmsMemoryStore'
const m = vi.hoisted(() => ({ bundle: vi.fn(), store: null as ReturnType<typeof createCmsMemoryStore> | null }))
vi.mock('#/services/readerService', () => ({ readerService: { getWeekBundle: m.bundle } }))
vi.mock('#/lib/supabase', () => ({ getSupabaseClient: () => ({ from: m.store!.from }) }))
import { getReaderReadArticles } from '#/services/readerTrackingService'
import type { AuthenticatedViewer } from '#/auth'
beforeEach(() => { m.store = createCmsMemoryStore(); m.bundle.mockResolvedValue({ newsletter: { id: 'n1' }, articles: [{ id: 'a1' }] }) })
it('returns only the readers visible article history for the selected newsletter', async () => {
 m.store!.rows('analytics_events').push(
  { user_id: 'u1', newsletter_id: 'n1', article_id: 'a1', event_type: 'page_view' },
  { user_id: 'u1', newsletter_id: 'n1', article_id: 'a1', event_type: 'page_view' },
  { user_id: 'u1', newsletter_id: 'n1', article_id: 'hidden', event_type: 'page_view' },
  { user_id: 'other', newsletter_id: 'n1', article_id: 'a2', event_type: 'page_view' },
  { user_id: 'u1', newsletter_id: 'other', article_id: 'a3', event_type: 'page_view' })
 expect(await getReaderReadArticles('week', { id: 'u1' } as AuthenticatedViewer)).toEqual(['a1'])
})
