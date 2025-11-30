/**
 * HtmlSanitizer 單元測試
 * HtmlSanitizer Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { htmlSanitizer } from '@/services/htmlSanitizer'

describe('HtmlSanitizer', () => {
  describe('sanitize', () => {
    it('should remove script tags', () => {
      const dirty = '<p>Hello</p><script>alert("XSS")</script>'
      const result = htmlSanitizer.sanitize(dirty)

      expect(result.html).not.toContain('<script>')
      expect(result.html).toContain('Hello')
      expect(result.cleaned).toBe(true)
    })

    it('should remove event handlers', () => {
      const dirty = '<p onclick="alert(\'XSS\')">Click me</p>'
      const result = htmlSanitizer.sanitize(dirty)

      expect(result.html).not.toContain('onclick')
      expect(result.cleaned).toBe(true)
    })

    it('should preserve safe tags', () => {
      const html = '<p><strong>bold</strong> and <em>italic</em></p>'
      const result = htmlSanitizer.sanitize(html)

      expect(result.html).toContain('<strong>')
      expect(result.html).toContain('<em>')
      expect(result.cleaned).toBe(false)
    })

    it('should preserve links with safe attributes', () => {
      const html = '<a href="https://example.com">Example</a>'
      const result = htmlSanitizer.sanitize(html)

      expect(result.html).toContain('<a')
      expect(result.html).toContain('href')
    })

    it('should remove javascript: URLs', () => {
      const dirty = '<a href="javascript:alert(\'XSS\')">Click</a>'
      const result = htmlSanitizer.sanitize(dirty)

      expect(result.html).not.toContain('javascript:')
    })

    it('should preserve img tags with attributes', () => {
      const html = '<img src="image.jpg" alt="Image">'
      const result = htmlSanitizer.sanitize(html)

      expect(result.html).toContain('<img')
    })

    it('should preserve list tags', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
      const result = htmlSanitizer.sanitize(html)

      expect(result.html).toContain('<ul>')
      expect(result.html).toContain('<li>')
    })

    it('should preserve table tags', () => {
      const html = '<table><tr><td>Data</td></tr></table>'
      const result = htmlSanitizer.sanitize(html)

      expect(result.html).toContain('<table')
    })

    it('should return metadata about cleaning', () => {
      const dirty = '<p>Text</p><script>alert()</script>'
      const result = htmlSanitizer.sanitize(dirty)

      expect(result.cleaned).toBe(true)
      expect(Array.isArray(result.removedTags)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('should handle empty input', () => {
      const result = htmlSanitizer.sanitize('')

      expect(result.html).toBe('')
      expect(result.cleaned).toBe(false)
    })
  })

  describe('sanitizeText', () => {
    it('should escape HTML special characters', () => {
      const text = '<script>alert("XSS")</script>'
      const escaped = htmlSanitizer.sanitizeText(text)

      expect(escaped).not.toContain('<script>')
      expect(escaped).toContain('&lt;')
      expect(escaped).toContain('&gt;')
    })

    it('should escape ampersands', () => {
      const text = 'A & B'
      const escaped = htmlSanitizer.sanitizeText(text)

      expect(escaped).toBe('A &amp; B')
    })

    it('should escape quotes', () => {
      const text = 'He said "Hello"'
      const escaped = htmlSanitizer.sanitizeText(text)

      expect(escaped).toContain('&quot;')
    })

    it('should handle apostrophes', () => {
      const text = "It's working"
      const escaped = htmlSanitizer.sanitizeText(text)

      expect(escaped).toContain('&#039;')
    })
  })

  describe('isSafe', () => {
    it('should return true for safe HTML', () => {
      const safe = '<p><strong>Bold text</strong></p>'
      expect(htmlSanitizer.isSafe(safe)).toBe(true)
    })

    it('should return false for unsafe HTML', () => {
      const unsafe = '<p>Text</p><script>alert("XSS")</script>'
      expect(htmlSanitizer.isSafe(unsafe)).toBe(false)
    })

    it('should return true for empty HTML', () => {
      expect(htmlSanitizer.isSafe('')).toBe(true)
    })
  })

  describe('detectXSSPatterns', () => {
    it('should detect script tags', () => {
      const html = '<script>alert("XSS")</script>'
      const patterns = htmlSanitizer.detectXSSPatterns(html)

      expect(patterns.length).toBeGreaterThan(0)
    })

    it('should detect javascript: protocol', () => {
      const html = '<a href="javascript:void(0)">Click</a>'
      const patterns = htmlSanitizer.detectXSSPatterns(html)

      expect(patterns.some((p) => p.includes('javascript'))).toBe(true)
    })

    it('should detect event handlers', () => {
      const html = '<p onclick="alert()">Text</p>'
      const patterns = htmlSanitizer.detectXSSPatterns(html)

      expect(patterns.length).toBeGreaterThan(0)
    })

    it('should detect iframe tags', () => {
      const html = '<iframe src="evil.com"></iframe>'
      const patterns = htmlSanitizer.detectXSSPatterns(html)

      expect(patterns.length).toBeGreaterThan(0)
    })

    it('should return empty for safe HTML', () => {
      const html = '<p>Safe content</p>'
      const patterns = htmlSanitizer.detectXSSPatterns(html)

      expect(patterns.length).toBe(0)
    })
  })

  describe('XSS attack prevention', () => {
    it('should prevent inline script execution', () => {
      const attacks = [
        '<img src=x onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        '<body onload="alert(\'XSS\')">',
        '<input onfocus="alert(\'XSS\')" autofocus>',
      ]

      attacks.forEach((attack) => {
        const result = htmlSanitizer.sanitize(attack)
        expect(result.html).not.toContain('onerror')
        expect(result.html).not.toContain('onload')
        expect(result.html).not.toContain('onfocus')
      })
    })

    it('should prevent data URL attacks', () => {
      const attack = '<img src="data:text/html,<script>alert(\'XSS\')</script>">'
      const result = htmlSanitizer.sanitize(attack)

      expect(result.html).not.toContain('data:text/html')
    })

    it('should prevent protocol-based attacks', () => {
      const attacks = [
        '<a href="javascript:alert(\'XSS\')">Link</a>',
        '<a href="vbscript:alert(\'XSS\')">Link</a>',
        '<img src="javascript:alert(\'XSS\')">',
      ]

      attacks.forEach((attack) => {
        const result = htmlSanitizer.sanitize(attack)
        expect(result.html).not.toContain('javascript:')
        expect(result.html).not.toContain('vbscript:')
      })
    })
  })

  describe('sanitizeTagAttributes', () => {
    it('should remove disallowed attributes', () => {
      const html = '<a href="test" onclick="alert()">Link</a>'
      const cleaned = htmlSanitizer.sanitizeTagAttributes(html, 'a', ['href'])

      expect(cleaned).toContain('href')
      expect(cleaned).not.toContain('onclick')
    })

    it('should preserve allowed attributes', () => {
      const html = '<img src="test.jpg" alt="Test" title="Image">'
      const cleaned = htmlSanitizer.sanitizeTagAttributes(html, 'img', [
        'src',
        'alt',
      ])

      expect(cleaned).toContain('src')
      expect(cleaned).toContain('alt')
    })
  })

  describe('allowYouTubeEmbed', () => {
    it('should add YouTube iframe', () => {
      const html = '<p>Original content</p>'
      const withEmbed = htmlSanitizer.allowYouTubeEmbed(html, 'dQw4w9WgXcQ')

      expect(withEmbed).toContain('iframe')
      expect(withEmbed).toContain('dQw4w9WgXcQ')
      expect(withEmbed).toContain('youtube')
    })

    it('should preserve original content', () => {
      const html = '<p>Original</p>'
      const withEmbed = htmlSanitizer.allowYouTubeEmbed(html, 'videoId')

      expect(withEmbed).toContain('Original')
    })

    it('should remove existing iframes', () => {
      const html = '<p>Text</p><iframe src="evil.com"></iframe>'
      const withEmbed = htmlSanitizer.allowYouTubeEmbed(html, 'videoId')

      expect(withEmbed).not.toContain('evil.com')
      expect(withEmbed).toContain('youtube')
    })
  })

  describe('config access', () => {
    it('should return DOMPurify configuration', () => {
      const config = htmlSanitizer.getConfig()

      expect(config).toBeDefined()
      expect(Array.isArray(config.ALLOWED_TAGS)).toBe(true)
    })
  })

  describe('integration scenarios', () => {
    it('should handle rich text with multiple elements', () => {
      const richHtml = `
        <h2>Title</h2>
        <p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
        <img src="image.jpg" alt="Description">
      `

      const result = htmlSanitizer.sanitize(richHtml)

      expect(result.html).toContain('<h2>')
      expect(result.html).toContain('<strong>')
      expect(result.html).toContain('<em>')
      expect(result.html).toContain('<ul>')
      expect(result.cleaned).toBe(false)
    })

    it('should handle mixed safe and unsafe content', () => {
      const mixed = `
        <p>Safe paragraph</p>
        <script>alert('XSS')</script>
        <strong>Safe bold</strong>
        <img src="x" onerror="alert('XSS')">
      `

      const result = htmlSanitizer.sanitize(mixed)

      expect(result.html).toContain('Safe paragraph')
      expect(result.html).toContain('<strong>')
      expect(result.html).not.toContain('<script>')
      expect(result.html).not.toContain('onerror')
      expect(result.cleaned).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle nested tags', () => {
      const html = '<div><p><span><strong>Text</strong></span></p></div>'
      const result = htmlSanitizer.sanitize(html)

      expect(result.html).toContain('<strong>')
    })

    it('should handle self-closing tags', () => {
      const html = '<p>Line<br/>Next line</p>'
      const result = htmlSanitizer.sanitize(html)

      expect(result.html).toContain('<br')
    })

    it('should handle whitespace preservation', () => {
      const html = '<p>Text   with   spaces</p>'
      const result = htmlSanitizer.sanitize(html)

      expect(result.html).toContain('Text')
    })

    it('should handle Unicode characters', () => {
      const html = '<p>Hello 世界 🌍</p>'
      const result = htmlSanitizer.sanitize(html)

      expect(result.html).toContain('Hello')
      expect(result.html).toContain('🌍')
    })
  })
})
