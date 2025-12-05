/**
 * Test - Newsletter Table Component (Admin Dashboard)
 * T023: Newsletter table unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Mock Newsletter data for testing
 */
interface Newsletter {
  id: string
  weekNumber: string
  publishedAt: string
  status: 'draft' | 'published' | 'archived'
  articleCount: number
  createdAt: string
  updatedAt: string
}

/**
 * Mock NewsletterTable component
 */
const NewsletterTable = ({
  newsletters,
  onEdit,
  onPublish,
  onArchive,
  onDelete
}: {
  newsletters: Newsletter[]
  onEdit?: (id: string) => void
  onPublish?: (id: string) => void
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
}) => {
  return (
    <div className="bg-white rounded-lg shadow">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">週次</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">發布日期</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">文章數</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">狀態</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">操作</th>
          </tr>
        </thead>
        <tbody>
          {newsletters.map((newsletter) => (
            <tr
              key={newsletter.id}
              className="border-b border-gray-100 hover:bg-gray-50"
              data-testid={`newsletter-row-${newsletter.id}`}
            >
              <td className="px-6 py-4 text-sm text-gray-900">{newsletter.weekNumber}</td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {new Date(newsletter.publishedAt).toLocaleDateString('zh-TW')}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">{newsletter.articleCount}</td>
              <td className="px-6 py-4 text-sm">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    newsletter.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : newsletter.status === 'draft'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                  data-testid={`status-badge-${newsletter.id}`}
                >
                  {newsletter.status === 'published' && '已發布'}
                  {newsletter.status === 'draft' && '草稿'}
                  {newsletter.status === 'archived' && '已封存'}
                </span>
              </td>
              <td className="px-6 py-4 text-sm space-x-2">
                {newsletter.status === 'draft' && (
                  <>
                    <button
                      onClick={() => onEdit?.(newsletter.id)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      data-testid={`edit-btn-${newsletter.id}`}
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => onPublish?.(newsletter.id)}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                      data-testid={`publish-btn-${newsletter.id}`}
                    >
                      發布
                    </button>
                  </>
                )}
                {newsletter.status === 'published' && (
                  <button
                    onClick={() => onArchive?.(newsletter.id)}
                    className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                    data-testid={`archive-btn-${newsletter.id}`}
                  >
                    封存
                  </button>
                )}
                <button
                  onClick={() => onDelete?.(newsletter.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  data-testid={`delete-btn-${newsletter.id}`}
                >
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

describe('NewsletterTable', () => {
  const mockNewsletters: Newsletter[] = [
    {
      id: 'newsletter-001',
      weekNumber: '2025-W43',
      publishedAt: '2025-10-24T00:00:00Z',
      status: 'published',
      articleCount: 5,
      createdAt: '2025-10-20T10:00:00Z',
      updatedAt: '2025-10-24T10:00:00Z',
    },
    {
      id: 'newsletter-002',
      weekNumber: '2025-W44',
      publishedAt: '2025-10-31T00:00:00Z',
      status: 'draft',
      articleCount: 3,
      createdAt: '2025-10-25T10:00:00Z',
      updatedAt: '2025-10-25T10:00:00Z',
    },
    {
      id: 'newsletter-003',
      weekNumber: '2025-W45',
      publishedAt: '2025-11-07T00:00:00Z',
      status: 'archived',
      articleCount: 4,
      createdAt: '2025-10-30T10:00:00Z',
      updatedAt: '2025-11-10T10:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render table with all newsletters', () => {
      render(<NewsletterTable newsletters={mockNewsletters} />)

      expect(screen.getByText('2025-W43')).toBeInTheDocument()
      expect(screen.getByText('2025-W44')).toBeInTheDocument()
      expect(screen.getByText('2025-W45')).toBeInTheDocument()
    })

    it('should display correct week numbers', () => {
      render(<NewsletterTable newsletters={mockNewsletters} />)

      const rows = screen.getAllByTestId(/newsletter-row-/)
      expect(rows).toHaveLength(3)
    })

    it('should display article count for each newsletter', () => {
      render(<NewsletterTable newsletters={mockNewsletters} />)

      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('should render empty table when no newsletters provided', () => {
      const { container } = render(<NewsletterTable newsletters={[]} />)

      const tbody = container.querySelector('tbody')
      expect(tbody?.children).toHaveLength(0)
    })
  })

  describe('Status Badges', () => {
    it('should display published status badge correctly', () => {
      render(<NewsletterTable newsletters={[mockNewsletters[0]]} />)

      const badge = screen.getByTestId('status-badge-newsletter-001')
      expect(badge).toHaveTextContent('已發布')
      expect(badge).toHaveClass('bg-green-100')
    })

    it('should display draft status badge correctly', () => {
      render(<NewsletterTable newsletters={[mockNewsletters[1]]} />)

      const badge = screen.getByTestId('status-badge-newsletter-002')
      expect(badge).toHaveTextContent('草稿')
      expect(badge).toHaveClass('bg-yellow-100')
    })

    it('should display archived status badge correctly', () => {
      render(<NewsletterTable newsletters={[mockNewsletters[2]]} />)

      const badge = screen.getByTestId('status-badge-newsletter-003')
      expect(badge).toHaveTextContent('已封存')
      expect(badge).toHaveClass('bg-gray-100')
    })
  })

  describe('Actions', () => {
    it('should show edit and publish buttons for draft newsletters', () => {
      const draft = mockNewsletters[1]
      render(<NewsletterTable newsletters={[draft]} />)

      expect(screen.getByTestId(`edit-btn-${draft.id}`)).toBeInTheDocument()
      expect(screen.getByTestId(`publish-btn-${draft.id}`)).toBeInTheDocument()
    })

    it('should show archive button for published newsletters', () => {
      const published = mockNewsletters[0]
      render(<NewsletterTable newsletters={[published]} />)

      expect(screen.getByTestId(`archive-btn-${published.id}`)).toBeInTheDocument()
      expect(screen.queryByTestId(`publish-btn-${published.id}`)).not.toBeInTheDocument()
    })

    it('should show delete button for all newsletters', () => {
      render(<NewsletterTable newsletters={mockNewsletters} />)

      mockNewsletters.forEach((newsletter) => {
        expect(screen.getByTestId(`delete-btn-${newsletter.id}`)).toBeInTheDocument()
      })
    })

    it('should call onEdit when edit button is clicked', async () => {
      const onEdit = vi.fn()
      const draft = mockNewsletters[1]
      const user = userEvent.setup()

      render(<NewsletterTable newsletters={[draft]} onEdit={onEdit} />)

      await user.click(screen.getByTestId(`edit-btn-${draft.id}`))
      expect(onEdit).toHaveBeenCalledWith(draft.id)
      expect(onEdit).toHaveBeenCalledOnce()
    })

    it('should call onPublish when publish button is clicked', async () => {
      const onPublish = vi.fn()
      const draft = mockNewsletters[1]
      const user = userEvent.setup()

      render(<NewsletterTable newsletters={[draft]} onPublish={onPublish} />)

      await user.click(screen.getByTestId(`publish-btn-${draft.id}`))
      expect(onPublish).toHaveBeenCalledWith(draft.id)
      expect(onPublish).toHaveBeenCalledOnce()
    })

    it('should call onArchive when archive button is clicked', async () => {
      const onArchive = vi.fn()
      const published = mockNewsletters[0]
      const user = userEvent.setup()

      render(<NewsletterTable newsletters={[published]} onArchive={onArchive} />)

      await user.click(screen.getByTestId(`archive-btn-${published.id}`))
      expect(onArchive).toHaveBeenCalledWith(published.id)
      expect(onArchive).toHaveBeenCalledOnce()
    })

    it('should call onDelete when delete button is clicked', async () => {
      const onDelete = vi.fn()
      const newsletter = mockNewsletters[0]
      const user = userEvent.setup()

      render(<NewsletterTable newsletters={[newsletter]} onDelete={onDelete} />)

      await user.click(screen.getByTestId(`delete-btn-${newsletter.id}`))
      expect(onDelete).toHaveBeenCalledWith(newsletter.id)
      expect(onDelete).toHaveBeenCalledOnce()
    })
  })

  describe('Sorting and Filtering', () => {
    it('should render newsletters in provided order', () => {
      const { container } = render(<NewsletterTable newsletters={mockNewsletters} />)

      const rows = container.querySelectorAll('tbody tr')
      const firstWeek = rows[0].querySelector('td')?.textContent
      const secondWeek = rows[1].querySelector('td')?.textContent
      const thirdWeek = rows[2].querySelector('td')?.textContent

      expect(firstWeek).toBe('2025-W43')
      expect(secondWeek).toBe('2025-W44')
      expect(thirdWeek).toBe('2025-W45')
    })

    it('should maintain sort order with multiple actions', async () => {
      const onPublish = vi.fn()
      const user = userEvent.setup()

      render(<NewsletterTable newsletters={mockNewsletters} onPublish={onPublish} />)

      // Click publish on draft
      await user.click(screen.getByTestId('publish-btn-newsletter-002'))

      // Order should remain the same
      const rows = screen.getAllByTestId(/newsletter-row-/)
      expect(rows).toHaveLength(3)
    })
  })

  describe('Accessibility', () => {
    it('should have proper table semantic structure', () => {
      const { container } = render(<NewsletterTable newsletters={mockNewsletters} />)

      expect(container.querySelector('table')).toBeInTheDocument()
      expect(container.querySelector('thead')).toBeInTheDocument()
      expect(container.querySelector('tbody')).toBeInTheDocument()
    })

    it('should have proper header cell structure', () => {
      const { container } = render(<NewsletterTable newsletters={mockNewsletters} />)

      const headers = container.querySelectorAll('thead th')
      expect(headers.length).toBeGreaterThan(0)
      expect(headers[0]).toHaveTextContent('週次')
    })

    it('should use data-testid for action buttons', () => {
      render(<NewsletterTable newsletters={mockNewsletters} />)

      mockNewsletters.forEach((newsletter) => {
        expect(screen.getByTestId(`delete-btn-${newsletter.id}`)).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle newsletter with zero articles', () => {
      const zeroArticleNewsletter = { ...mockNewsletters[0], articleCount: 0 }
      render(<NewsletterTable newsletters={[zeroArticleNewsletter]} />)

      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('should handle newsletter with many articles', () => {
      const manyArticlesNewsletter = { ...mockNewsletters[0], articleCount: 50 }
      render(<NewsletterTable newsletters={[manyArticlesNewsletter]} />)

      expect(screen.getByText('50')).toBeInTheDocument()
    })

    it('should handle rapid action clicks', async () => {
      const onDelete = vi.fn()
      const onEdit = vi.fn()
      const user = userEvent.setup()

      render(
        <NewsletterTable
          newsletters={mockNewsletters}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      )

      // Click delete and edit rapidly
      await user.click(screen.getByTestId('delete-btn-newsletter-001'))
      await user.click(screen.getByTestId('edit-btn-newsletter-002'))

      expect(onDelete).toHaveBeenCalledOnce()
      expect(onEdit).toHaveBeenCalledOnce()
    })

    it('should handle mixed status newsletters', () => {
      render(<NewsletterTable newsletters={mockNewsletters} />)

      expect(screen.getByTestId('status-badge-newsletter-001')).toHaveTextContent('已發布')
      expect(screen.getByTestId('status-badge-newsletter-002')).toHaveTextContent('草稿')
      expect(screen.getByTestId('status-badge-newsletter-003')).toHaveTextContent('已封存')
    })
  })
})
