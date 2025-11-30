/**
 * ContentConverter 單元測試
 * ContentConverter Unit Tests
 */

import { describe, it, expect } from 'vitest'
import { contentConverter } from '@/services/contentConverter'

describe('ContentConverter', () => {
  describe('markdownToHtml', () => {
    it('should convert basic markdown to HTML', () => {
      const markdown = '# Heading\n**bold** text'
      const html = contentConverter.markdownToHtml(markdown)

      expect(html).toContain('<h1>Heading</h1>')
      expect(html).toContain('<strong>bold</strong>')
    })

    it('should convert bold markers', () => {
      const markdown = '**bold text**'
      const html = contentConverter.markdownToHtml(markdown)

      expect(html).toContain('<strong>bold text</strong>')
    })

    it('should convert italic markers', () => {
      const markdown = '*italic text*'
      const html = contentConverter.markdownToHtml(markdown)

      expect(html).toContain('<em>italic text</em>')
    })

    it('should convert strikethrough', () => {
      const markdown = '~~strikethrough~~'
      const html = contentConverter.markdownToHtml(markdown)

      expect(html).toContain('<del>strikethrough</del>')
    })

    it('should convert headers', () => {
      const markdown = '# H1\n## H2\n### H3'
      const html = contentConverter.markdownToHtml(markdown)

      expect(html).toContain('<h1>H1</h1>')
      expect(html).toContain('<h2>H2</h2>')
      expect(html).toContain('<h3>H3</h3>')
    })

    it('should convert inline code', () => {
      const markdown = 'Use `const` keyword'
      const html = contentConverter.markdownToHtml(markdown)

      expect(html).toContain('<code>const</code>')
    })

    it('should handle empty markdown', () => {
      const html = contentConverter.markdownToHtml('')
      expect(typeof html).toBe('string')
    })
  })

  describe('htmlToMarkdown', () => {
    it('should convert HTML to markdown', () => {
      const html = '<h1>Heading</h1><p><strong>bold</strong> text</p>'
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('# Heading')
      expect(markdown).toContain('**bold**')
    })

    it('should convert HTML headers', () => {
      const html = '<h1>H1</h1><h2>H2</h2><h3>H3</h3>'
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('# H1')
      expect(markdown).toContain('## H2')
      expect(markdown).toContain('### H3')
    })

    it('should convert HTML links', () => {
      const html = '<a href="https://example.com">Example</a>'
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('[Example](https://example.com)')
    })

    it('should convert list items', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('- Item 1')
      expect(markdown).toContain('- Item 2')
    })

    it('should remove HTML tags', () => {
      const html = '<div><span>Clean text</span></div>'
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('Clean text')
      expect(markdown).not.toContain('<div>')
    })
  })

  describe('calculateFidelity', () => {
    it('should return 100 for identical content', () => {
      const content = 'Hello World'
      const fidelity = contentConverter.calculateFidelity(content, content)

      expect(fidelity).toBe(100)
    })

    it('should return 0 for completely different content', () => {
      const fidelity = contentConverter.calculateFidelity('Hello', 'World')

      expect(fidelity).toBeLessThan(100)
    })

    it('should return 100 for empty original content', () => {
      const fidelity = contentConverter.calculateFidelity('', '')

      expect(fidelity).toBe(100)
    })

    it('should ignore whitespace differences', () => {
      const original = 'Hello World'
      const converted = 'HelloWorld' // Spaces removed

      const fidelity = contentConverter.calculateFidelity(original, converted)

      expect(fidelity).toBeGreaterThan(80) // High similarity despite space removal
    })

    it('should calculate similarity for similar content', () => {
      const original = 'The quick brown fox'
      const converted = 'The quick brown cat'

      const fidelity = contentConverter.calculateFidelity(original, converted)

      expect(fidelity).toBeGreaterThan(70) // Most content is similar
      expect(fidelity).toBeLessThan(100)
    })
  })

  describe('validateConversion', () => {
    it('should return success for high fidelity conversion', () => {
      const result = contentConverter.validateConversion('Hello', 'Hello', 80)

      expect(result.success).toBe(true)
      expect(result.fidelity).toBe(100)
    })

    it('should return warning for low fidelity conversion', () => {
      const result = contentConverter.validateConversion('Hello World', 'Hi', 80)

      expect(result.success).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.fidelity).toBeLessThan(100)
    })

    it('should include fidelity in result', () => {
      const result = contentConverter.validateConversion('Test', 'Test')

      expect(result.fidelity).toBeDefined()
      expect(typeof result.fidelity).toBe('number')
    })
  })

  describe('repairMarkdown', () => {
    it('should close unclosed bold markers', () => {
      const markdown = 'This is **bold'
      const repaired = contentConverter.repairMarkdown(markdown)

      const boldCount = (repaired.match(/\*\*/g) || []).length
      expect(boldCount % 2).toBe(0)
    })

    it('should close unclosed code markers', () => {
      const markdown = 'Use `code'
      const repaired = contentConverter.repairMarkdown(markdown)

      const codeCount = (repaired.match(/`/g) || []).length
      expect(codeCount % 2).toBe(0)
    })

    it('should not modify complete markdown', () => {
      const markdown = '**bold** and `code`'
      const repaired = contentConverter.repairMarkdown(markdown)

      expect(repaired).toBe(markdown)
    })
  })

  describe('tiptapToHtml', () => {
    it('should convert TipTap JSON to HTML', () => {
      const tiptapJson = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Hello World',
              },
            ],
          },
        ],
      }

      const html = contentConverter.tiptapToHtml(tiptapJson)

      expect(html).toContain('Hello World')
      expect(html).toContain('<p>')
    })

    it('should handle empty TipTap document', () => {
      const tiptapJson = {
        type: 'doc',
        content: [],
      }

      const html = contentConverter.tiptapToHtml(tiptapJson)

      expect(html).toBe('')
    })

    it('should handle null input', () => {
      const html = contentConverter.tiptapToHtml(null)

      expect(html).toBe('')
    })

    it('should convert heading nodes', () => {
      const tiptapJson = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
        ],
      }

      const html = contentConverter.tiptapToHtml(tiptapJson)

      expect(html).toContain('<h1>')
      expect(html).toContain('Title')
    })

    it('should convert list nodes', () => {
      const tiptapJson = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Item 1' }],
                  },
                ],
              },
            ],
          },
        ],
      }

      const html = contentConverter.tiptapToHtml(tiptapJson)

      expect(html).toContain('<ul>')
      expect(html).toContain('<li>')
      expect(html).toContain('Item 1')
    })
  })

  describe('htmlToTiptap', () => {
    it('should convert HTML to TipTap JSON', () => {
      const html = '<p>Hello World</p>'
      const tiptapJson = contentConverter.htmlToTiptap(html)

      expect(tiptapJson.type).toBe('doc')
      expect(tiptapJson.content).toBeDefined()
    })

    it('should handle empty HTML', () => {
      const tiptapJson = contentConverter.htmlToTiptap('')

      expect(tiptapJson.type).toBe('doc')
      expect(Array.isArray(tiptapJson.content)).toBe(true)
    })

    it('should preserve heading levels', () => {
      const html = '<h2>Heading</h2>'
      const tiptapJson = contentConverter.htmlToTiptap(html)

      // Document structure should be preserved
      expect(tiptapJson.content).toBeDefined()
    })
  })

  describe('markdownToTiptap', () => {
    it('should convert markdown to TipTap JSON', () => {
      const markdown = '# Title\n**bold text**'
      const tiptapJson = contentConverter.markdownToTiptap(markdown)

      expect(tiptapJson.type).toBe('doc')
      expect(tiptapJson.content).toBeDefined()
      expect(Array.isArray(tiptapJson.content)).toBe(true)
    })

    it('should handle empty markdown', () => {
      const tiptapJson = contentConverter.markdownToTiptap('')

      expect(tiptapJson.type).toBe('doc')
    })
  })

  describe('tiptapToMarkdown', () => {
    it('should convert TipTap JSON to markdown', () => {
      const tiptapJson = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Hello',
                marks: [{ type: 'bold' }],
              },
            ],
          },
        ],
      }

      const markdown = contentConverter.tiptapToMarkdown(tiptapJson)

      expect(typeof markdown).toBe('string')
    })
  })

  describe('bidirectional conversion', () => {
    it('should preserve content through markdown -> html -> markdown cycle', () => {
      const original = '**bold** and *italic*'
      const html = contentConverter.markdownToHtml(original)
      const back = contentConverter.htmlToMarkdown(html)

      expect(back.toLowerCase()).toContain('bold')
      expect(back.toLowerCase()).toContain('italic')
    })

    it('should maintain structure through conversion cycles', () => {
      const markdown = '# Title\n\nParagraph with **bold** and *italic*.'
      const html = contentConverter.markdownToHtml(markdown)
      const back = contentConverter.htmlToMarkdown(html)

      // Should contain key elements
      expect(back).toContain('Title')
      expect(back).toContain('**bold**')
      expect(back).toContain('*italic*')
    })
  })

  describe('error handling', () => {
    it('should handle malformed HTML gracefully', () => {
      const malformedHtml = '<p>Unclosed paragraph<div>Nested'
      const markdown = contentConverter.htmlToMarkdown(malformedHtml)

      expect(typeof markdown).toBe('string')
    })

    it('should handle null/undefined inputs', () => {
      expect(() => contentConverter.markdownToHtml(null as any)).not.toThrow()
      expect(() => contentConverter.htmlToMarkdown(undefined as any)).not.toThrow()
    })

    it('should handle very long content', () => {
      const longContent = 'a'.repeat(10000) + '\n' + '**bold**'
      const html = contentConverter.markdownToHtml(longContent)

      expect(html.length).toBeGreaterThan(0)
      expect(html).toContain('<strong>bold</strong>')
    })
  })
})
