/**
 * HTML 清理與 XSS 防護服務
 * HTML Sanitization and XSS Protection Service
 */

import DOMPurify from 'dompurify'

/**
 * 白名單標籤配置
 * Whitelist tags configuration
 */
const ALLOWED_TAGS = [
  // 文字格式化 / Text formatting
  'b',
  'strong',
  'i',
  'em',
  'u',
  'del',
  's',
  'mark',
  'code',

  // 標題 / Headers
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',

  // 區塊元素 / Block elements
  'p',
  'br',
  'hr',
  'div',
  'blockquote',
  'pre',

  // 列表 / Lists
  'ul',
  'ol',
  'li',

  // 表格 / Tables
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',

  // 連結與媒體 / Links and media
  'a',
  'img',
  'video',
  'audio',
  'source',
  'iframe',

  // 容器 / Containers
  'figure',
  'figcaption',
]

/**
 * 白名單屬性配置
 * Whitelist attributes configuration
 */
const ALLOWED_ATTRIBUTES = {
  // 連結 / Links
  a: ['href', 'title', 'target', 'rel'],

  // 圖片 / Images
  img: ['src', 'alt', 'title', 'width', 'height', 'style'],

  // 音訊/影片 / Audio/Video
  audio: ['controls', 'style', 'data-media-id'],
  video: ['controls', 'width', 'height', 'style'],
  source: ['src', 'type'],

  // iframe / iFrame
  iframe: [
    'src',
    'width',
    'height',
    'style',
    'allowfullscreen',
    'allow',
    'data-youtube-id',
  ],

  // 容器 / Containers
  div: ['class', 'style'],
  p: ['class', 'style'],
  span: ['class', 'style'],

  // 所有元素 / All elements
  '*': [
    'class',
    'style',
    'data-*', // 允許 data 屬性 / Allow data attributes
  ],
}

/**
 * 自訂 DOMPurify 配置
 * Custom DOMPurify configuration
 */
const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: Object.values(ALLOWED_ATTRIBUTES).flat(),
  ALLOW_DATA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  DEFAULT_NAMESPACE: 'http://www.w3.org/1999/xhtml',
}

/**
 * HTML 清理結果
 * HTML sanitization result
 */
export interface SanitizationResult {
  html: string
  cleaned: boolean
  removedTags: string[]
  removedAttributes: string[]
  warnings: string[]
}

/**
 * HTML 清理服務
 * HTML Sanitization Service
 */
