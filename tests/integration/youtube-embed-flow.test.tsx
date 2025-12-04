/**
 * 整合測試 - YouTube 嵌入流程 (T070)
 * Integration Test - YouTube Embed Flow
 * 驗證使用者故事 3: YouTube 影片嵌入與回應式設計
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoEmbed } from '@/components/VideoEmbed'
import {
  extractYouTubeVideoId,
  generateYouTubeEmbedUrl,
  isValidYouTubeUrl,
} from '@/adapters/TipTapYoutubeNode'

describe('Integration: YouTube Embed Flow (T070)', () => {
  const validVideoIds = [
    'dQw4w9WgXcQ',
    '9bZkp7q19f0',
    'Ks-_Mh1QhMc',
    'jNQXAC9IVRw',
  ]

  const youtubeUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&t=30',
  ]

  describe('FR-010: YouTube URL Conversion', () => {
    it('should detect valid YouTube URLs', () => {
      youtubeUrls.forEach((url) => {
        expect(isValidYouTubeUrl(url)).toBe(true)
      })
    })

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'https://example.com/video',
        'https://vimeo.com/123456',
        'not-a-url',
      ]

      invalidUrls.forEach((url) => {
        expect(isValidYouTubeUrl(url)).toBe(false)
      })
    })

    it('should extract correct video IDs from various URL formats', () => {
      const testCases = [
        {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          expectedId: 'dQw4w9WgXcQ',
        },
        {
          url: 'https://youtu.be/9bZkp7q19f0',
          expectedId: '9bZkp7q19f0',
        },
        {
          url: 'https://www.youtube.com/embed/Ks-_Mh1QhMc',
          expectedId: 'Ks-_Mh1QhMc',
        },
        {
          url: 'https://youtube.com/watch?v=jNQXAC9IVRw&t=45',
          expectedId: 'jNQXAC9IVRw',
        },
      ]

      testCases.forEach(({ url, expectedId }) => {
        const videoId = extractYouTubeVideoId(url)
        expect(videoId).toBe(expectedId)
      })
    })

    it('should handle video ID with timestamps', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should handle video ID with playlist parameters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxx&index=5'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })
  })

  describe('FR-011: Embedded Player with Standard Controls', () => {
    it('should render embedded player with video controls', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('allowFullScreen')
    })

    it('should provide standard YouTube controls', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      const src = iframe.getAttribute('src') || ''

      // Verify standard YouTube iframe controls are available
      expect(iframe.getAttribute('allow')).toContain('accelerometer')
      expect(iframe.getAttribute('allow')).toContain('autoplay')
      expect(iframe.getAttribute('allow')).toContain('encrypted-media')
    })

    it('should allow fullscreen viewing', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe).toHaveAttribute('allowFullScreen')
    })

    it('should disable related videos', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const iframe = screen.getByTestId('video-iframe')
      const src = iframe.getAttribute('src') || ''
      expect(src).toContain('rel=0')
    })

    it('should support timestamp start', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" startTime={60} />)

      const iframe = screen.getByTestId('video-iframe')
      const src = iframe.getAttribute('src') || ''
      expect(src).toContain('start=60')
    })

    it('should support autoplay option', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" autoplay={true} />)

      const iframe = screen.getByTestId('video-iframe')
      const src = iframe.getAttribute('src') || ''
      expect(src).toContain('autoplay=1')
    })
  })

  describe('SC-003: Device Compatibility (95%+)', () => {
    describe('Desktop Rendering', () => {
      it('should render properly on desktop size', () => {
        render(<VideoEmbed videoId="dQw4w9WgXcQ" width="800px" />)

        const embed = screen.getByTestId('video-embed')
        expect(embed).toBeInTheDocument()
      })

      it('should maintain aspect ratio on desktop', () => {
        const { container } = render(<VideoEmbed videoId="dQw4w9WgXcQ" width="1200px" />)

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

      it('should support wide desktop screens', () => {
        render(<VideoEmbed videoId="dQw4w9WgXcQ" width="1920px" />)

        const embed = screen.getByTestId('video-embed')
        expect(embed).toBeInTheDocument()
      })
    })

    describe('Mobile Rendering', () => {
      it('should be responsive on mobile devices', () => {
        render(<VideoEmbed videoId="dQw4w9WgXcQ" width="100%" />)

        const embed = screen.getByTestId('video-embed')
        expect(embed).toBeInTheDocument()
      })

      it('should maintain aspect ratio on mobile', () => {
        const { container } = render(<VideoEmbed videoId="dQw4w9WgXcQ" width="100%" />)

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

      it('should support small screens', () => {
        render(<VideoEmbed videoId="dQw4w9WgXcQ" width="320px" />)

        const embed = screen.getByTestId('video-embed')
        expect(embed).toBeInTheDocument()
      })
    })

    describe('Tablet Rendering', () => {
      it('should work on tablet size screens', () => {
        render(<VideoEmbed videoId="dQw4w9WgXcQ" width="768px" />)

        const embed = screen.getByTestId('video-embed')
        expect(embed).toBeInTheDocument()
      })

      it('should maintain 16:9 aspect ratio on tablets', () => {
        const { container } = render(<VideoEmbed videoId="dQw4w9WgXcQ" width="768px" />)

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
  })

  describe('Responsive Design', () => {
    it('should maintain 16:9 aspect ratio on all sizes', () => {
      const sizes = ['320px', '768px', '1024px', '1920px']

      sizes.forEach((size) => {
        const { container } = render(<VideoEmbed videoId="dQw4w9WgXcQ" width={size} />)

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

    it('should support flexible width with 100%', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" width="100%" />)

      const embed = screen.getByTestId('video-embed')
      expect(embed).toBeInTheDocument()
    })

    it('should work without explicit width (defaults to 100%)', () => {
      render(<VideoEmbed videoId="dQw4w9WgXcQ" />)

      const embed = screen.getByTestId('video-embed')
      expect(embed).toBeInTheDocument()
    })
  })

  describe('Complete Workflow', () => {
    it('should handle complete URL paste → conversion → display flow', () => {
      // Step 1: User pastes YouTube URL
      const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

      // Step 2: Extract video ID
      const videoId = extractYouTubeVideoId(youtubeUrl)
      expect(videoId).toBe('dQw4w9WgXcQ')

      // Step 3: Validate URL
      expect(isValidYouTubeUrl(youtubeUrl)).toBe(true)

      // Step 4: Generate embed URL
      const embedUrl = generateYouTubeEmbedUrl(videoId)
      expect(embedUrl).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ')

      // Step 5: Render component
      render(<VideoEmbed src={youtubeUrl} />)

      // Step 6: Verify display
      const iframe = screen.getByTestId('video-iframe')
      expect(iframe).toBeInTheDocument()
      expect(iframe.getAttribute('src')).toContain('dQw4w9WgXcQ')
    })

    it('should handle URL with timestamp and convert properly', () => {
      const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120'

      // Extract video ID (should ignore timestamp)
      const videoId = extractYouTubeVideoId(youtubeUrl)
      expect(videoId).toBe('dQw4w9WgXcQ')

      // Generate embed URL with start time
      const embedUrl = generateYouTubeEmbedUrl(videoId, { startTime: 120 })
      expect(embedUrl).toContain('start=120')

      // Render component
      render(<VideoEmbed src={youtubeUrl} startTime={120} />)

      const iframe = screen.getByTestId('video-iframe')
      const src = iframe.getAttribute('src') || ''
      expect(src).toContain('start=120')
    })

    it('should handle short youtu.be URL format', () => {
      const shortUrl = 'https://youtu.be/dQw4w9WgXcQ'

      const videoId = extractYouTubeVideoId(shortUrl)
      expect(videoId).toBe('dQw4w9WgXcQ')

      const embedUrl = generateYouTubeEmbedUrl(videoId)
      expect(embedUrl).toContain('dQw4w9WgXcQ')

      render(<VideoEmbed src={shortUrl} />)

      const iframe = screen.getByTestId('video-iframe')
      expect(iframe).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error message for invalid URL', () => {
      render(<VideoEmbed src="https://example.com/not-a-video" />)

      expect(screen.getByText('無效的 YouTube URL')).toBeInTheDocument()
    })

    it('should display error message when no video ID provided', () => {
      render(<VideoEmbed />)

      expect(screen.getByText('無效的 YouTube URL')).toBeInTheDocument()
    })

    it('should handle null video ID gracefully', () => {
      const videoId = extractYouTubeVideoId('not-a-url')
      expect(videoId).toBeNull()
    })
  })
})
