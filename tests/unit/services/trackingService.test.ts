import { describe, it, expect, vi, beforeEach } from 'vitest'
import { trackingService } from '@/services/trackingService'
import { getSupabaseClient } from '@/lib/supabase'

// Mock Supabase client
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockOrder = vi.fn() // Add mockOrder if used, though getReadArticles uses select-eq-in
const mockLimit = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'analytics_events') {
    return {
      insert: mockInsert,
      select: mockSelect,
    }
  }
  return {
    select: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: mockFrom
  }))
}))

describe('trackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default chain for insert
    mockInsert.mockResolvedValue({ error: null })
    
    // Setup default chain for getReadArticles
    // .select('article_id').eq('event_type', 'page_view').eq('user_id', userId).eq('week_number', weekNumber)
    mockSelect.mockReturnThis()
    
    // We need to handle method chaining for the query builder
    // This is a simplified mock chain
    const queryBuilder = {
      select: mockSelect,
      eq: mockEq,
      in: mockIn,
      not: mockEq, // Mock not same as eq for chaining
      order: mockOrder,
      limit: mockLimit,
      then: (resolve: any) => resolve({ data: [], error: null }) // Default promise resolution
    }
    
    mockSelect.mockReturnValue(queryBuilder)
    mockEq.mockReturnValue(queryBuilder)
    mockIn.mockReturnValue(queryBuilder)
    mockInsert.mockReturnValue({ error: null })
  })

  it('should log an event successfully', async () => {
    const event = {
      event_type: 'page_view' as const,
      article_id: 'article-123',
      week_number: '2025-W01',
      session_id: 'session-123',
      metadata: { path: '/test' }
    }

    await trackingService.logEvent(event)

    expect(mockFrom).toHaveBeenCalledWith('analytics_events')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'page_view',
      article_id: 'article-123',
      week_number: '2025-W01',
      session_id: 'session-123',
      metadata: { path: '/test' }
    }))
  })

  it('should fetch read articles', async () => {
    const userId = 'user-123'
    const weekNumber = '2025-W01'
    
    // Mock response data
    const mockData = [
      { article_id: 'art-1' },
      { article_id: 'art-2' },
      { article_id: 'art-1' } // Duplicate to test Set/uniqueness if handled in service
    ]
    
    // Setup mock resolution for the query chain
    mockEq.mockImplementationOnce(() => ({ // eq event_type
        eq: () => ({ // eq user_id
            eq: () => Promise.resolve({ data: mockData, error: null }) // eq week_number -> resolve
        })
    }))

    // Actually, getReadArticles implementation:
    // .select('article_id')
    // .eq('event_type', 'page_view')
    // .eq('user_id', userId)
    // .eq('week_number', weekNumber) (if provided)
    
    // Re-setup mock for chaining properly without nesting hell if possible, or just spy on calls
    // The service implementation:
    // let query = supabase.from('analytics_events').select('article_id').eq('event_type', 'page_view').eq('user_id', userId);
    // if (weekNumber) query = query.eq('week_number', weekNumber);
    // const { data } = await query;
    
    // Let's refine the mock to handle this dynamic chaining
    const chain = {
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      then: (cb: any) => cb({ data: mockData, error: null })
    }
    mockSelect.mockReturnValue(chain)

    const result = await trackingService.getReadArticles(userId, weekNumber)

    expect(mockSelect).toHaveBeenCalledWith('article_id')
    expect(chain.eq).toHaveBeenCalledWith('event_type', 'page_view')
    expect(chain.eq).toHaveBeenCalledWith('user_id', userId)
    expect(chain.eq).toHaveBeenCalledWith('week_number', weekNumber)
    
    expect(result).toEqual(['art-1', 'art-2']) // Expect unique IDs
  })
})