export const htmlSanitizer = {
  /**
   * 清理 HTML 內容
   * Sanitize HTML content
   */
  sanitize(html: string): SanitizationResult {
    const original = html

    // 使用 DOMPurify 清理
    // Use DOMPurify to clean
    let cleaned = DOMPurify.sanitize(html, PURIFY_CONFIG)

    // 移除危險的 data: URL 和其他協議
    // Remove dangerous data: URLs and other protocols from src/href attributes
    cleaned = cleaned.replace(/\s(src|href)="(data:|javascript:|vbscript:)[^"]*"/gi, (_match, attr) => {
      return ` ${attr}=""`
    })

    // 檢測是否進行了修改
    // Check if content was modified
    const wasModified = original !== cleaned

    // 檢測移除的標籤和屬性
    // Detect removed tags and attributes
    const removedTags: string[] = []
    const removedAttributes: string[] = []
    const warnings: string[] = []

    if (wasModified) {
      // 簡單檢測移除的標籤
      // Simple detection of removed tags
      const tagRegex = /<(\w+)[^>]*>/g
      const originalTags = new Set<string>()
      const cleanedTags = new Set<string>()

      let match
      while ((match = tagRegex.exec(original)) !== null) {
        originalTags.add(match[1].toLowerCase())
      }

      tagRegex.lastIndex = 0
      while ((match = tagRegex.exec(cleaned)) !== null) {
        cleanedTags.add(match[1].toLowerCase())
      }

      // 找出移除的標籤
      // Find removed tags
      originalTags.forEach((tag) => {
        if (!cleanedTags.has(tag)) {
          removedTags.push(tag)
        }
      })

      if (removedTags.length > 0) {
        warnings.push(
          `檔案含有可能不安全的標籤已被移除: ${removedTags.join(', ')} / Unsafe tags removed: ${removedTags.join(', ')}`
        )
      }
    }

    return {
      html: cleaned,
      cleaned: wasModified,
      removedTags,
      removedAttributes,
      warnings,
    }
  },

  /**
   * 清理純文本（轉義 HTML 特殊字元）
   * Sanitize plain text (escape HTML special chars)
   */
  sanitizeText(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }

    return text.replace(/[&<>"']/g, (char) => map[char])
  },

  /**
   * 檢查 HTML 是否安全（不含危險標籤）
   * Check if HTML is safe (no dangerous tags)
   */
  isSafe(html: string): boolean {
    const result = this.sanitize(html)
    return !result.cleaned // 如果未修改，則為安全的
  },

  /**
   * 取得 XSS 攻擊簽名
   * Get XSS attack signature (dangerous patterns)
   */
  detectXSSPatterns(html: string): string[] {
    const patterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // Event handlers
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /expression\s*\(/gi, // IE specific
      /vbscript:/gi,
      /data:text\/html/gi,
    ]

    const detected: string[] = []

    patterns.forEach((pattern) => {
      const matches = html.match(pattern)
      if (matches) {
        detected.push(...matches.map((m) => m.substring(0, 50)))
      }
    })

    return detected
  },

  /**
   * 清理特定標籤的屬性
   * Sanitize specific tag attributes
   */
  sanitizeTagAttributes(
    html: string,
    tagName: string,
    allowedAttrs: string[]
  ): string {
    const regex = new RegExp(
      `<${tagName}\\s+([^>]*)>`,
      'gi'
    )

    return html.replace(regex, (_match, attrs) => {
      // 解析現有屬性
      // Parse existing attributes
      const attrRegex = /(\w+)=["']([^"']*)["']/g
      let result = `<${tagName}`
      let attrMatch

      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        const [, attrName, attrValue] = attrMatch
        // 只保留白名單中的屬性
        // Only keep whitelisted attributes
        if (allowedAttrs.includes(attrName.toLowerCase())) {
          result += ` ${attrName}="${attrValue}"`
        }
      }

      result += '>'
      return result
    })
  },

  /**
   * 允許特定的 YouTube iframe
   * Allow specific YouTube iframe
   */
  allowYouTubeEmbed(html: string, videoId: string): string {
    const youtubeIframe = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`

    // 移除不安全的 iframe
    // Remove unsafe iframes
    let cleaned = html.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')

    // 新增允許的 YouTube iframe
    // Add allowed YouTube iframe
    cleaned += '\n' + youtubeIframe

    return cleaned
  },

  /**
   * 取得 DOMPurify 配置
   * Get DOMPurify configuration
   */
  getConfig() {
    return PURIFY_CONFIG
  },

  /**
   * 新增自訂鉤子以進行額外驗證
   * Add custom hooks for additional validation
   */
  addCustomHook(
    hookName: 'beforeSanitizeElements' | 'afterSanitizeElements',
    callback: (node: Element) => void
  ): void {
    DOMPurify.addHook(hookName, (node) => {
      callback(node as Element)
    })
  },

  /**
   * 移除自訂鉤子
   * Remove custom hooks
   */
  removeCustomHook(
    hookName: 'beforeSanitizeElements' | 'afterSanitizeElements'
  ): void {
    DOMPurify.removeHook(hookName)
  },
}

/**
 * 取得預定義的安全配置（對應不同內容類型）
 * Get predefined safe configurations (for different content types)
 */
export const sanitizationPresets = {
  /**
   * 嚴格模式 - 只允許基本文字格式
   * Strict mode - only basic text formatting
   */
  strict: {
    ALLOWED_TAGS: ['b', 'i', 'u', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  },

  /**
   * 標準模式 - 允許常見的富文本標籤
   * Standard mode - common rich text tags
   */
  standard: PURIFY_CONFIG,

  /**
   * 寬鬆模式 - 允許更多標籤（仍然安全）
   * Permissive mode - more tags allowed (still safe)
   */
  permissive: {
    ALLOWED_TAGS: [
      ...ALLOWED_TAGS,
      'section',
      'article',
      'aside',
      'header',
      'footer',
      'nav',
      'main',
    ],
    ALLOWED_ATTR: Object.values(ALLOWED_ATTRIBUTES).flat(),
    ALLOW_DATA_ATTR: true,
  },
}
