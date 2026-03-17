import { describe, it, expect, vi, beforeEach } from 'vitest'
import { trackingService } from '@/services/trackingService'
import { getSupabaseClient } from '@/lib/supabase'

// Mock Supabase client
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockNot = vi.fn()

// Mock for newsletter lookup (used by getReadArticles)
const mockNewsletterSelect = vi.fn()
const mockNewsletterEq = vi.fn()
const mockNewsletterSingle = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'analytics_events') {
    return {
      insert: mockInsert,
      select: mockSelect,
    }
  }
  if (table === 'newsletters') {
    return {
      select: mockNewsletterSelect,
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
  const mockNewsletterId = '11111111-1111-1111-1111-111111111111'

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default chain for insert
    mockInsert.mockResolvedValue({ error: null })
    
    // Setup newsletter lookup mock (used by getReadArticles)
    const newsletterChain = {
      eq: mockNewsletterEq.mockReturnValue({
        single: mockNewsletterSingle.mockResolvedValue({ 
          data: { id: mockNewsletterId }, 
          error: null 
        })
      })
    }
    mockNewsletterSelect.mockReturnValue(newsletterChain)
  })

  it('should log an event successfully with UUID newsletter_id', async () => {
    const event = {
      event_type: 'page_view' as const,
      article_id: 'article-123',
      newsletter_id: mockNewsletterId, // UUID format expected
      user_id: 'user-123',
      session_id: 'session-123',
      metadata: { path: '/test' }
    }

    await trackingService.logEvent(event)

    expect(mockFrom).toHaveBeenCalledWith('analytics_events')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'page_view',
      article_id: 'article-123',
      newsletter_id: mockNewsletterId,
      user_id: 'user-123',
      session_id: 'session-123',
      metadata: { path: '/test' }
    }))
  })

  it('should log event directly without resolving newsletter_id (expects UUID)', async () => {
    // newsletter_id is now always expected to be a UUID, no resolution needed
    const event = {
      event_type: 'page_view' as const,
      article_id: 'article-123',
      newsletter_id: mockNewsletterId,
      user_id: 'user-123',
      session_id: 'session-123',
      metadata: { path: '/test' }
    }

    await trackingService.logEvent(event)

    // Should NOT lookup newsletters table for logEvent - just insert directly
    // Note: newsletters lookup happens for getReadArticles, not logEvent
    expect(mockFrom).toHaveBeenCalledWith('analytics_events')
    expect(mockInsert).toHaveBeenCalledWith(event)
  })

  it('should fetch read articles with weekNumber resolution', async () => {
    const userId = 'user-123'
    const weekNumber = '2025-W01'
    
    // Mock response data
    const mockData = [
      { article_id: 'art-1' },
      { article_id: 'art-2' },
      { article_id: 'art-1' } // Duplicate to test Set/uniqueness
    ]
    
    // Setup mock for getReadArticles query chain
    const queryChain = {
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockImplementation(() => queryChain),
      then: (cb: any) => cb({ data: mockData, error: null })
    }
    mockSelect.mockReturnValue(queryChain)

    const result = await trackingService.getReadArticles(userId, weekNumber)

    // Should have looked up the newsletter first (getReadArticles still does this)
    expect(mockFrom).toHaveBeenCalledWith('newsletters')
    expect(mockNewsletterSelect).toHaveBeenCalledWith('id')
    expect(mockNewsletterEq).toHaveBeenCalledWith('week_number', weekNumber)

    // Should query analytics_events
    expect(mockFrom).toHaveBeenCalledWith('analytics_events')
    expect(mockSelect).toHaveBeenCalledWith('article_id')
    expect(queryChain.eq).toHaveBeenCalledWith('user_id', userId)
    expect(queryChain.eq).toHaveBeenCalledWith('event_type', 'page_view')
    expect(queryChain.eq).toHaveBeenCalledWith('newsletter_id', mockNewsletterId)
    
    expect(result).toEqual(['art-1', 'art-2']) // Expect unique IDs
  })
})

