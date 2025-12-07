import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyticsAggregator } from '@/services/analyticsAggregator'

// Mock Supabase client
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockGte = vi.fn()
const mockLte = vi.fn()
const mockDelete = vi.fn()

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
  beforeEach(() => {
    vi.clearAllMocks()

    // Default chain for select
    const queryBuilder = {
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      delete: mockDelete,
      insert: mockInsert,
      then: (resolve: any) => resolve({ data: [], error: null })
    }

    mockFrom.mockReturnValue(queryBuilder as any)
    mockSelect.mockReturnValue(queryBuilder)
    mockEq.mockReturnValue(queryBuilder)
    mockGte.mockReturnValue(queryBuilder)
    mockLte.mockReturnValue(queryBuilder)
    mockDelete.mockReturnValue(queryBuilder)
    
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
        newsletter_id: 'W1',
        article_id: 'A1',
        metadata: {}
      },
      {
        event_type: 'page_view',
        newsletter_id: 'W1',
        article_id: 'A1',
        metadata: {}
      },
      {
        event_type: 'link_click',
        newsletter_id: 'W1',
        article_id: 'A1',
        metadata: {}
      },
      {
        event_type: 'session_end',
        newsletter_id: 'W1',
        article_id: 'A1',
        metadata: { time_spent_seconds: 30 }
      },
      {
        event_type: 'session_end',
        newsletter_id: 'W1',
        article_id: 'A1',
        metadata: { time_spent_seconds: 60 }
      },
      // Article 2: 1 view, 0 clicks, 0 sessions
      {
        event_type: 'page_view',
        newsletter_id: 'W1',
        article_id: 'A2',
        metadata: {}
      }
    ]

    // Setup select return value
    // The chain in generateDailySnapshot is: from().select().gte().lte()
    // We need to ensure the final call returns our mock events
    const queryBuilder = {
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      delete: mockDelete,
      insert: mockInsert,
      then: (resolve: any) => resolve({ data: mockEvents, error: null })
    }
    
    // Re-setup mock return to ensure chain works
    mockSelect.mockReturnValue(queryBuilder as any)
    mockGte.mockReturnValue(queryBuilder as any)
    mockLte.mockReturnValue(queryBuilder as any)
    
    // Chain for Delete (from().delete().eq())
    // Note: delete() is called before select()
    // The previous mockDelete setup should handle it if chain is correct, 
    // but code does: from().delete().eq()
    // So delete() must return something with eq()
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
    
    // Expect 5 rows: 
    // A1: total_views=2, total_clicks=1, avg_time_spent=45
    // A2: total_views=1
    // (A2 has no clicks or session_end, so no rows for them)
    // Order depends on map iteration, so checking containment
    
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

  it('should return stats from snapshots when available', async () => {
    const newsletterId = 'W1'

    // Mock Snapshots
    const mockSnapshots = [
        { article_id: 'A1', metric_name: 'total_views', metric_value: 10 },
        { article_id: 'A1', metric_name: 'total_clicks', metric_value: 5 },
        { article_id: 'A1', metric_name: 'avg_time_spent', metric_value: 30 }
    ]

    // Mock Articles Metadata
    const mockArticles = [
        { id: 'A1', title: 'Test Article', created_at: '2025-01-01', article_order: 1 }
    ]

    // Custom Builder for Snapshots
    const snapshotBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
        then: (cb: any) => cb({ data: mockSnapshots, error: null })
    }
    snapshotBuilder.select.mockReturnValue(snapshotBuilder)
    snapshotBuilder.eq.mockReturnValue(snapshotBuilder)
    snapshotBuilder.insert.mockReturnValue({ error: null })
    snapshotBuilder.delete.mockReturnValue(snapshotBuilder)

    // Custom Builder for Articles
    const articleBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
        then: (cb: any) => cb({ data: mockArticles, error: null })
    }
    articleBuilder.select.mockReturnValue(articleBuilder)
    articleBuilder.eq.mockReturnValue(articleBuilder)
    articleBuilder.insert.mockReturnValue({ error: null })
    articleBuilder.delete.mockReturnValue(articleBuilder)

    // Override mockFrom to separate tables
    mockFrom.mockImplementation((table) => {
        if (table === 'analytics_snapshots') return snapshotBuilder as any
        if (table === 'articles') return articleBuilder as any
        // Fallback to default mock chain for others (though shouldn't be called here)
        return { select: mockSelect, insert: mockInsert, delete: mockDelete } as any
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
    const newsletterId = 'W2'

    // Custom Builder for Snapshots (Empty)
    const emptySnapshotBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
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
        then: (cb: any) => cb({ data: [], error: null })
    }
    rawEventsBuilder.select.mockReturnValue(rawEventsBuilder)
    rawEventsBuilder.eq.mockReturnValue(rawEventsBuilder)
    rawEventsBuilder.not.mockReturnValue(rawEventsBuilder)
    rawEventsBuilder.insert.mockReturnValue({ error: null })
    rawEventsBuilder.delete.mockReturnValue(rawEventsBuilder)

    // Override mockFrom
    mockFrom.mockImplementation((table) => {
        if (table === 'analytics_snapshots') return emptySnapshotBuilder as any
        if (table === 'analytics_events') return rawEventsBuilder as any
        return rawEventsBuilder as any
    })
    
    await analyticsAggregator.getArticleStatsWithFallback(newsletterId)
    
    expect(mockFrom).toHaveBeenCalledWith('analytics_snapshots')
    expect(mockFrom).toHaveBeenCalledWith('analytics_events')
  })
})
