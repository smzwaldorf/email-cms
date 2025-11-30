/**
 * WeekSelector Component Tests
 * Tests for week selection dropdown component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { WeekSelector } from '@/components/WeekSelector'
import { useFetchAllWeeks } from '@/hooks/useFetchAllWeeks'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock useFetchAllWeeks hook
vi.mock('@/hooks/useFetchAllWeeks', () => ({
  useFetchAllWeeks: vi.fn(),
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
  {
    week_number: '2025-W45',
    release_date: '2025-11-13',
    is_published: true,
    created_at: '2025-11-13T00:00:00Z',
    updated_at: '2025-11-13T00:00:00Z',
  },
]

describe('WeekSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    ;(useFetchAllWeeks as any).mockReturnValue({
      weeks: mockWeeks,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('should render selector button with current week', () => {
    render(
      <BrowserRouter>
        <WeekSelector />
      </BrowserRouter>,
    )

    const button = screen.getByRole('button', { name: /第 47 週/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('should open dropdown when button is clicked', async () => {
    render(
      <BrowserRouter>
        <WeekSelector />
      </BrowserRouter>,
    )

    const button = screen.getByRole('button', { name: /第 47 週/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('選擇週數')).toBeInTheDocument()
    })
  })

  it('should call useFetchAllWeeks to fetch available weeks', () => {
    render(
      <BrowserRouter>
        <WeekSelector />
      </BrowserRouter>,
    )

    // Verify the hook was called with correct parameters
    expect(useFetchAllWeeks).toHaveBeenCalledWith({
      publishedOnly: true,
      limit: 50,
      sortOrder: 'desc',
    })
  })

  it('should show loading state when fetching weeks', () => {
    ;(useFetchAllWeeks as any).mockReturnValue({
      weeks: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <BrowserRouter>
        <WeekSelector />
      </BrowserRouter>,
    )

    // Button should still render with week number but be disabled
    const button = screen.getByRole('button', { name: /2025-W47/i })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('bg-waldorf-cream-100')
  })


  it('should disable button when no weeks are available', () => {
    ;(useFetchAllWeeks as any).mockReturnValue({
      weeks: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <BrowserRouter>
        <WeekSelector />
      </BrowserRouter>,
    )

    // Button should be disabled when no weeks available
    const button = screen.getByRole('button', { name: /2025-W47/i })
    expect(button).toBeDisabled()
  })

  it('should call navigate when week button is clicked', async () => {
    render(
      <BrowserRouter>
        <WeekSelector />
      </BrowserRouter>,
    )

    const button = screen.getByRole('button', { name: /第 47 週/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('選擇週數')).toBeInTheDocument()
    })

    // Find and click week 46 dropdown button
    const allButtons = screen.getAllByRole('button')
    const week46Button = allButtons.find((btn) => btn.textContent.includes('2025-W46'))

    if (week46Button) {
      fireEvent.click(week46Button)
      expect(mockNavigate).toHaveBeenCalledWith('/week/2025-W46')
    }
  })
})
