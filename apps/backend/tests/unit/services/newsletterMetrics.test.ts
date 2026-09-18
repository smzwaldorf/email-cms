import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCmsMemoryStore } from '../../helpers/cmsMemoryStore'
const holder = vi.hoisted(() => ({ store: null as ReturnType<typeof createCmsMemoryStore> | null }))
vi.mock('#/lib/supabase', () => ({ getSupabaseClient: () => ({ from: holder.store!.from }) }))
import { analyticsAggregator } from '#/services/analyticsAggregator'
beforeEach(() => { holder.store = createCmsMemoryStore(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) })
afterEach(() => vi.useRealTimers())
describe('newsletter rates use recorded sends', () => {
  it('deduplicates resends and excludes known automated opens', async () => {
    holder.store!.rows('newsletter_delivery_batches').push({ id: 'b1', newsletter_id: 'n1' }, { id: 'b2', newsletter_id: 'n1' })
    holder.store!.rows('newsletter_delivery_batch_recipients').push(
      { batch_id: 'b1', parent_id: 'p1', send_status: 'sent' }, { batch_id: 'b1', parent_id: 'p2', send_status: 'sent' },
      { batch_id: 'b2', parent_id: 'p1', send_status: 'sent' }, { batch_id: 'b1', parent_id: 'p3', send_status: 'failed' })
    holder.store!.rows('analytics_events').push(
      { newsletter_id: 'n1', user_id: 'p1', event_type: 'email_open', metadata: {} },
      { newsletter_id: 'n1', user_id: 'p2', event_type: 'email_open', metadata: { qualification: 'automated_or_proxy' } },
      { newsletter_id: 'n1', user_id: 'p1', event_type: 'link_click', metadata: {} })
    expect(await analyticsAggregator.getNewsletterMetrics('n1')).toMatchObject({ openRate: 50, clickRate: 50 })
  })
  it('does not invent a denominator when no send records exist', async () => {
    holder.store!.rows('analytics_events').push({ newsletter_id: 'n1', user_id: 'p1', event_type: 'email_open', metadata: {} })
    expect(await analyticsAggregator.getNewsletterMetrics('n1')).toMatchObject({ openRate: 0, clickRate: 0 })
  })
})
