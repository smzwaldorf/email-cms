/**
 * 內容安全策略 (CSP) 標頭服務
 * Content Security Policy (CSP) Headers Service
 */

/**
 * CSP 策略配置
 * CSP policy configuration
 */
export interface CSPPolicy {
  directives: Record<string, string[]>
  reportUri?: string
  blockAllMixedContent?: boolean
  upgradeInsecureRequests?: boolean
}

/**
 * CSP 標頭配置
 * CSP header configuration
 */
export const CSP_DEVELOPMENT: CSPPolicy = {
  directives: {
    // 腳本源 - 允許內聯和信任的 CDN
    // Script sources - allow inline and trusted CDNs
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Allow for dev HMR
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
    ],

    // 樣式源
    // Style sources
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Tailwind CSS requires this
      'https://fonts.googleapis.com',
      'https://cdn.jsdelivr.net',
    ],

    // 字體源
    // Font sources
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
      'https://fonts.googleapis.com',
      'data:',
    ],

    // 圖片源
    // Image sources
    'img-src': [
      "'self'",
      'data:',
      'https:',
      'blob:',
    ],

    // 媒體源（音訊、影片）
    // Media sources (audio, video)
    'media-src': [
      "'self'",
      'https:',
      'blob:',
    ],

    // iframe 源
    // iframe sources
    'frame-src': [
      "'self'",
      'https://www.youtube.com',
    ],

    // 連接源（fetch, xhr, websocket）
    // Connect sources (fetch, xhr, websocket)
    'connect-src': [
      "'self'",
      'http://localhost:54321', // Supabase local dev
      'https://*.supabase.co',
      'https://api.github.com',
    ],

    // 默認源（後備）
    // Default source (fallback)
    'default-src': ["'self'"],

    // 基礎 URI - 限制 <base> 標籤
    // Base URI - restrict <base> tag
    'base-uri': ["'self'"],

    // 表單提交目標
    // Form submission targets
    'form-action': ["'self'"],

    // 框架祖先 - 防止被 iframe 嵌入
    // Frame ancestors - prevent being framed
    'frame-ancestors': ["'none'"],

    // 物件源
    // Object sources
    'object-src': ["'none'"],

    // 插件類型
    // Plugin types
    'plugin-types': [],
  },
}

/**
 * CSP 生產環境配置
 * CSP production configuration
 */
export const CSP_PRODUCTION: CSPPolicy = {
  directives: {
    // 更嚴格的生產配置
    // Stricter production configuration
    'script-src': [
      "'self'",
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
    ],

    'style-src': [
      "'self'",
      'https://fonts.googleapis.com',
      'https://cdn.jsdelivr.net',
    ],

    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
      'https://fonts.googleapis.com',
      'data:',
    ],

    'img-src': [
      "'self'",
      'data:',
      'https:',
      'blob:',
    ],

    'media-src': [
      "'self'",
      'https:',
      'blob:',
    ],

    'frame-src': [
      "'self'",
      'https://www.youtube.com',
    ],

    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'https://api.github.com',
    ],

    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'plugin-types': [],
  },
  upgradeInsecureRequests: true,
  blockAllMixedContent: true,
  reportUri: '/api/csp-report', // CSP 違規報告端點
}

/**
 * 將 CSP 策略轉換為標頭字符串
 * Convert CSP policy to header string
 */
export function buildCSPHeader(policy: CSPPolicy): string {
  const directives: string[] = []

  // 添加指令
  // Add directives
  for (const [key, values] of Object.entries(policy.directives)) {
    if (values.length > 0) {
      directives.push(`${key} ${values.join(' ')}`)
    }
  }

  // 添加升級不安全請求
  // Add upgrade insecure requests
  if (policy.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests')
  }

  // 添加阻止所有混合內容
  // Add block all mixed content
  if (policy.blockAllMixedContent) {
    directives.push('block-all-mixed-content')
  }

  // 添加報告 URI
  // Add report-uri
  if (policy.reportUri) {
    directives.push(`report-uri ${policy.reportUri}`)
  }

  return directives.join('; ')
}

/**
 * 取得 CSP 標頭配置
 * Get CSP header configuration
 */
export function getCSPHeaders(): Record<string, string> {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const policy = isDevelopment ? CSP_DEVELOPMENT : CSP_PRODUCTION

  const cspHeader = buildCSPHeader(policy)

  // 返回多個 CSP 相關標頭
  // Return multiple CSP-related headers
  return {
    'Content-Security-Policy': cspHeader,
    // 為不支援 CSP 的舊瀏覽器提供後備
    // Fallback for older browsers that don't support CSP
    'X-Content-Security-Policy': cspHeader,
    // 禁止 MIME 類型嗅探
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    // 防止點擊劫持
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    // 啟用 XSS 過濾
    // Enable XSS filter
    'X-XSS-Protection': '1; mode=block',
    // 引薦策略
    // Referrer policy
    'Referrer-Policy': 'strict-no-referrer',
    // 權限策略（特性策略）
    // Permissions Policy (Feature Policy)
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  }
}

/**
 * 驗證 CSP 違規報告
 * Validate CSP violation report
 */
export interface CSPViolationReport {
  'document-uri': string
  'violated-directive': string
  'effective-directive': string
  'original-policy': string
  'disposition': 'enforce' | 'report'
  'blocked-uri': string
  'status-code': number
  'source-file': string
  'line-number': number
  'column-number': number
}

/**
 * 記錄 CSP 違規
 * Log CSP violation
 */
export function logCSPViolation(report: Partial<CSPViolationReport>): void {
  const isDev = process.env.NODE_ENV === 'development'

  const message = `
CSP Violation:
  Document: ${report['document-uri']}
  Violated: ${report['violated-directive']}
  Blocked: ${report['blocked-uri']}
  Source: ${report['source-file']}:${report['line-number']}
  `

  if (isDev) {
    console.warn(`%c${message}`, 'color: orange; font-weight: bold')
  } else {
    console.warn(message)
  }

  // 可在此發送到監控服務
  // Could send to monitoring service here
}
