/**
 * 格式化工具函式 - 電子報閱讀 CMS
 */

/**
 * 格式化日期為 YYYY-MM-DD
 * @param dateString - ISO 日期字符串
 * @returns 格式化的日期字符串
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateString
  }
}

/**
 * 格式化相對時間 (例: "2 小時前")
 * @param dateString - ISO 日期字符串
 * @returns 相對時間字符串
 */
export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '剛剛'
    if (diffMins < 60) return `${diffMins} 分鐘前`
    if (diffHours < 24) return `${diffHours} 小時前`
    if (diffDays < 7) return `${diffDays} 天前`

    return formatDate(dateString)
  } catch {
    return dateString
  }
}

/**
 * 將 ISO 8601 週份轉換為顯示文字
 * @param weekNumber - 週份 (例: "2025-W42")
 * @returns 格式化的週份文字
 */
export function formatWeekNumber(weekNumber: string): string {
  const match = weekNumber.match(/(\d{4})-W(\d{2})/)
  if (!match) return weekNumber

  const year = match[1]
  const week = parseInt(match[2], 10)
  return `${year} 年第 ${week} 週`
}

/**
 * 截斷文本長度
 * @param text - 原始文本
 * @param maxLength - 最大長度
 * @param suffix - 尾部符號 (預設為 "...")
 * @returns 截斷後的文本
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - suffix.length) + suffix
}

/**
 * 格式化閱讀次數
 * @param count - 閱讀次數
 * @returns 格式化的閱讀次數
 */
export function formatViewCount(count: number | undefined): string {
  if (count === undefined || count === 0) return '無'
  if (count < 1000) return count.toString()
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`
  return `${(count / 1000000).toFixed(1)}M`
}
