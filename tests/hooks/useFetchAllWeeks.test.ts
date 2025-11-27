/**
 * useFetchAllWeeks Hook Tests
 * Tests for fetching available weeks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFetchAllWeeks } from '@/hooks/useFetchAllWeeks'
import { WeekService } from '@/services/WeekService'

// Mock WeekService
vi.mock('@/services/WeekService', () => ({
  WeekService: {
    getPublishedWeeks: vi.fn(),
    getAllWeeks: vi.fn(),
  },
}))

const mockWeeks = [
  {
    week_number: '2025-W47',
    release_date: '2025-11-27',
    is_published: true,
    created_at: '2025-11-27T00:00:00Z',
    updated_at: '2025-11-27T00:00:00Z',
  },
  {
    week_number: '2025-W46',
    release_date: '2025-11-20',
    is_published: true,
    created_at: '2025-11-20T00:00:00Z',
    updated_at: '2025-11-20T00:00:00Z',
  },
]

describe('useFetchAllWeeks Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch published weeks by default', async () => {
    vi.mocked(WeekService.getPublishedWeeks).mockResolvedValue(mockWeeks)

    const { result } = renderHook(() => useFetchAllWeeks())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.weeks).toEqual(mockWeeks)
    expect(WeekService.getPublishedWeeks).toHaveBeenCalled()
  })

  it('should fetch all weeks when publishedOnly is false', async () => {
    vi.mocked(WeekService.getAllWeeks).mockResolvedValue(mockWeeks)

    const { result } = renderHook(() => useFetchAllWeeks({ publishedOnly: false }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.weeks).toEqual(mockWeeks)
    expect(WeekService.getAllWeeks).toHaveBeenCalled()
  })

  it('should set loading state initially', () => {
    vi.mocked(WeekService.getPublishedWeeks).mockResolvedValue(mockWeeks)

    const { result } = renderHook(() => useFetchAllWeeks())

    expect(result.current.isLoading).toBe(true)
  })

  it('should clear loading state after fetch completes', async () => {
    vi.mocked(WeekService.getPublishedWeeks).mockResolvedValue(mockWeeks)

    const { result } = renderHook(() => useFetchAllWeeks())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('should handle fetch errors', async () => {
    const error = new Error('Fetch failed')
    vi.mocked(WeekService.getPublishedWeeks).mockRejectedValue(error)

    const { result } = renderHook(() => useFetchAllWeeks())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.weeks).toEqual([])
  })

  it('should allow custom limit option', async () => {
    vi.mocked(WeekService.getPublishedWeeks).mockResolvedValue(mockWeeks)

    const { result } = renderHook(() => useFetchAllWeeks({ limit: 10 }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(WeekService.getPublishedWeeks).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    )
  })

  it('should allow custom sort order', async () => {
    vi.mocked(WeekService.getPublishedWeeks).mockResolvedValue(mockWeeks)

    const { result } = renderHook(() => useFetchAllWeeks({ sortOrder: 'asc' }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(WeekService.getPublishedWeeks).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 'asc' }),
    )
  })

  it('should provide refetch function', async () => {
    vi.mocked(WeekService.getPublishedWeeks).mockResolvedValue(mockWeeks)

    const { result } = renderHook(() => useFetchAllWeeks())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(typeof result.current.refetch).toBe('function')
  })

  it('should allow manual refetch', async () => {
    vi.mocked(WeekService.getPublishedWeeks).mockResolvedValue(mockWeeks)

    const { result } = renderHook(() => useFetchAllWeeks())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    vi.mocked(WeekService.getPublishedWeeks).mockClear()

    await result.current.refetch()

    expect(WeekService.getPublishedWeeks).toHaveBeenCalled()
  })

  it('should sort by week number descending by default', async () => {
    vi.mocked(WeekService.getPublishedWeeks).mockResolvedValue(mockWeeks)

    renderHook(() => useFetchAllWeeks())

    await waitFor(() => {
      expect(WeekService.getPublishedWeeks).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'week',
          sortOrder: 'desc',
        }),
      )
    })
  })
})
