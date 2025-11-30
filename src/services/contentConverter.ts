/**
 * 內容轉換服務 - Markdown ↔ TipTap ↔ HTML 轉換
 * Content Converter Service - Markdown ↔ TipTap ↔ HTML conversion
 */

import type { ConversionResult, TipTapDocument, TipTapNode } from '@/types/editor'

/**
 * 轉換結果詳情
 * Conversion result details
 */
export interface DetailedConversionResult extends ConversionResult {
  sourceFormat: 'markdown' | 'html' | 'tiptap'
  targetFormat: 'markdown' | 'html' | 'tiptap'
  duration: number // 毫秒 / milliseconds
}

/**
 * 內容轉換服務
 * Content Converter Service
 */
export const contentConverter = {
  /**
   * Markdown 轉換為 HTML
   * Convert Markdown to HTML
   */
  markdownToHtml(markdown: string): string {
    try {
      // 基本的 Markdown 轉換邏輯
      // Basic Markdown conversion logic
      let html = markdown

      // 標題 / Headers
      html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>')

      // 粗體 / Bold
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')

      // 斜體 / Italic
      html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
      html = html.replace(/_(.*?)_/g, '<em>$1</em>')

      // 刪除線 / Strikethrough
      html = html.replace(/~~(.*?)~~/g, '<del>$1</del>')

      // 無序列表 / Unordered list
      html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>')
      html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

      // 有序列表 / Ordered list
      html = html.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>')

      // 程式碼 / Code
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

      // 區塊引用 / Blockquote
      html = html.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>')

      // 換行 / Line breaks
      html = html.replace(/\n\n/g, '</p><p>')
      html = '<p>' + html + '</p>'

      // 清理 / Clean up
      html = html.replace(/<p><\/p>/g, '')
      html = html.replace(/<p><ul>/g, '<ul>')
      html = html.replace(/<\/ul><\/p>/g, '</ul>')

      return html
    } catch (error) {
      console.error('Markdown to HTML conversion error:', error)
      return markdown
    }
  },

  /**
   * HTML 轉換為 Markdown
   * Convert HTML to Markdown
   */
  htmlToMarkdown(html: string): string {
    try {
      let markdown = html

      // 標題 / Headers
      markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
      markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
      markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
      markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
      markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n')
      markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n')

      // 粗體 / Bold
      markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')

      // 斜體 / Italic
      markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')

      // 刪除線 / Strikethrough
      markdown = markdown.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')
      markdown = markdown.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')

      // 程式碼 / Code
      markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')

      // 區塊引用 / Blockquote
      markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n')

      // 連結 / Links
      markdown = markdown.replace(
        /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi,
        '[$2]($1)'
      )

      // 列表項目 / List items
      markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      markdown = markdown.replace(/<ul[^>]*>|<\/ul>/gi, '')
      markdown = markdown.replace(/<ol[^>]*>|<\/ol>/gi, '')

      // 換行和段落 / Line breaks and paragraphs
      markdown = markdown.replace(/<br\s*\/?>/gi, '\n')
      markdown = markdown.replace(/<p[^>]*>/gi, '')
      markdown = markdown.replace(/<\/p>/gi, '\n\n')

      // 移除其他 HTML 標籤 / Remove other HTML tags
      markdown = markdown.replace(/<[^>]+>/g, '')

      // 清理空白 / Clean whitespace
      markdown = markdown.replace(/\n{3,}/g, '\n\n')
      markdown = markdown.trim()

      return markdown
    } catch (error) {
      console.error('HTML to Markdown conversion error:', error)
      return html
    }
  },

  /**
   * TipTap JSON 轉換為 HTML
   * Convert TipTap JSON to HTML
   */
  tiptapToHtml(tiptapJson: any): string {
    try {
      if (!tiptapJson || !tiptapJson.content) {
        return ''
      }

      return this._renderTipTapNode(tiptapJson.content)
    } catch (error) {
      console.error('TipTap to HTML conversion error:', error)
      return ''
    }
  },

  /**
   * TipTap JSON 轉換為 Markdown
   * Convert TipTap JSON to Markdown
   */
  tiptapToMarkdown(tiptapJson: any): string {
    try {
      const html = this.tiptapToHtml(tiptapJson)
      return this.htmlToMarkdown(html)
    } catch (error) {
      console.error('TipTap to Markdown conversion error:', error)
      return ''
    }
  },

  /**
   * Markdown 轉換為 TipTap JSON
   * Convert Markdown to TipTap JSON
   */
  markdownToTiptap(markdown: string): TipTapDocument {
    try {
      const html = this.markdownToHtml(markdown)
      return this.htmlToTiptap(html)
    } catch (error) {
      console.error('Markdown to TipTap conversion error:', error)
      return {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: markdown,
              },
            ],
          },
        ],
      }
    }
  },

  /**
   * HTML 轉換為 TipTap JSON
   * Convert HTML to TipTap JSON
   */
  htmlToTiptap(html: string): TipTapDocument {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const content = this._parseHtmlToTiptapNodes(doc.body)

      return {
        type: 'doc',
        content: content.length > 0 ? content : [{ type: 'paragraph' }],
      }
    } catch (error) {
      console.error('HTML to TipTap conversion error:', error)
      return {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: html }],
          },
        ],
      }
    }
  },

  /**
   * 計算內容保真度（0-100）
   * Calculate content fidelity (0-100)
   */
  calculateFidelity(original: string, converted: string): number {
    try {
      // 移除空白後比較
      // Compare after removing whitespace
      const originalClean = original.replace(/\s+/g, '')
      const convertedClean = converted.replace(/\s+/g, '')

      if (originalClean.length === 0) return 100
      if (convertedClean.length === 0) return 0

      // 計算相似度 / Calculate similarity
      const similarity = this._calculateStringSimilarity(
        originalClean,
        convertedClean
      )
      return Math.round(similarity * 100)
    } catch (error) {
      console.error('Fidelity calculation error:', error)
      return 0
    }
  },

  /**
   * 驗證轉換的內容
   * Validate converted content
   */
  validateConversion(
    original: string,
    converted: string,
    minFidelity: number = 80
  ): ConversionResult {
    const fidelity = this.calculateFidelity(original, converted)
    const warnings: string[] = []
    const errors: string[] = []

    if (fidelity < minFidelity) {
      warnings.push(
        `內容保真度 ${fidelity}% 低於目標 ${minFidelity}% / Content fidelity ${fidelity}% below target ${minFidelity}%`
      )
    }

    return {
      success: errors.length === 0,
      content: converted,
      warnings,
      errors,
      fidelity,
    }
  },

  /**
   * 修復不完整的 Markdown
   * Repair incomplete Markdown
   */
  repairMarkdown(markdown: string): string {
    try {
      let repaired = markdown

      // 修復未閉合的粗體 / Fix unclosed bold
      const boldCount = (repaired.match(/\*\*/g) || []).length
      if (boldCount % 2 !== 0) {
        repaired += '**'
      }

      // 修復未閉合的斜體 / Fix unclosed italic
      const italicCount = (repaired.match(/(?<!\*)\*(?!\*)/g) || []).length
      if (italicCount % 2 !== 0) {
        repaired += '*'
      }

      // 修復未閉合的程式碼 / Fix unclosed code
      const codeCount = (repaired.match(/`/g) || []).length
      if (codeCount % 2 !== 0) {
        repaired += '`'
      }

      return repaired
    } catch (error) {
      console.error('Markdown repair error:', error)
      return markdown
    }
  },

  // ===== 私有輔助方法 / Private helper methods =====

  /**
   * 呈現 TipTap 節點為 HTML
   * Render TipTap nodes to HTML
   */
  _renderTipTapNode(nodes: any[]): string {
    return (nodes || [])
      .map((node) => {
        switch (node.type) {
          case 'paragraph':
            return `<p>${this._renderTipTapContent(node.content)}</p>`

          case 'heading':
            const level = node.attrs?.level || 1
            return `<h${level}>${this._renderTipTapContent(node.content)}</h${level}>`

          case 'bulletList':
            return `<ul>${this._renderTipTapNode(node.content)}</ul>`

          case 'orderedList':
            return `<ol>${this._renderTipTapNode(node.content)}</ol>`

          case 'listItem':
            return `<li>${this._renderTipTapContent(node.content)}</li>`

          case 'codeBlock':
            return `<pre><code>${this._escape(this._renderTipTapContent(node.content))}</code></pre>`

          case 'blockquote':
            return `<blockquote>${this._renderTipTapNode(node.content)}</blockquote>`

          case 'image':
            return `<img src="${node.attrs?.src || ''}" alt="${node.attrs?.alt || ''}">`

          case 'horizontalRule':
            return '<hr>'

          default:
            return node.content ? this._renderTipTapNode(node.content) : ''
        }
      })
      .join('')
  },

  /**
   * 呈現 TipTap 內容（包含標記）
   * Render TipTap content with marks
   */
  _renderTipTapContent(content: any[]): string {
    if (!content) return ''

    return (content || [])
      .map((item) => {
        let text = item.text || ''

        // 套用標記 / Apply marks
        if (item.marks) {
          item.marks.forEach((mark: any) => {
            switch (mark.type) {
              case 'bold':
                text = `<strong>${text}</strong>`
                break
              case 'italic':
                text = `<em>${text}</em>`
                break
              case 'underline':
                text = `<u>${text}</u>`
                break
              case 'strikethrough':
                text = `<del>${text}</del>`
                break
              case 'code':
                text = `<code>${this._escape(text)}</code>`
                break
              case 'link':
                text = `<a href="${mark.attrs?.href || ''}">${text}</a>`
                break
            }
          })
        }

        return text
      })
      .join('')
  },

  /**
   * 解析 HTML 為 TipTap 節點
   * Parse HTML to TipTap nodes
   */
  _parseHtmlToTiptapNodes(element: any): TipTapNode[] {
    const nodes: TipTapNode[] = []

    for (const child of element.childNodes) {
      if (child.nodeType === 3) {
        // 文本節點 / Text node
        const text = child.textContent?.trim()
        if (text) {
          nodes.push({
            type: 'paragraph',
            content: [{ type: 'text', text }],
          })
        }
      } else if (child.nodeType === 1) {
        // 元素節點 / Element node
        const tagName = child.tagName.toLowerCase()
        const node = this._createTipTapNode(child, tagName)
        if (node) {
          nodes.push(node)
        }
      }
    }

    return nodes
  },

  /**
   * 根據 HTML 標籤建立 TipTap 節點
   * Create TipTap node from HTML tag
   */
  _createTipTapNode(element: any, tagName: string): TipTapNode | null {
    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return {
          type: 'heading',
          attrs: { level: parseInt(tagName[1]) },
          content: this._parseTextContent(element),
        }

      case 'p':
        return {
          type: 'paragraph',
          content: this._parseTextContent(element),
        }

      case 'ul':
        return {
          type: 'bulletList',
          content: Array.from(element.querySelectorAll('li')).map((li) => ({
            type: 'listItem',
            content: this._parseTextContent(li),
          })),
        }

      case 'ol':
        return {
          type: 'orderedList',
          content: Array.from(element.querySelectorAll('li')).map((li) => ({
            type: 'listItem',
            content: this._parseTextContent(li),
          })),
        }

      case 'blockquote':
        return {
          type: 'blockquote',
          content: this._parseHtmlToTiptapNodes(element),
        }

      case 'code':
      case 'pre':
        return {
          type: 'codeBlock',
          content: [{ type: 'text', text: element.textContent || '' }],
        }

      case 'img':
        return {
          type: 'image',
          attrs: {
            src: element.getAttribute('src') || '',
            alt: element.getAttribute('alt') || '',
          },
        }

      case 'hr':
        return {
          type: 'horizontalRule',
        }

      default:
        return null
    }
  },

  /**
   * 解析文本內容（帶標記）
   * Parse text content with marks
   */
  _parseTextContent(element: any): any[] {
    const content = []

    for (const child of element.childNodes) {
      if (child.nodeType === 3) {
        content.push({
          type: 'text',
          text: child.textContent,
        })
      } else if (child.nodeType === 1) {
        const tagName = child.tagName.toLowerCase()
        const text = child.textContent

        let marks = []
        switch (tagName) {
          case 'strong':
          case 'b':
            marks.push({ type: 'bold' })
            break
          case 'em':
          case 'i':
            marks.push({ type: 'italic' })
            break
          case 'u':
            marks.push({ type: 'underline' })
            break
          case 'del':
          case 's':
            marks.push({ type: 'strikethrough' })
            break
          case 'code':
            marks.push({ type: 'code' })
            break
          case 'a':
            marks.push({
              type: 'link',
              attrs: { href: child.getAttribute('href') || '' },
            })
            break
        }

        if (marks.length > 0) {
          content.push({
            type: 'text',
            text,
            marks,
          })
        } else {
          content.push({
            type: 'text',
            text,
          })
        }
      }
    }

    return content.length > 0 ? content : [{ type: 'text', text: '' }]
  },

  /**
   * 計算字符串相似度（Levenshtein 距離）
   * Calculate string similarity (Levenshtein distance)
   */
  _calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const editDistance = this._levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  },

  /**
   * Levenshtein 距離算法
   * Levenshtein distance algorithm
   */
  _levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  },

  /**
   * 轉義 HTML 特殊字元
   * Escape HTML special characters
   */
  _escape(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, (char) => map[char])
  },
}
