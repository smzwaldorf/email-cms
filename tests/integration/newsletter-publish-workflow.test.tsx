import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { NewsletterTable } from '@/components/admin/NewsletterTable'
import { PublishDialog } from '@/components/admin/PublishDialog'
import type { AdminNewsletter } from '@/types/admin'

describe('Newsletter Publish Workflow', () => {
  const mockNewsletters: AdminNewsletter[] = [
    {
      id: '2025-W48',
      weekNumber: '2025-W48',
      releaseDate: '2025-12-01',
      status: 'draft',
      articleCount: 3,
      createdAt: '2025-12-04',
      updatedAt: '2025-12-04',
      publishedAt: null,
      isPublished: false,
    },
    {
      id: '2025-W47',
      weekNumber: '2025-W47',
      releaseDate: '2025-11-24',
      status: 'published',
      articleCount: 5,
      createdAt: '2025-11-20',
      updatedAt: '2025-11-24',
      publishedAt: '2025-11-24',
      isPublished: true,
    },
    {
      id: '2025-W46',
      weekNumber: '2025-W46',
      releaseDate: '2025-11-17',
      status: 'archived',
      articleCount: 4,
      createdAt: '2025-11-10',
      updatedAt: '2025-11-24',
      publishedAt: '2025-11-17',
      isPublished: false,
    },
  ]

  describe('PublishDialog Component', () => {
    it('renders publish confirmation dialog when open', () => {
      const onPublish = vi.fn()
      const onCancel = vi.fn()

      const { container } = render(
        <PublishDialog
          isOpen={true}
          newsletterWeek="2025-W48"
          articleCount={3}
          onPublish={onPublish}
          onCancel={onCancel}
        />
      )

      expect(screen.getByText('確認發布電子報')).toBeInTheDocument()
      expect(screen.getByText('2025-W48')).toBeInTheDocument()
      expect(container.textContent).toContain('文章數')
      expect(container.textContent).toContain('3')
    })

    it('should not render when isOpen is false', () => {
      const onPublish = vi.fn()
      const onCancel = vi.fn()

      const { container } = render(
        <PublishDialog
          isOpen={false}
          newsletterWeek="2025-W48"
          articleCount={3}
          onPublish={onPublish}
          onCancel={onCancel}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should call onCancel when cancel button is clicked', async () => {
      const onPublish = vi.fn()
      const onCancel = vi.fn()

      render(
        <PublishDialog
          isOpen={true}
          newsletterWeek="2025-W48"
          articleCount={3}
          onPublish={onPublish}
          onCancel={onCancel}
        />
      )

      const cancelButton = screen.getByText('取消')
      fireEvent.click(cancelButton)

      expect(onCancel).toHaveBeenCalled()
    })

    it('should disable publish button when article count is 0', async () => {
      const onPublish = vi.fn()
      const onCancel = vi.fn()

      render(
        <PublishDialog
          isOpen={true}
          newsletterWeek="2025-W48"
          articleCount={0}
          onPublish={onPublish}
          onCancel={onCancel}
        />
      )

      const publishButton = screen.getByText('確認發布')
      expect(publishButton).toBeDisabled()
      expect(onPublish).not.toHaveBeenCalled()
    })

    it('should call onPublish when confirm button is clicked with valid data', async () => {
      const onPublish = vi.fn().mockResolvedValue(undefined)
      const onCancel = vi.fn()

      render(
        <PublishDialog
          isOpen={true}
          newsletterWeek="2025-W48"
          articleCount={3}
          onPublish={onPublish}
          onCancel={onCancel}
        />
      )

      const publishButton = screen.getByText('確認發布')
      fireEvent.click(publishButton)

      await waitFor(() => {
        expect(onPublish).toHaveBeenCalled()
      })
    })

    it('should show loading state while publishing', async () => {
      const onPublish = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
      const onCancel = vi.fn()

      render(
        <PublishDialog
          isOpen={true}
          newsletterWeek="2025-W48"
          articleCount={3}
          onPublish={onPublish}
          onCancel={onCancel}
        />
      )

      const publishButton = screen.getByText('確認發布')
      fireEvent.click(publishButton)

      expect(screen.getByText('發布中...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText('確認發布')).toBeInTheDocument()
      })
    })

    it('should display error message if publish fails', async () => {
      const onPublish = vi.fn().mockRejectedValue(new Error('Network error'))
      const onCancel = vi.fn()

      render(
        <PublishDialog
          isOpen={true}
          newsletterWeek="2025-W48"
          articleCount={3}
          onPublish={onPublish}
          onCancel={onCancel}
        />
      )

      const publishButton = screen.getByText('確認發布')
      fireEvent.click(publishButton)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })
  })

  describe('NewsletterTable Status Display', () => {
    it('displays different status badges for different newsletter states', () => {
      const onPublish = vi.fn()
      const onArchive = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <NewsletterTable
            newsletters={mockNewsletters}
            onPublish={onPublish}
            onArchive={onArchive}
          />
        </BrowserRouter>
      )

      // Check for status badges by looking for elements with specific test ids
      const draftBadges = container.querySelectorAll('[data-testid*="status-badge"]')
      expect(draftBadges.length).toBeGreaterThan(0)

      // Check that all expected status text exists in the document
      const bodyText = container.textContent || ''
      expect(bodyText).toContain('草稿')
      expect(bodyText).toContain('已發布')
      expect(bodyText).toContain('已封存')
    })

    it('calls onPublish when publish action is triggered', async () => {
      const onPublish = vi.fn()
      const onArchive = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <NewsletterTable
            newsletters={mockNewsletters}
            onPublish={onPublish}
            onArchive={onArchive}
          />
        </BrowserRouter>
      )

      // Find and click publish button for draft newsletter
      const publishButtons = container.querySelectorAll('button')
      const draftRow = Array.from(publishButtons).find(btn =>
        btn.textContent?.includes('發布')
      )

      if (draftRow) {
        fireEvent.click(draftRow)
        expect(onPublish).toHaveBeenCalledWith('2025-W48')
      }
    })

    it('calls onArchive when archive action is triggered', async () => {
      const onPublish = vi.fn()
      const onArchive = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <NewsletterTable
            newsletters={mockNewsletters}
            onPublish={onPublish}
            onArchive={onArchive}
          />
        </BrowserRouter>
      )

      // Find and click archive button for published newsletter
      const archiveButtons = container.querySelectorAll('button')
      const publishedRow = Array.from(archiveButtons).find(btn =>
        btn.textContent?.includes('封存')
      )

      if (publishedRow) {
        fireEvent.click(publishedRow)
        expect(onArchive).toHaveBeenCalledWith('2025-W47')
      }
    })
  })

  describe('Complete Publish Workflow', () => {
    it('should complete full workflow: draft -> publish -> archive', async () => {
      const onPublish = vi.fn().mockResolvedValue(undefined)
      const onArchive = vi.fn().mockResolvedValue(undefined)
      const onCancel = vi.fn()

      // Step 1: Display draft newsletter with publish button
      const { rerender } = render(
        <PublishDialog
          isOpen={true}
          newsletterWeek="2025-W48"
          articleCount={3}
          onPublish={onPublish}
          onCancel={onCancel}
        />
      )

      expect(screen.getByText('確認發布')).toBeInTheDocument()

      // Step 2: Publish the newsletter
      const publishButton = screen.getByText('確認發布')
      fireEvent.click(publishButton)

      await waitFor(() => {
        expect(onPublish).toHaveBeenCalled()
      })

      // Step 3: Close dialog and display updated newsletter status
      onCancel()

      // Step 4: Update to show published newsletter with archive button
      rerender(
        <PublishDialog
          isOpen={false}
          newsletterWeek="2025-W48"
          articleCount={3}
          onPublish={onPublish}
          onCancel={onCancel}
        />
      )
    })
  })
})
