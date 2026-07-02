/**
 * AudioPlayer Component Tests (T080)
 * Tests for HTML5 audio player with controls
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AudioPlayer from '@/components/AudioPlayer'

describe('AudioPlayer Component (T080)', () => {
  const mockAudioUrl = 'https://example.com/audio.mp3'

  const setup = (props = {}) => {
    return render(
      <AudioPlayer
        src={mockAudioUrl}
        title="Test Audio"
        duration={180}
        {...props}
      />
    )
  }

  beforeEach(() => {
    // Clear any test state
  })

  describe('Basic Rendering', () => {
    it('should render audio player container', () => {
      setup()
      const player = screen.getByTestId('audio-player')
      expect(player).toBeInTheDocument()
    })

    it('should render audio element with correct source', () => {
      const { container } = setup()
      const audioElement = container.querySelector('audio')
      expect(audioElement).toBeInTheDocument()
      expect(audioElement?.src).toBe(mockAudioUrl)
    })

    it('should display audio title', () => {
      setup()
      expect(screen.getByText('Test Audio')).toBeInTheDocument()
    })

    it('should render play/pause button', () => {
      setup()
      const playButton = screen.getByTestId('audio-play-button')
      expect(playButton).toBeInTheDocument()
    })

    it('should render progress bar', () => {
      setup()
      const progressBar = screen.getByTestId('audio-progress')
      expect(progressBar).toBeInTheDocument()
    })

    it('should render time displays', () => {
      setup()
      expect(screen.getByTestId('current-time')).toBeInTheDocument()
      expect(screen.getByTestId('duration')).toBeInTheDocument()
    })

    it('should render volume control', () => {
      setup()
      const volumeControl = screen.getByTestId('audio-volume')
      expect(volumeControl).toBeInTheDocument()
    })

    it('should render mute button', () => {
      setup()
      const muteButton = screen.getByTestId('audio-mute-button')
      expect(muteButton).toBeInTheDocument()
    })
  })

  describe('Audio Element Configuration', () => {
    it('should have crossOrigin attribute', () => {
      const { container } = setup()
      const audioElement = container.querySelector('audio')
      expect(audioElement?.crossOrigin).toBe('anonymous')
    })

    it('should have preload metadata', () => {
      const { container } = setup()
      const audioElement = container.querySelector('audio')
      expect(audioElement?.preload).toBe('metadata')
    })

    it('should be hidden', () => {
      const { container } = setup()
      const audioElement = container.querySelector('audio')
      expect(audioElement).toHaveClass('hidden')
    })
  })

  describe('Time Display', () => {
    it('should display current time as 0:00 initially', () => {
      setup()
      const currentTime = screen.getByTestId('current-time')
      expect(currentTime).toHaveTextContent('0:00')
    })

    it('should display duration in MM:SS format', () => {
      setup({ duration: 180 })
      const durationDisplay = screen.getByTestId('duration')
      expect(durationDisplay).toHaveTextContent('3:00')
    })

    it('should format time with seconds padding', () => {
      setup({ duration: 65 })
      const durationDisplay = screen.getByTestId('duration')
      expect(durationDisplay).toHaveTextContent('1:05')
    })

    it('should display time separator', () => {
      setup()
      const player = screen.getByTestId('audio-player')
      expect(player.textContent).toContain('/')
    })
  })

  describe('Progress Bar Configuration', () => {
    it('should have correct progress bar min value', () => {
      setup()
      const progressBar = screen.getByTestId('audio-progress') as HTMLInputElement
      expect(progressBar.min).toBe('0')
    })

    it('should have correct progress bar max value', () => {
      setup({ duration: 180 })
      const progressBar = screen.getByTestId('audio-progress') as HTMLInputElement
      expect(progressBar.max).toBe('180')
    })

    it('should be disabled when no duration', () => {
      setup({ duration: 0 })
      const progressBar = screen.getByTestId('audio-progress')
      expect(progressBar).toBeDisabled()
    })

    it('should be enabled with valid duration', () => {
      setup({ duration: 180 })
      const progressBar = screen.getByTestId('audio-progress')
      expect(progressBar).not.toBeDisabled()
    })
  })

  describe('Volume Control', () => {
    it('should have correct volume range', () => {
      setup()
      const volumeControl = screen.getByTestId('audio-volume') as HTMLInputElement
      expect(volumeControl.min).toBe('0')
      expect(volumeControl.max).toBe('1')
      expect(volumeControl.step).toBe('0.1')
    })

    it('should render mute button with title', () => {
      setup()
      const muteButton = screen.getByTestId('audio-mute-button')
      expect(muteButton).toHaveAttribute('title')
    })
  })

  describe('Play Button States', () => {
    it('should be enabled with valid duration', () => {
      setup({ duration: 180 })
      const playButton = screen.getByTestId('audio-play-button')
      expect(playButton).not.toBeDisabled()
    })

    it('should be disabled with zero duration', () => {
      setup({ duration: 0 })
      const playButton = screen.getByTestId('audio-play-button')
      expect(playButton).toBeDisabled()
    })

    it('should have proper styling when disabled', () => {
      setup({ duration: 0 })
      const playButton = screen.getByTestId('audio-play-button')
      expect(playButton).toHaveClass('bg-gray-200')
    })
  })

  describe('Responsive Design', () => {
    it('should have full width layout', () => {
      setup()
      const player = screen.getByTestId('audio-player')
      expect(player).toHaveClass('w-full')
    })

    it('should have rounded corners', () => {
      setup()
      const player = screen.getByTestId('audio-player')
      expect(player).toHaveClass('rounded-lg')
    })

    it('should have border styling', () => {
      setup()
      const player = screen.getByTestId('audio-player')
      expect(player).toHaveClass('border')
    })

    it('should have shadow styling', () => {
      setup()
      const player = screen.getByTestId('audio-player')
      expect(player).toHaveClass('shadow-sm')
    })

    it('should have gradient background', () => {
      setup()
      const player = screen.getByTestId('audio-player')
      expect(player).toHaveClass('bg-gradient-to-r')
    })
  })

  describe('Title Display', () => {
    it('should display title when provided', () => {
      setup({ title: 'My Audio' })
      expect(screen.getByText('My Audio')).toBeInTheDocument()
    })

    it('should not display title when not provided', () => {
      setup({ title: undefined })
      const titleElements = screen.queryAllByText('My Audio')
      expect(titleElements.length).toBe(0)
    })

    it('should apply truncate class to title', () => {
      setup()
      const titleElement = screen.getByText('Test Audio')
      expect(titleElement).toHaveClass('truncate')
    })

    it('should display Chinese titles', () => {
      setup({ title: '中文音訊' })
      expect(screen.getByText('中文音訊')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero duration gracefully', () => {
      setup({ duration: 0 })
      const durationDisplay = screen.getByTestId('duration')
      expect(durationDisplay).toHaveTextContent('0:00')
    })

    it('should handle large duration values', () => {
      setup({ duration: 3661 }) // 1 hour, 1 minute, 1 second
      const durationDisplay = screen.getByTestId('duration')
      expect(durationDisplay.textContent).toMatch(/:/);
    })

    it('should handle undefined title', () => {
      const { container } = setup({ title: undefined })
      expect(container.querySelector('[data-testid="audio-player"]')).toBeInTheDocument()
    })

    it('should handle NaN duration values', () => {
      setup({ duration: NaN })
      const durationDisplay = screen.getByTestId('duration')
      expect(durationDisplay.textContent).toBe('0:00')
    })
  })

  describe('Accessibility', () => {
    it('should have semantic button elements', () => {
      setup()
      const playButton = screen.getByTestId('audio-play-button')
      expect(playButton.tagName).toBe('BUTTON')
    })

    it('should have accessible range inputs', () => {
      setup()
      const progressBar = screen.getByTestId('audio-progress')
      expect(progressBar.tagName).toBe('INPUT')
      expect(progressBar).toHaveAttribute('type', 'range')
    })

    it('should have title attributes on buttons', () => {
      setup()
      const playButton = screen.getByTestId('audio-play-button')
      const muteButton = screen.getByTestId('audio-mute-button')
      expect(playButton).toHaveAttribute('title')
      expect(muteButton).toHaveAttribute('title')
    })
  })
})
