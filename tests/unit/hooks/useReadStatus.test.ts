import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useReadStatus } from '@/hooks/useReadStatus'
import { trackingService } from '@/services/trackingService'
import { useAuth } from '@/context/AuthContext'

// Mock dependencies
vi.mock('@/services/trackingService', () => ({
  trackingService: {
    getReadArticles: vi.fn()
  }
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn()
}))

describe('useReadStatus', () => {
    const mockWeekNumber = '2025-W01'
    const mockUserId = 'user-123'

    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as any).mockReturnValue({ user: { id: mockUserId } })
    })

    it('should fetch initial read status on mount', async () => {
        (trackingService.getReadArticles as any).mockResolvedValue(['art-1', 'art-2'])

        const { result } = renderHook(() => useReadStatus(mockWeekNumber))

        // Initial state
        expect(result.current.isLoading).toBe(true)
        
        // Wait for effect
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(trackingService.getReadArticles).toHaveBeenCalledWith(mockUserId, mockWeekNumber)
        expect(result.current.readArticleIds.has('art-1')).toBe(true)
        expect(result.current.readArticleIds.has('art-2')).toBe(true)
        expect(result.current.readArticleIds.has('art-3')).toBe(false)
    })

    it('should allow optimistic marking as read', async () => {
        (trackingService.getReadArticles as any).mockResolvedValue([])

        const { result } = renderHook(() => useReadStatus(mockWeekNumber))

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.readArticleIds.size).toBe(0)

        // Mark as read
        await act(async () => {
          result.current.markAsRead('art-new')
        })

        expect(result.current.readArticleIds.has('art-new')).toBe(true)
    })

    it('should handle anonymous user (no fetch)', () => {
        (useAuth as any).mockReturnValue({ user: null })

        const { result } = renderHook(() => useReadStatus(mockWeekNumber))

        expect(trackingService.getReadArticles).not.toHaveBeenCalled()
        expect(result.current.readArticleIds.size).toBe(0)
        expect(result.current.isLoading).toBe(false)
    })
})
