/**
 * 內容轉換服務 - HTML 驗證與 Markdown 導出
 * Content Converter Service - HTML validation and Markdown export
 *
 * 該服務主要支援：
 * 1. Markdown 轉換為 HTML（用於導出）
 * 2. HTML 驗證和清理
 * 3. 文本提取
 *
 * Note: 富文本編輯器直接輸出 HTML，存儲在數據庫中，無需複雜的轉換
 */

import type { ConversionResult } from '@/types/editor'

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
export const contentConverter = {  /**
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

      // 移除 <p> 標籤在列表項中 / Remove <p> tags inside list items first
      markdown = markdown.replace(/<li[^>]*>\s*<p[^>]*>(.*?)<\/p>\s*<\/li>/gi, '<li>$1</li>')

      // 處理任務列表 / Handle task lists - mark them before removing tags
      // Important: wrap in <TASKLIST> markers to preserve list boundaries
      markdown = markdown.replace(/<ul[^>]*data-type="taskList"[^>]*>([\s\S]*?)<\/ul>/gi, (_match: string, content: string) => {
        // Replace task list items with checkbox markers
        // Handle both attribute orders and attribute presence/absence variations
        const processed = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_liMatch: string, liContent: string) => {
          // Check if this is a task item by looking for data-type="taskItem" in the original match
          if (!_liMatch.includes('data-type="taskItem"')) {
            return _liMatch // Not a task item, return as is
          }

          // Extract checked value from the li tag attributes
          const checkedMatch = _liMatch.match(/data-checked="([^"]*)"/i)
          const checked = checkedMatch ? checkedMatch[1] : 'false'

          // Remove label/checkbox HTML and extract text content from div/p structure
          let textContent = liContent
            .replace(/<label[^>]*>.*?<\/label>/gi, '')  // Remove label with checkbox
            .replace(/<div[^>]*>/gi, '')  // Remove opening div tags
            .replace(/<\/div>/gi, '')  // Remove closing div tags
            .replace(/<p[^>]*>/gi, '')  // Remove opening p tags
            .replace(/<\/p>/gi, '')  // Remove closing p tags
            .trim()
          const isChecked = checked === 'true'
          return `<TASKITEM>${isChecked ? '[x]' : '[ ]'} ${textContent}</TASKITEM>`
        })
        return `<TASKLIST>${processed}</TASKLIST>`
      })

      // 處理有序列表 / Handle ordered lists - mark them before removing tags
      markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match: string, content: string) => {
        // Replace li tags with ordered list markers
        let itemIndex = 1
        const processed = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_liMatch: string, liContent: string) => {
          return `<ORDEREDITEM>${itemIndex++}. ${liContent}</ORDEREDITEM>`
        })
        return processed
      })

      // 處理無序列表 / Handle unordered lists - mark them before removing tags
      markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match: string, content: string) => {
        // Replace li tags with bullet markers
        const processed = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_liMatch: string, liContent: string) => {
          return `<BULLETITEM>- ${liContent}</BULLETITEM>`
        })
        return processed
      })

      // 清理臨時標記 / Clean up temporary markers
      // Remove the markers; add newline if the next marker/char suggests we need one
      // Task items followed by another list item - keep them together
      markdown = markdown.replace(/<TASKITEM>([\s\S]*?)<\/TASKITEM>(?=<(?:TASKITEM|ORDEREDITEM|BULLETITEM)>)/g, '- $1\n')
      // Task items at the end or standalone
      markdown = markdown.replace(/<TASKITEM>([\s\S]*?)<\/TASKITEM>/g, '- $1')

      // Ordered items followed by another list item
      markdown = markdown.replace(/<ORDEREDITEM>([\s\S]*?)<\/ORDEREDITEM>(?=<(?:ORDEREDITEM|BULLETITEM|TASKITEM)>)/g, '$1\n')
      // Ordered items at the end
      markdown = markdown.replace(/<ORDEREDITEM>([\s\S]*?)<\/ORDEREDITEM>/g, '$1')

      // Bullet items followed by another list item
      markdown = markdown.replace(/<BULLETITEM>([\s\S]*?)<\/BULLETITEM>(?=<(?:ORDEREDITEM|BULLETITEM|TASKITEM)>)/g, '$1\n')
      // Bullet items at the end
      markdown = markdown.replace(/<BULLETITEM>([\s\S]*?)<\/BULLETITEM>/g, '$1')

      // 換行和段落 / Line breaks and paragraphs
      markdown = markdown.replace(/<br\s*\/?>/gi, '\n')

      // Ensure proper spacing between lists and paragraphs
      // </TASKLIST> followed by <p> needs separation
      markdown = markdown.replace(/<\/TASKLIST>\s*<p[^>]*>/gi, '\n\n')
      // Regular </ul> or </ol> followed by <p> also needs separation
      markdown = markdown.replace(/<\/(?:ul|ol)>\s*<p[^>]*>/gi, '\n\n')

      // Remove list markers
      markdown = markdown.replace(/<\/?(?:TASKLIST|BULLETLIST|ul|ol)[^>]*>/gi, '')

      markdown = markdown.replace(/<p[^>]*>/gi, '')
      markdown = markdown.replace(/<\/p>/gi, '\n\n')

      // 移除其他 HTML 標籤 / Remove other HTML tags
      markdown = markdown.replace(/<[^>]+>/g, '')

      // 清理空白 / Clean whitespace
      // Collapse multiple newlines that aren't between list items into double newlines
      markdown = markdown.replace(/\n{3,}/g, '\n\n')
      markdown = markdown.trim()

      return markdown
    } catch (error) {
      console.error('HTML to Markdown conversion error:', error)
      return html
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

}
