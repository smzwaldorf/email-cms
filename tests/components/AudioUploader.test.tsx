/**
 * AudioUploader Component Tests (T079)
 * Tests for audio file uploader with drag-drop and validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AudioUploader from '@/components/AudioUploader'

describe('AudioUploader Component (T079)', () => {
  const mockOnFilesSelected = vi.fn()

  const setup = (props = {}) => {
    return render(
      <AudioUploader
        onFilesSelected={mockOnFilesSelected}
        maxFiles={5}
        maxFileSize={52428800}
        {...props}
      />
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render upload area', () => {
      const { container } = setup()
      expect(container.querySelector('div')).toBeInTheDocument()
    })

    it('should display upload instructions', () => {
      setup()
      const text = screen.getByText(/拖放音訊檔案|Drag audio files/i)
      expect(text).toBeInTheDocument()
    })

    it('should display supported audio formats', () => {
      setup()
      expect(screen.getByText(/MP3|WAV|OGG/)).toBeInTheDocument()
    })

    it('should have file input element', () => {
      const { container } = setup()
      const fileInput = container.querySelector('input[type="file"]')
      expect(fileInput).toBeInTheDocument()
    })
  })

  describe('File Input Configuration', () => {
    it('should accept multiple audio files', () => {
      const { container } = setup()
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput.multiple).toBe(true)
    })

    it('should have audio media type accept', () => {
      const { container } = setup()
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput.accept).toContain('audio')
    })
  })

  describe('Disabled State', () => {
    it('should disable input when disabled prop is true', () => {
      const { container } = setup({ disabled: true })
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput.disabled).toBe(true)
    })

    it('should enable input when disabled prop is false', () => {
      const { container } = setup({ disabled: false })
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput.disabled).toBe(false)
    })
  })

  describe('File Selection', () => {
    it('should call onFilesSelected with valid audio file', async () => {
      const user = userEvent.setup()
      const { container } = setup()

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const audioFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' })

      await user.upload(fileInput, audioFile)

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalled()
        const callArgs = mockOnFilesSelected.mock.calls[0][0]
        expect(callArgs).toContainEqual(expect.objectContaining({ name: 'test.mp3' }))
      })
    })

    it('should accept multiple files', async () => {
      const user = userEvent.setup()
      const { container } = setup()

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const file1 = new File(['audio1'], 'test1.mp3', { type: 'audio/mpeg' })
      const file2 = new File(['audio2'], 'test2.wav', { type: 'audio/wav' })

      await user.upload(fileInput, [file1, file2])

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalled()
      })
    })
  })

  describe('Audio Format Validation', () => {
    it('should not call callback with invalid audio files', async () => {
      const user = userEvent.setup()
      const { container } = setup()

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const textFile = new File(['text'], 'document.txt', { type: 'text/plain' })

      await user.upload(fileInput, textFile)

      // Component should validate and not call onFilesSelected for invalid files
      expect(mockOnFilesSelected).not.toHaveBeenCalled()
    })

    it('should accept MP3 files', async () => {
      const user = userEvent.setup()
      const { container } = setup()

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const mp3File = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' })

      await user.upload(fileInput, mp3File)

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalled()
      })
    })

    it('should accept WAV files', async () => {
      const user = userEvent.setup()
      const { container } = setup()

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const wavFile = new File(['audio'], 'test.wav', { type: 'audio/wav' })

      await user.upload(fileInput, wavFile)

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalled()
      })
    })

    it('should accept OGG files', async () => {
      const user = userEvent.setup()
      const { container } = setup()

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const oggFile = new File(['audio'], 'test.ogg', { type: 'audio/ogg' })

      await user.upload(fileInput, oggFile)

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalled()
      })
    })
  })

  describe('File Size Validation', () => {
    it('should reject files exceeding size limit', async () => {
      const user = userEvent.setup()
      const { container } = setup({ maxFileSize: 1024 }) // 1KB

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const largeFile = new File(['x'.repeat(2048)], 'large.mp3', { type: 'audio/mpeg' })

      await user.upload(fileInput, largeFile)

      await waitFor(() => {
        expect(screen.getByText(/檔案大小超過限制|File size exceeds limit/i)).toBeInTheDocument()
      })
    })

    it('should accept files within size limit', async () => {
      const user = userEvent.setup()
      const { container } = setup({ maxFileSize: 52428800 })

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const validFile = new File(['x'.repeat(1024)], 'valid.mp3', { type: 'audio/mpeg' })

      await user.upload(fileInput, validFile)

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalled()
      })
    })
  })

  describe('File Count Validation', () => {
    it('should reject more files than max allowed', async () => {
      const user = userEvent.setup()
      const { container } = setup({ maxFiles: 2 })

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const files = [
        new File(['a1'], 'test1.mp3', { type: 'audio/mpeg' }),
        new File(['a2'], 'test2.mp3', { type: 'audio/mpeg' }),
        new File(['a3'], 'test3.mp3', { type: 'audio/mpeg' }),
      ]

      await user.upload(fileInput, files)

      await waitFor(() => {
        expect(screen.getByText(/最多只能上傳|Maximum.*files allowed/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Display', () => {
    it('should handle invalid files without calling callback', async () => {
      const user = userEvent.setup()
      const { container } = setup()

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const invalidFile = new File(['text'], 'file.txt', { type: 'text/plain' })

      await user.upload(fileInput, invalidFile)

      // Invalid files should not be passed to the callback
      expect(mockOnFilesSelected).not.toHaveBeenCalled()
    })

    it('should reject oversized files', async () => {
      const user = userEvent.setup()
      const { container } = setup({ maxFileSize: 1024 })

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const largeFile = new File(['x'.repeat(2048)], 'large.mp3', { type: 'audio/mpeg' })

      await user.upload(fileInput, largeFile)

      // Oversized files should not be passed to the callback
      await waitFor(() => {
        expect(mockOnFilesSelected).not.toHaveBeenCalled()
      })
    })
  })

  describe('Bilingual Support', () => {
    it('should display Chinese UI text', () => {
      setup()
      expect(screen.getByText(/拖放音訊檔案/)).toBeInTheDocument()
    })

    it('should display English UI text', () => {
      setup()
      expect(screen.getByText(/Drag audio files/)).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty file selection', () => {
      const { container } = setup()
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toBeInTheDocument()
    })

    it('should handle file with special characters', async () => {
      const user = userEvent.setup()
      const { container } = setup()

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const specialFile = new File(['audio'], '音訊_test-2024.mp3', { type: 'audio/mpeg' })

      await user.upload(fileInput, specialFile)

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalled()
      })
    })
  })

  describe('Max File Size Display', () => {
    it('should display max file size information', () => {
      setup({ maxFileSize: 52428800 })
      const maxSizeText = screen.getByText(/最大檔案大小|Max file size/i)
      expect(maxSizeText).toBeInTheDocument()
      expect(maxSizeText.textContent).toContain('50')
    })
  })
})
