/**
 * MediaLibrary Component Tests (T057)
 * Tests for media library browser with search, filter, pagination, and selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaLibrary } from '@/components/MediaLibrary'
import type { MediaFile } from '@/types/media'

describe('MediaLibrary Component (T057)', () => {
  const mockMediaFiles: MediaFile[] = [
    {
      id: '1',
      fileName: 'test-image-1.jpg',
      fileSize: 102400,
      mimeType: 'image/jpeg',
      mediaType: 'image',
      status: 'uploaded',
      publicUrl: 'https://example.com/1.jpg',
      storageUrl: 'storage/1.jpg',
      width: 800,
      height: 600,
      duration: null,
      uploadedBy: 'user1',
      uploadedAt: '2025-01-01T10:00:00Z',
      updatedAt: '2025-01-01T10:00:00Z',
    },
    {
      id: '2',
      fileName: 'test-image-2.png',
      fileSize: 204800,
      mimeType: 'image/png',
      mediaType: 'image',
      status: 'uploaded',
      publicUrl: 'https://example.com/2.png',
      storageUrl: 'storage/2.png',
      width: 1024,
      height: 768,
      duration: null,
      uploadedBy: 'user1',
      uploadedAt: '2025-01-02T10:00:00Z',
      updatedAt: '2025-01-02T10:00:00Z',
    },
    {
      id: '3',
      fileName: 'test-audio.mp3',
      fileSize: 5242880,
      mimeType: 'audio/mpeg',
      mediaType: 'audio',
      status: 'uploaded',
      publicUrl: 'https://example.com/3.mp3',
      storageUrl: 'storage/3.mp3',
      width: null,
      height: null,
      duration: 180,
      uploadedBy: 'user1',
      uploadedAt: '2025-01-03T10:00:00Z',
      updatedAt: '2025-01-03T10:00:00Z',
    },
  ]

  const mockOnMediaSelected = vi.fn()
  const mockOnMediasSelected = vi.fn()

  const setup = (props = {}) => {
    render(
      <MediaLibrary
        mediaFiles={mockMediaFiles}
        onMediaSelected={mockOnMediaSelected}
        onMediasSelected={mockOnMediasSelected}
        multiSelect={false}
        disabled={false}
        {...props}
      />
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render media library component', () => {
      setup()
      expect(screen.getByPlaceholderText(/搜尋|Search/i)).toBeInTheDocument()
    })

    it('should display all media files', () => {
      setup()
      expect(screen.getByText('test-image-1.jpg')).toBeInTheDocument()
      expect(screen.getByText('test-image-2.png')).toBeInTheDocument()
      expect(screen.getByText('test-audio.mp3')).toBeInTheDocument()
    })

    it('should show file count', () => {
      setup()
      expect(screen.getByText(/Found 3 media files|找到 3 個媒體檔案/i)).toBeInTheDocument()
    })

    it('should display disabled state', () => {
      setup({ disabled: true })
      const searchInput = screen.getByPlaceholderText(/搜尋|Search/i)
      expect(searchInput).toBeDisabled()
    })
  })

  describe('Search Functionality', () => {
    it('should filter files by search query', async () => {
      const user = userEvent.setup()
      setup()

      const searchInput = screen.getByPlaceholderText(/搜尋|Search/i) as HTMLInputElement
      await user.type(searchInput, 'image-1')

      await waitFor(() => {
        expect(screen.getByText('test-image-1.jpg')).toBeInTheDocument()
        expect(screen.queryByText('test-image-2.png')).not.toBeInTheDocument()
      })
    })

    it('should be case-insensitive', async () => {
      const user = userEvent.setup()
      setup()

      const searchInput = screen.getByPlaceholderText(/搜尋|Search/i) as HTMLInputElement
      await user.type(searchInput, 'AUDIO')

      await waitFor(() => {
        expect(screen.getByText('test-audio.mp3')).toBeInTheDocument()
      })
    })

    it('should show empty state when no results match', async () => {
      const user = userEvent.setup()
      setup()

      const searchInput = screen.getByPlaceholderText(/搜尋|Search/i) as HTMLInputElement
      await user.type(searchInput, 'nonexistent-file')

      await waitFor(() => {
        expect(screen.getByText(/No media files found|無媒體檔案/i)).toBeInTheDocument()
      })
    })
  })

  describe('Media Type Filter', () => {
    it('should display filter buttons for media types', () => {
      setup()
      expect(screen.getByRole('button', { name: /All|全部/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Images|圖片/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Audio|音訊/i })).toBeInTheDocument()
    })

    it('should filter by image type', async () => {
      const user = userEvent.setup()
      setup()

      const imageButton = screen.getByRole('button', { name: /Images|圖片/i })
      await user.click(imageButton)

      await waitFor(() => {
        expect(screen.getByText('test-image-1.jpg')).toBeInTheDocument()
        expect(screen.getByText('test-image-2.png')).toBeInTheDocument()
        expect(screen.queryByText('test-audio.mp3')).not.toBeInTheDocument()
      })
    })

    it('should filter by audio type', async () => {
      const user = userEvent.setup()
      setup()

      const audioButton = screen.getByRole('button', { name: /Audio|音訊/i })
      await user.click(audioButton)

      await waitFor(() => {
        expect(screen.getByText('test-audio.mp3')).toBeInTheDocument()
        expect(screen.queryByText('test-image-1.jpg')).not.toBeInTheDocument()
      })
    })

    it('should show all types when "All" is selected', async () => {
      const user = userEvent.setup()
      setup()

      const allButton = screen.getByRole('button', { name: /All|全部/i })
      await user.click(allButton)

      await waitFor(() => {
        expect(screen.getByText('test-image-1.jpg')).toBeInTheDocument()
        expect(screen.getByText('test-audio.mp3')).toBeInTheDocument()
      })
    })
  })

  describe('Sorting', () => {
    it('should display sort dropdown', () => {
      setup()
      const sortSelect = screen.getByRole('combobox')
      expect(sortSelect).toBeInTheDocument()
    })

    it('should have sort options available', () => {
      setup()
      const sortSelect = screen.getByRole('combobox')
      expect(sortSelect).toHaveProperty('options')
    })
  })

  describe('Single Selection', () => {
    it('should call onMediaSelected when file is clicked', async () => {
      const user = userEvent.setup()
      setup({ multiSelect: false })

      const firstFileContainer = screen.getByText('test-image-1.jpg').closest('div')?.parentElement
      await user.click(firstFileContainer!)

      await waitFor(() => {
        expect(mockOnMediaSelected).toHaveBeenCalledWith(
          expect.objectContaining({
            id: '1',
            fileName: 'test-image-1.jpg',
          })
        )
      })
    })
  })

  describe('Multi Selection', () => {
    it('should show checkboxes in multi-select mode', () => {
      setup({ multiSelect: true })
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    it('should select multiple files', async () => {
      const user = userEvent.setup()
      setup({ multiSelect: true })

      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])

      await waitFor(() => {
        expect(mockOnMediasSelected).toHaveBeenCalled()
      })
    })
  })

  describe('File Metadata Display', () => {
    it('should display file name', () => {
      setup()
      expect(screen.getByText('test-image-1.jpg')).toBeInTheDocument()
    })

    it('should display formatted file size', () => {
      setup()
      // File sizes are formatted like "100 KB", "1 MB", etc.
      const fileElements = screen.getAllByText(/KB|MB|Bytes/i)
      expect(fileElements.length).toBeGreaterThan(0)
    })

    it('should display image dimensions for images', () => {
      setup()
      expect(screen.getByText('800×600px')).toBeInTheDocument()
    })
  })

  describe('Disabled State', () => {
    it('should disable search when disabled prop is true', () => {
      setup({ disabled: true })

      const searchInput = screen.getByPlaceholderText(/搜尋|Search/i)
      expect(searchInput).toBeDisabled()
    })
  })

  describe('Empty State', () => {
    it('should show empty message when no files', () => {
      render(
        <MediaLibrary
          mediaFiles={[]}
          onMediaSelected={mockOnMediaSelected}
          onMediasSelected={mockOnMediasSelected}
        />
      )

      expect(screen.getByText(/No media files found|無媒體檔案/i)).toBeInTheDocument()
    })

    it('should show count as zero', () => {
      render(
        <MediaLibrary
          mediaFiles={[]}
          onMediaSelected={mockOnMediaSelected}
          onMediasSelected={mockOnMediasSelected}
        />
      )

      expect(screen.getByText(/Found 0 media files|找到 0 個媒體檔案/i)).toBeInTheDocument()
    })
  })

  describe('CSS Classes and Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <MediaLibrary
          mediaFiles={mockMediaFiles}
          onMediaSelected={mockOnMediaSelected}
          onMediasSelected={mockOnMediasSelected}
          className="custom-library-class"
        />
      )

      expect(container.querySelector('.custom-library-class')).toBeInTheDocument()
    })
  })
})
