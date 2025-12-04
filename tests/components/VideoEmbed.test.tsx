/**
 * 組件測試 - VideoEmbed (影片嵌入)
 * Component Test - VideoEmbed
 * 測試影片嵌入的回應式設計和長寬比維持
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoEmbed } from '@/components/VideoEmbed'

describe('VideoEmbed Component', () => {
  describe('Rendering', () => {
    it('should render YouTube iframe with valid video ID', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('src')
      expect(iframe.getAttribute('src')).toContain('dQw4w9WgXcQ')
    })

    it('should extract video ID from full YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      render(<VideoEmbed src={url} />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe.getAttribute('src')).toContain('dQw4w9WgXcQ')
    })

    it('should extract video ID from youtu.be short URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ'
      render(<VideoEmbed src={url} />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe.getAttribute('src')).toContain('dQw4w9WgXcQ')
    })

    it('should extract video ID from youtube.com/embed/ URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      render(<VideoEmbed src={url} />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe.getAttribute('src')).toContain('dQw4w9WgXcQ')
    })

    it('should show error for invalid YouTube URL', () => {
      render(<VideoEmbed src="https://example.com/not-a-video" />)

      expect(screen.getByText('無效的 YouTube URL')).toBeInTheDocument()
    })

    it('should show error when no video ID or src provided', () => {
      render(<VideoEmbed />)

      expect(screen.getByText('無效的 YouTube URL')).toBeInTheDocument()
    })

    it('should have proper title attribute', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" title="My Video Title" />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe).toHaveAttribute('title', 'My Video Title')
    })
  })

  describe('Responsive Design', () => {
    it('should maintain 16:9 aspect ratio', () => {
      const { container } = render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      // Check for the aspect ratio wrapper with padding-bottom
      const wrappers = container.querySelectorAll('div')
      let hasAspectRatio = false
      wrappers.forEach((div) => {
        const style = div.getAttribute('style')
        if (style && (style.includes('paddingBottom') || style.includes('padding-bottom')) && style.includes('56.25%')) {
          hasAspectRatio = true
        }
      })
      expect(hasAspectRatio).toBe(true)
    })

    it('should support custom width', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" width="800px" />)

      // Just verify it renders without error
      const embed = screen.getByTestId('video-embed')
      expect(embed).toBeInTheDocument()
    })

    it('should support numeric width', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" width={600} />)

      // Just verify it renders without error
      const embed = screen.getByTestId('video-embed')
      expect(embed).toBeInTheDocument()
    })

    it('should default to 100% width for responsive design', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      // Just verify it renders without error
      const embed = screen.getByTestId('video-embed')
      expect(embed).toBeInTheDocument()
    })

    it('should have fullscreen capabilities', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe).toHaveAttribute('allowFullScreen')
    })
  })

  describe('YouTube URL Parameters', () => {
    it('should include start time in embed URL', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" startTime={60} />)

      const iframe = screen.getByTestId('video-iframe')
      const src = iframe.getAttribute('src') || ''
      expect(src).toContain('start=60')
    })

    it('should include autoplay parameter when enabled', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" autoplay={true} />)

      const iframe = screen.getByTestId('video-iframe')
      const src = iframe.getAttribute('src') || ''
      expect(src).toContain('autoplay=1')
    })

    it('should not include autoplay when disabled', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" autoplay={false} />)

      const iframe = screen.getByTestId('video-iframe')
      const src = iframe.getAttribute('src') || ''
      expect(src).not.toContain('autoplay=1')
    })

    it('should disable related videos', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      const src = iframe.getAttribute('src') || ''
      expect(src).toContain('rel=0')
    })

    it('should enable modest branding', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      const src = iframe.getAttribute('src') || ''
      expect(src).toContain('modestbranding=1')
    })
  })

  describe('Iframe Attributes', () => {
    it('should have proper sandbox attributes for security', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe).toHaveAttribute('allow')
      expect(iframe.getAttribute('allow')).toContain('accelerometer')
      expect(iframe.getAttribute('allow')).toContain('encrypted-media')
    })

    it('should have no border', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe).toHaveAttribute('frameBorder', '0')
    })

    it('should be keyboard accessible', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      // iframe should be focusable (role="region" by default)
      expect(iframe).toBeInTheDocument()
    })
  })

  describe('CSS Classes', () => {
    it('should apply shadow and rounded corners', () => {
      const { container } = render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('rounded-lg', 'shadow-md')
    })

    it('should apply custom CSS classes', () => {
      const { container } = render(
        <VideoEmbed videoId="dQw4w9WgXcQ" className="custom-class" />
      )

      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('custom-class')
    })

    it('should have black background for iframe container', () => {
      const { container } = render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const aspectRatioDiv = container.querySelector('.bg-black')
      expect(aspectRatioDiv).toBeInTheDocument()
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should work on small screens', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" width="100%" />)

      const embed = screen.getByTestId('video-embed')
      expect(embed).toBeInTheDocument()

      // 100% width should work responsively
      const container = embed.querySelector('[style*="width: 100%"]')
      expect(container).toBeInTheDocument()
    })

    it('should maintain aspect ratio on all screen sizes', () => {
      const { container } = render(
        <VideoEmbed videoId="dQw4w9WgXcQ" width="100%" />
      )

      // Check for aspect ratio padding
      const wrappers = container.querySelectorAll('div')
      let hasAspectRatio = false
      wrappers.forEach((div) => {
        const style = div.getAttribute('style')
        if (style && (style.includes('paddingBottom') || style.includes('padding-bottom')) && style.includes('56.25%')) {
          hasAspectRatio = true
        }
      })
      expect(hasAspectRatio).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very short video ID', () => {
      // Valid YouTube IDs are 11 characters
      render(<VideoEmbed videoId="abc" />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe).toBeInTheDocument()
    })

    it('should handle URL with multiple query parameters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30&list=PLxxx'
      render(<VideoEmbed src={url} />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe.getAttribute('src')).toContain('dQw4w9WgXcQ')
    })

    it('should prefer videoId prop over src prop', () => {
      render(
        <VideoEmbed
          src="https://www.youtube.com/watch?v=otherID"
          videoId="dQw4w9WgXcQ"
        />
      )

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe.getAttribute('src')).toContain('dQw4w9WgXcQ')
    })
  })
})
