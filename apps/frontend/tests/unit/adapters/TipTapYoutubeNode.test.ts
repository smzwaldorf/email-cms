/**
 * 單元測試 - TipTapYoutubeNode YouTube 工具函數
 * Unit Test - TipTapYoutubeNode YouTube utility functions
 */

import { describe, it, expect } from 'vitest'
import {
  extractYouTubeVideoId,
  generateYouTubeEmbedUrl,
  isValidYouTubeUrl,
} from '@/adapters/TipTapYoutubeNode'

describe('YouTube Utility Functions', () => {
  describe('extractYouTubeVideoId', () => {
    it('should extract video ID from youtube.com/watch URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should extract video ID from youtu.be short URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should extract video ID from youtube.com/embed URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should extract video ID from URL with additional query parameters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30&list=PLxxx'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should extract video ID from youtu.be with query parameters', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ?t=30'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should recognize plain video ID', () => {
      const videoId = extractYouTubeVideoId('dQw4w9WgXcQ')
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should handle video ID with hyphens and underscores', () => {
      const videoId = extractYouTubeVideoId('9bZkp7q19f0')
      expect(videoId).toBe('9bZkp7q19f0')
    })

    it('should return null for invalid URL', () => {
      const videoId = extractYouTubeVideoId('https://example.com/video')
      expect(videoId).toBeNull()
    })

    it('should return null for empty string', () => {
      const videoId = extractYouTubeVideoId('')
      expect(videoId).toBeNull()
    })

    it('should handle non-HTTPS URLs', () => {
      const url = 'http://www.youtube.com/watch?v=dQw4w9WgXcQ'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should handle URLs without www', () => {
      const url = 'https://youtube.com/watch?v=dQw4w9WgXcQ'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should handle URLs with anchors', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ#section'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })
  })

  describe('generateYouTubeEmbedUrl', () => {
    it('should generate basic embed URL from video ID', () => {
      const url = generateYouTubeEmbedUrl('dQw4w9WgXcQ')
      expect(url).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ')
      expect(url).toContain('rel=0')
      expect(url).toContain('modestbranding=1')
    })

    it('should include start time when provided', () => {
      const url = generateYouTubeEmbedUrl('dQw4w9WgXcQ', { startTime: 60 })
      expect(url).toContain('start=60')
    })

    it('should include autoplay when enabled', () => {
      const url = generateYouTubeEmbedUrl('dQw4w9WgXcQ', { autoplay: true })
      expect(url).toContain('autoplay=1')
    })

    it('should include both start and autoplay when both provided', () => {
      const url = generateYouTubeEmbedUrl('dQw4w9WgXcQ', {
        startTime: 30,
        autoplay: true,
      })
      expect(url).toContain('start=30')
      expect(url).toContain('autoplay=1')
    })

    it('should not include autoplay when explicitly set to false', () => {
      const url = generateYouTubeEmbedUrl('dQw4w9WgXcQ', { autoplay: false })
      expect(url).not.toContain('autoplay=1')
    })

    it('should handle zero start time', () => {
      const url = generateYouTubeEmbedUrl('dQw4w9WgXcQ', { startTime: 0 })
      expect(url).toContain('start=0')
    })

    it('should handle large start times', () => {
      const url = generateYouTubeEmbedUrl('dQw4w9WgXcQ', { startTime: 3600 })
      expect(url).toContain('start=3600')
    })

    it('should return empty string for empty video ID', () => {
      const url = generateYouTubeEmbedUrl('')
      expect(url).toBe('')
    })

    it('should always disable related videos', () => {
      const url = generateYouTubeEmbedUrl('dQw4w9WgXcQ')
      expect(url).toContain('rel=0')
    })

    it('should always enable modest branding', () => {
      const url = generateYouTubeEmbedUrl('dQw4w9WgXcQ')
      expect(url).toContain('modestbranding=1')
    })
  })

  describe('isValidYouTubeUrl', () => {
    it('should validate youtube.com/watch URLs', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    })

    it('should validate youtu.be short URLs', () => {
      expect(isValidYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    })

    it('should validate youtube.com/embed URLs', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true)
    })

    it('should validate plain video IDs', () => {
      expect(isValidYouTubeUrl('dQw4w9WgXcQ')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(isValidYouTubeUrl('https://example.com/video')).toBe(false)
    })

    it('should reject empty strings', () => {
      expect(isValidYouTubeUrl('')).toBe(false)
    })

    it('should reject URLs without video ID', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/')).toBe(false)
    })

    it('should validate IDs with hyphens and underscores', () => {
      expect(isValidYouTubeUrl('9bZkp7q19f0')).toBe(true)
      expect(isValidYouTubeUrl('Ks-_Mh1QhMc')).toBe(true)
    })
  })

  describe('Video ID Format', () => {
    it('should validate 11-character alphanumeric IDs', () => {
      const validIds = [
        'dQw4w9WgXcQ',
        '9bZkp7q19f0',
        'Ks-_Mh1QhMc',
        'jNQXAC9IVRw',
      ]

      validIds.forEach((id) => {
        expect(isValidYouTubeUrl(id)).toBe(true)
      })
    })

    it('should reject IDs with invalid characters', () => {
      const invalidIds = [
        'dQw4w9WgXc@', // @ is invalid
        'dQw4w9WgXc!', // ! is invalid
        'dQw4w9WgXc ', // space is invalid
      ]

      invalidIds.forEach((id) => {
        expect(isValidYouTubeUrl(id)).toBe(false)
      })
    })

    it('should reject IDs that are too short', () => {
      expect(isValidYouTubeUrl('short')).toBe(false)
    })

    it('should reject IDs that are too long', () => {
      expect(isValidYouTubeUrl('dQw4w9WgXcQdQw4w9WgXcQ')).toBe(false)
    })
  })

  describe('URL Edge Cases', () => {
    it('should handle URLs with multiple v parameters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&v=other'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should handle URLs with weird parameter ordering', () => {
      const url = 'https://www.youtube.com/watch?t=30&v=dQw4w9WgXcQ&list=xxx'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })

    it('should handle youtu.be with slash suffix', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ/'
      const videoId = extractYouTubeVideoId(url)
      expect(videoId).toBe('dQw4w9WgXcQ')
    })
  })
})
