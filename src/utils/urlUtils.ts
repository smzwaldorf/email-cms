/**
 * 網址工具函式 - 電子報閱讀 CMS
 */

/**
 * 生成文章的公開網址
 * @param articleId - 文章 ID
 * @returns 文章的完整網址
 */
export function generateArticleUrl(articleId: string): string {
  return `/article/${articleId}`
}

/**
 * 生成週報的網址
 * Uses /week route for week_number format (e.g., "2025-W42")
 * Uses /newsletter route for UUIDs (special editions)
 * @param weekNumberOrId - 週份 (例: "2025-W42") 或 newsletter UUID
 * @returns 週報的完整網址
 */
export function generateWeeklyUrl(weekNumberOrId: string): string {
  const isWeekNumber = /^\d{4}-W\d{2}$/.test(weekNumberOrId)
  return isWeekNumber ? `/week/${weekNumberOrId}` : `/newsletter/${weekNumberOrId}`
}

/**
 * 從網址提取文章 ID
 * @param url - 文章網址
 * @returns 文章 ID 或 null
 */
export function extractArticleIdFromUrl(url: string): string | null {
  const match = url.match(/\/article\/([^/?]+)/)
  return match?.[1] ?? null
}

/**
 * 從網址提取週份
 * @param url - 週報網址
 * @returns 週份 (ISO 8601 格式) 或 null
 */
export function extractWeekNumberFromUrl(url: string): string | null {
  const match = url.match(/\/week\/(\d{4}-W\d{2})/)
  return match?.[1] ?? null
}

/**
 * 驗證 ISO 8601 週份格式
 * @param weekNumber - 週份字符串
 * @returns 是否為有效格式
 */
export function isValidWeekNumber(weekNumber: string): boolean {
  return /^\d{4}-W\d{2}$/.test(weekNumber)
}

const ALLOWED_REDIRECT_PREFIXES = ['/week/', '/newsletter/', '/article/']

export function isSafeAppRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  return ALLOWED_REDIRECT_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function buildLoginRedirectPath(currentPathname: string, currentSearch = ''): string {
  const destination = `${currentPathname}${currentSearch}`
  const encoded = encodeURIComponent(destination)
  return `/login?redirect_to=${encoded}`
}
