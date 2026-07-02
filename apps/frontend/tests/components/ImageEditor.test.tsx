/**
 * ImageEditor Component Tests (T056)
 * Tests for image property editor component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageEditor, type ImageProperties } from '@/components/ImageEditor'

describe('ImageEditor Component (T056)', () => {
  const mockOnPropertiesChange = vi.fn()
  const mockImageUrl = 'https://example.com/image.jpg'
  const mockInitialProperties: ImageProperties = {
    width: 400,
    height: 300,
    alt: 'Test Image',
    title: 'Test Title',
    align: 'center',
    caption: 'Test Caption',
  }

  const setup = (properties = mockInitialProperties) => {
    render(
      <ImageEditor
        imageUrl={mockImageUrl}
        initialProperties={properties}
        onPropertiesChange={mockOnPropertiesChange}
      />
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render image preview', () => {
      setup()
      const image = screen.getByRole('img')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', mockImageUrl)
    })

    it('should render all property editors', () => {
      setup()
      expect(screen.getByDisplayValue('Test Image')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test Title')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test Caption')).toBeInTheDocument()
    })

    it('should display dimension inputs', () => {
      setup()
      const widthInput = screen.getByDisplayValue('400')
      const heightInput = screen.getByDisplayValue('300')
      expect(widthInput).toBeInTheDocument()
      expect(heightInput).toBeInTheDocument()
    })
  })

  describe('Alt Text Editing', () => {
    it('should update alt text', async () => {
      const user = userEvent.setup()
      setup()

      const altInput = screen.getByDisplayValue('Test Image') as HTMLInputElement
      await user.clear(altInput)
      await user.type(altInput, 'New Alt Text')

      await waitFor(() => {
        expect(mockOnPropertiesChange).toHaveBeenCalledWith(
          expect.objectContaining({ alt: 'New Alt Text' })
        )
      })
    })

    it('should allow empty alt text', async () => {
      const user = userEvent.setup()
      setup()

      const altInput = screen.getByDisplayValue('Test Image') as HTMLInputElement
      await user.clear(altInput)

      await waitFor(() => {
        expect(mockOnPropertiesChange).toHaveBeenCalledWith(
          expect.objectContaining({ alt: '' })
        )
      })
    })
  })

  describe('Title Editing', () => {
    it('should update title', async () => {
      const user = userEvent.setup()
      setup()

      const titleInput = screen.getByDisplayValue('Test Title') as HTMLInputElement
      await user.clear(titleInput)
      await user.type(titleInput, 'New Title')

      await waitFor(() => {
        expect(mockOnPropertiesChange).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'New Title' })
        )
      })
    })

    it('should allow empty title', async () => {
      const user = userEvent.setup()
      setup()

      const titleInput = screen.getByDisplayValue('Test Title') as HTMLInputElement
      await user.clear(titleInput)

      await waitFor(() => {
        expect(mockOnPropertiesChange).toHaveBeenCalledWith(
          expect.objectContaining({ title: '' })
        )
      })
    })
  })

  describe('Caption Editing', () => {
    it('should update caption', async () => {
      const user = userEvent.setup()
      setup()

      const captionInput = screen.getByDisplayValue('Test Caption') as HTMLTextAreaElement
      await user.clear(captionInput)
      await user.type(captionInput, 'New Caption Text')

      await waitFor(() => {
        expect(mockOnPropertiesChange).toHaveBeenCalledWith(
          expect.objectContaining({ caption: 'New Caption Text' })
        )
      })
    })

    it('should support multi-line caption', async () => {
      const user = userEvent.setup()
      setup()

      const captionInput = screen.getByDisplayValue('Test Caption') as HTMLTextAreaElement
      await user.clear(captionInput)
      await user.type(captionInput, 'Line 1{Enter}Line 2')

      await waitFor(() => {
        const lastCall = mockOnPropertiesChange.mock.calls[mockOnPropertiesChange.mock.calls.length - 1]?.[0]
        expect(lastCall?.caption).toContain('Line 1')
      })
    })
  })

  describe('Alignment Controls', () => {
    it('should display alignment buttons', () => {
      setup()
      expect(screen.getByRole('button', { name: /left/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /center/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /right/i })).toBeInTheDocument()
    })

    it('should update alignment on button click', async () => {
      const user = userEvent.setup()
      setup()

      const leftButton = screen.getByRole('button', { name: /left/i })
      await user.click(leftButton)

      await waitFor(() => {
        expect(mockOnPropertiesChange).toHaveBeenCalledWith(
          expect.objectContaining({ align: 'left' })
        )
      })
    })

    it('should show active alignment button', () => {
      setup()
      const centerButton = screen.getByRole('button', { name: /center/i })
      expect(centerButton).toHaveClass('bg-blue-500')
    })
  })

  describe('Dimension Controls', () => {
    it('should display width and height inputs', () => {
      setup()
      const widthInput = screen.getByDisplayValue('400')
      const heightInput = screen.getByDisplayValue('300')
      expect(widthInput).toBeInTheDocument()
      expect(heightInput).toBeInTheDocument()
    })

    it('should update width', async () => {
      const user = userEvent.setup()
      setup()

      const widthInput = screen.getByDisplayValue('400') as HTMLInputElement
      await user.clear(widthInput)
      await user.type(widthInput, '600')

      await waitFor(() => {
        expect(mockOnPropertiesChange).toHaveBeenCalledWith(
          expect.objectContaining({ width: 600 })
        )
      })
    })

    it('should display height input', () => {
      setup()
      const numberInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
      const heightInput = numberInputs.find(input => input.value === '300')
      expect(heightInput).toBeInTheDocument()
    })
  })

  describe('Callback Handling', () => {
    it('should call onPropertiesChange with updated properties', async () => {
      const user = userEvent.setup()
      setup()

      const altInput = screen.getByDisplayValue('Test Image') as HTMLInputElement
      await user.clear(altInput)
      await user.type(altInput, 'New Alt')

      await waitFor(() => {
        expect(mockOnPropertiesChange).toHaveBeenCalled()
      })
    })

    it('should include all properties in onPropertiesChange callback', async () => {
      const user = userEvent.setup()
      setup()

      const titleInput = screen.getByDisplayValue('Test Title') as HTMLInputElement
      await user.clear(titleInput)
      await user.type(titleInput, 'Updated Title')

      await waitFor(() => {
        const lastCall = mockOnPropertiesChange.mock.calls[mockOnPropertiesChange.mock.calls.length - 1]?.[0]
        expect(lastCall).toHaveProperty('alt')
        expect(lastCall).toHaveProperty('title')
        expect(lastCall).toHaveProperty('align')
        expect(lastCall).toHaveProperty('width')
        expect(lastCall).toHaveProperty('height')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing properties gracefully', () => {
      render(
        <ImageEditor
          imageUrl={mockImageUrl}
          initialProperties={{}}
          onPropertiesChange={mockOnPropertiesChange}
        />
      )
      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('should handle very large dimensions', async () => {
      const user = userEvent.setup()
      setup()

      const widthInput = screen.getByDisplayValue('400') as HTMLInputElement
      await user.clear(widthInput)
      await user.type(widthInput, '4000')

      await waitFor(() => {
        expect(mockOnPropertiesChange).toHaveBeenCalledWith(
          expect.objectContaining({ width: 4000 })
        )
      })
    })

    it('should handle very long alt text', async () => {
      const user = userEvent.setup()
      setup()

      const altInput = screen.getByDisplayValue('Test Image') as HTMLInputElement
      const longText = 'a'.repeat(500)
      await user.clear(altInput)
      await user.type(altInput, longText)

      await waitFor(() => {
        expect(mockOnPropertiesChange).toHaveBeenCalledWith(
          expect.objectContaining({ alt: longText })
        )
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic HTML structure', () => {
      setup()
      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('should have focusable input elements', () => {
      setup()
      const inputs = screen.getAllByRole('textbox')
      expect(inputs.length).toBeGreaterThan(0)
    })
  })
})
