import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCmsMemoryStore } from '../../helpers/cmsMemoryStore'
const holder = vi.hoisted(() => ({ store: null as ReturnType<typeof createCmsMemoryStore> | null }))
vi.mock('#/lib/supabase', () => ({ getSupabaseClient: () => ({ from: holder.store!.from }) }))
import { analyticsAggregator } from '#/services/analyticsAggregator'
beforeEach(() => { holder.store = createCmsMemoryStore(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) })
afterEach(() => vi.useRealTimers())
describe('newsletter rates use Resend delivery confirmations', () => {
  it('deduplicates recipients and uses only Resend opens, clicks, and deliveries', async () => {
    holder.store!.rows('newsletter_delivery_batches').push({ id: 'b1', newsletter_id: 'n1' }, { id: 'b2', newsletter_id: 'n1' })
    holder.store!.rows('newsletter_delivery_batch_recipients').push(
      { batch_id: 'b1', parent_id: 'p1', send_status: 'sent' }, { batch_id: 'b1', parent_id: 'p2', send_status: 'sent' },
      { batch_id: 'b2', parent_id: 'p1', send_status: 'sent' }, { batch_id: 'b1', parent_id: 'p4', send_status: 'sent' }, { batch_id: 'b1', parent_id: 'p3', send_status: 'failed' })
    holder.store!.rows('analytics_events').push(
      { newsletter_id: 'n1', user_id: 'p1', event_type: 'email_open', metadata: { source: 'resend' } },
      { newsletter_id: 'n1', user_id: 'p2', event_type: 'email_open', metadata: { qualification: 'automated_or_proxy' } },
      { newsletter_id: 'n1', user_id: 'p1', event_type: 'email_click', metadata: { source: 'resend' } })
    holder.store!.rows('analytics_events').push(
      { newsletter_id: 'n1', user_id: 'p1', event_type: 'email_delivered', metadata: { source: 'resend' } },
      { newsletter_id: 'n1', user_id: 'p2', event_type: 'email_delivered', metadata: { source: 'resend' } },
      { newsletter_id: 'n1', user_id: 'p1', event_type: 'email_delivered', metadata: { source: 'resend' } },
      { newsletter_id: 'other', user_id: 'p3', event_type: 'email_delivered', metadata: { source: 'resend' } },
      { newsletter_id: 'n1', user_id: 'p1', event_type: 'email_open', metadata: { source: 'resend' } },
      { newsletter_id: 'n1', user_id: 'p2', event_type: 'link_click', metadata: {} })
    expect(await analyticsAggregator.getNewsletterMetrics('n1')).toMatchObject({ openRate: 50, clickRate: 50, deliveredRecipients: 2, sentRecipients: 3 })
  })
  it('handles opens arriving before delivery confirmations', async () => {
    holder.store!.rows('analytics_events').push({ newsletter_id: 'n1', user_id: 'p1', event_type: 'email_open', metadata: { source: 'resend' } })
    expect(await analyticsAggregator.getNewsletterMetrics('n1')).toMatchObject({ emailMetricsAvailable: false, openRate: 0 })
    holder.store!.rows('analytics_events').push({ newsletter_id: 'n1', user_id: 'p1', event_type: 'email_delivered', metadata: { source: 'resend' } })
    expect(await analyticsAggregator.getNewsletterMetrics('n1')).toMatchObject({ emailMetricsAvailable: true, openRate: 100 })
  })
  it('does not invent a denominator when no send records exist', async () => {
    holder.store!.rows('analytics_events').push({ newsletter_id: 'n1', user_id: 'p1', event_type: 'email_open', metadata: { source: 'resend' } })
    expect(await analyticsAggregator.getNewsletterMetrics('n1')).toMatchObject({ openRate: 0, clickRate: 0 })
  })
})
