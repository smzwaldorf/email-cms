import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyticsAggregator } from '@/services/analyticsAggregator'

// Mock Supabase client
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockGte = vi.fn()
const mockLte = vi.fn()
const mockDelete = vi.fn()
const mockSingle = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockIn = vi.fn()

const mockFrom = vi.fn((table: string) => {
  return {
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete
  }
})

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: mockFrom
  }))
}))

describe('analyticsAggregator', () => {
  const mockNewsletterId = '11111111-1111-1111-1111-111111111111'

  beforeEach(() => {
    vi.clearAllMocks()

    // Default chain for select with single() support for newsletter lookup
    const queryBuilder = {
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      delete: mockDelete,
      insert: mockInsert,
      single: mockSingle,
      order: mockOrder,
      limit: mockLimit,
      in: mockIn,
      then: (resolve: any) => resolve({ data: [], error: null })
    }

    mockFrom.mockReturnValue(queryBuilder as any)
    mockSelect.mockReturnValue(queryBuilder)
    mockEq.mockReturnValue(queryBuilder)
    mockGte.mockReturnValue(queryBuilder)
    mockLte.mockReturnValue(queryBuilder)
    mockDelete.mockReturnValue(queryBuilder)
    mockOrder.mockReturnValue(queryBuilder)
    mockLimit.mockReturnValue(queryBuilder)
    mockIn.mockReturnValue(queryBuilder)
    
    // Mock single() for newsletter lookup (resolveNewsletterId)
    mockSingle.mockResolvedValue({ data: { id: mockNewsletterId }, error: null })
    
    // Default success for delete
    mockDelete.mockResolvedValue({ error: null })
    // Default success for insert
    mockInsert.mockResolvedValue({ error: null })
  })

  it('should aggregate views, clicks, and stay time correctly', async () => {
    const targetDate = '2025-01-01'
    
    // Mock Raw Events
    const mockEvents = [
      // Article 1: 2 views, 1 click, 2 sessions (30s, 60s) -> Avg 45s
      {
        event_type: 'page_view',
        newsletter_id: mockNewsletterId,
        article_id: 'A1',
        metadata: {}
      },
      {
        event_type: 'page_view',
        newsletter_id: mockNewsletterId,
        article_id: 'A1',
        metadata: {}
      },
      {
        event_type: 'link_click',
        newsletter_id: mockNewsletterId,
        article_id: 'A1',
        metadata: {}
      },
      {
        event_type: 'session_end',
        newsletter_id: mockNewsletterId,
        article_id: 'A1',
        metadata: { time_spent_seconds: 30 }
      },
      {
        event_type: 'session_end',
        newsletter_id: mockNewsletterId,
        article_id: 'A1',
        metadata: { time_spent_seconds: 60 }
      },
      // Article 2: 1 view, 0 clicks, 0 sessions
      {
        event_type: 'page_view',
        newsletter_id: mockNewsletterId,
        article_id: 'A2',
        metadata: {}
      }
    ]

    // Setup select return value
    const queryBuilder = {
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      delete: mockDelete,
      insert: mockInsert,
      single: mockSingle,
      then: (resolve: any) => resolve({ data: mockEvents, error: null })
    }
    
    mockSelect.mockReturnValue(queryBuilder as any)
    mockGte.mockReturnValue(queryBuilder as any)
    mockLte.mockReturnValue(queryBuilder as any)
    
    // Chain for Delete
    const deleteChain = {
      eq: mockEq,
      then: (resolve: any) => resolve({ error: null })
    }
    mockDelete.mockReturnValue(deleteChain as any)

    await analyticsAggregator.generateDailySnapshot(targetDate)

    // Verify Delete called to clear old snapshots
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('snapshot_date', targetDate)

    // Verify Select called for events
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockGte).toHaveBeenCalled()

    // Verify Insert called with aggregated data
    expect(mockInsert).toHaveBeenCalledTimes(1)
    
    const insertedRows = mockInsert.mock.calls[0][0]
    
    expect(insertedRows).toHaveLength(4)
    
    // A1 Views
    expect(insertedRows).toContainEqual(expect.objectContaining({
      article_id: 'A1',
      metric_name: 'total_views',
      metric_value: 2
    }))
    
    // A1 Clicks
    expect(insertedRows).toContainEqual(expect.objectContaining({
      article_id: 'A1',
      metric_name: 'total_clicks',
      metric_value: 1
    }))
    
    // A1 Time (Avg 45)
    expect(insertedRows).toContainEqual(expect.objectContaining({
      article_id: 'A1',
      metric_name: 'avg_time_spent',
      metric_value: 45
    }))
    
    // A2 Views
    expect(insertedRows).toContainEqual(expect.objectContaining({
      article_id: 'A2',
      metric_name: 'total_views',
      metric_value: 1
    }))
  })

  it('should derive avgTimeSpent from session_end payloads in newsletter metrics', async () => {
    let eventType = ''

    const eventsBuilder = {
      select: vi.fn(),
      eq: vi.fn((field: string, value: string) => {
        if (field === 'event_type') {
          eventType = value
        }
        return eventsBuilder
      }),
      in: vi.fn(() => eventsBuilder),
      then: (resolve: any) => {
        if (eventType === 'email_open') {
          return resolve({ data: [{ user_id: 'u1' }, { user_id: 'u2' }], error: null })
        }
        if (eventType === 'link_click') {
          return resolve({ data: [{ user_id: 'u1' }], error: null })
        }
        if (eventType === 'page_view') {
          return resolve({ data: [{ metadata: {} }, { metadata: {} }], error: null })
        }
        if (eventType === 'session_end') {
          return resolve({
            data: [
              { metadata: { time_spent_seconds: 30 } },
              { metadata: { time_spent_seconds: 90 } },
            ],
            error: null,
          })
        }
        return resolve({ data: [], error: null })
      },
    }
    eventsBuilder.select.mockReturnValue(eventsBuilder)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'analytics_events') {
        return eventsBuilder as any
      }
      return {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn(),
        then: (resolve: any) => resolve({ data: [], error: null }),
      } as any
    })

    const metrics = await analyticsAggregator.getNewsletterMetrics(mockNewsletterId)

    expect(metrics.totalViews).toBe(2)
    expect(metrics.avgTimeSpent).toBe(60)
    expect(metrics.openRate).toBe(2)
    expect(metrics.clickRate).toBe(50)
  })

  it('should return stats from snapshots when available', async () => {
    // Use UUID format for newsletter ID
    const newsletterId = mockNewsletterId

    // Mock Snapshots
    const mockSnapshots = [
        { article_id: 'A1', metric_name: 'total_views', metric_value: 10 },
        { article_id: 'A1', metric_name: 'total_clicks', metric_value: 5 },
        { article_id: 'A1', metric_name: 'avg_time_spent', metric_value: 30 }
    ]

    // Mock newsletter_articles junction for article lookup
    const mockJunctionData = [
        { article_order: 1, articles: { id: 'A1', title: 'Test Article', created_at: '2025-01-01' } }
    ]

    // Custom Builder for Snapshots
    const snapshotBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
        single: vi.fn().mockResolvedValue({ data: { id: newsletterId }, error: null }),
        then: (cb: any) => cb({ data: mockSnapshots, error: null })
    }
    snapshotBuilder.select.mockReturnValue(snapshotBuilder)
    snapshotBuilder.eq.mockReturnValue(snapshotBuilder)
    snapshotBuilder.insert.mockReturnValue({ error: null })
    snapshotBuilder.delete.mockReturnValue(snapshotBuilder)

    // Custom Builder for newsletter_articles junction
    const junctionBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn(),
        single: vi.fn().mockResolvedValue({ data: { id: newsletterId }, error: null }),
        then: (cb: any) => cb({ data: mockJunctionData, error: null })
    }
    junctionBuilder.select.mockReturnValue(junctionBuilder)
    junctionBuilder.eq.mockReturnValue(junctionBuilder)
    junctionBuilder.order.mockReturnValue(junctionBuilder)

    // Custom Builder for newsletters (for resolveNewsletterId)
    const newsletterBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn().mockResolvedValue({ data: { id: newsletterId }, error: null }),
        then: (cb: any) => cb({ data: { id: newsletterId }, error: null })
    }
    newsletterBuilder.select.mockReturnValue(newsletterBuilder)
    newsletterBuilder.eq.mockReturnValue(newsletterBuilder)

    // Override mockFrom to separate tables
    mockFrom.mockImplementation((table) => {
        if (table === 'analytics_snapshots') return snapshotBuilder as any
        if (table === 'newsletter_articles') return junctionBuilder as any
        if (table === 'newsletters') return newsletterBuilder as any
        return snapshotBuilder as any
    })

    const result = await analyticsAggregator.getArticleStatsWithFallback(newsletterId)

    // Should return aggregated stats
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(expect.objectContaining({
        id: 'A1',
        views: 10,
        clicks: 5,
        avgTimeSpent: 30
    }))
    
    // Check calls
    expect(mockFrom).toHaveBeenCalledWith('analytics_snapshots')
    expect(mockFrom).not.toHaveBeenCalledWith('analytics_events')
  })

  it('should fallback to raw events when snapshots are empty', async () => {
    // Use UUID format for newsletter ID
    const newsletterId = mockNewsletterId

    // Custom Builder for newsletters (for resolveNewsletterId)
    const newsletterBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn().mockResolvedValue({ data: { id: newsletterId }, error: null }),
        then: (cb: any) => cb({ data: { id: newsletterId }, error: null })
    }
    newsletterBuilder.select.mockReturnValue(newsletterBuilder)
    newsletterBuilder.eq.mockReturnValue(newsletterBuilder)

    // Custom Builder for Snapshots (Empty)
    const emptySnapshotBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
        single: vi.fn().mockResolvedValue({ data: { id: newsletterId }, error: null }),
        then: (cb: any) => cb({ data: [], error: null })
    }
    emptySnapshotBuilder.select.mockReturnValue(emptySnapshotBuilder)
    emptySnapshotBuilder.eq.mockReturnValue(emptySnapshotBuilder)
    emptySnapshotBuilder.insert.mockReturnValue({ error: null })
    emptySnapshotBuilder.delete.mockReturnValue(emptySnapshotBuilder)

    // Default builder for raw events
    const rawEventsBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        not: vi.fn(), 
        insert: vi.fn(),
        delete: vi.fn(),
        single: vi.fn().mockResolvedValue({ data: { id: newsletterId }, error: null }),
        then: (cb: any) => cb({ data: [], error: null })
    }
    rawEventsBuilder.select.mockReturnValue(rawEventsBuilder)
    rawEventsBuilder.eq.mockReturnValue(rawEventsBuilder)
    rawEventsBuilder.not.mockReturnValue(rawEventsBuilder)
    rawEventsBuilder.insert.mockReturnValue({ error: null })
    rawEventsBuilder.delete.mockReturnValue(rawEventsBuilder)

    // Override mockFrom
    mockFrom.mockImplementation((table) => {
        if (table === 'newsletters') return newsletterBuilder as any
        if (table === 'analytics_snapshots') return emptySnapshotBuilder as any
        if (table === 'analytics_events') return rawEventsBuilder as any
        return rawEventsBuilder as any
    })
    
    await analyticsAggregator.getArticleStatsWithFallback(newsletterId)
    
    expect(mockFrom).toHaveBeenCalledWith('analytics_snapshots')
    expect(mockFrom).toHaveBeenCalledWith('analytics_events')
  })
})
