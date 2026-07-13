/**
 * Pure helpers that turn CMS article/newsletter data into presentation values
 * consumed by email templates (`article.image_url`, `article.date`, …).
 *
 * Kept dependency-free so the delivery service and tests can share them.
 */

const HTML_IMG_SRC_PATTERN = /<img[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/i
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(([^()\s]+)(?:\s+"[^"]*")?\)/

/**
 * Extract the first inline image URL from article content (TipTap HTML or
 * legacy markdown). Returns `null` when the article has no usable image.
 * `storage://` URLs are kept as-is; the preparation step signs them later.
 */
export function extractFirstArticleImageUrl(content: string | null | undefined): string | null {
  if (!content) {
    return null
  }
  const htmlMatch = content.match(HTML_IMG_SRC_PATTERN)
  if (htmlMatch?.[1]) {
    return htmlMatch[1]
  }
  const markdownMatch = content.match(MARKDOWN_IMAGE_PATTERN)
  if (markdownMatch?.[1]) {
    return markdownMatch[1]
  }
  return null
}

/** Default hero image served by the reader app for articles without inline images. */
export function buildFallbackArticleImageUrl(publicAppBaseUrl: string): string {
  return `${publicAppBaseUrl.replace(/\/+$/, '')}/email/article-placeholder.jpg`
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function formatDisplayDate(date: Date): string {
  return `${WEEKDAY_NAMES[date.getUTCDay()]} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** Monday of an ISO 8601 week, e.g. `2025-W43` → the Monday of week 43 (UTC). */
export function mondayOfIsoWeek(weekNumber: string): Date | null {
  const match = weekNumber.match(/^(\d{4})-W(\d{1,2})$/)
  if (!match) {
    return null
  }
  const year = Number.parseInt(match[1], 10)
  const week = Number.parseInt(match[2], 10)
  if (week < 1 || week > 53) {
    return null
  }
  // ISO week 1 always contains January 4th.
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4IsoDay = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay()
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4IsoDay - 1))
  const monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return monday
}

/**
 * Display date shown under weekly announcement items, matching the
 * "Monday September 2025" style of the newsletter design.
 *
 * Prefers the Monday of the newsletter's ISO week; falls back to the
 * article timestamp for special editions without a week number.
 */
export function formatArticleDisplayDate(options: {
  weekNumber?: string | null
  articleTimestamp?: string | null
}): string {
  if (options.weekNumber) {
    const monday = mondayOfIsoWeek(options.weekNumber)
    if (monday) {
      return formatDisplayDate(monday)
    }
  }
  if (options.articleTimestamp) {
    const parsed = new Date(options.articleTimestamp)
    if (!Number.isNaN(parsed.getTime())) {
      return formatDisplayDate(parsed)
    }
  }
  return formatDisplayDate(new Date())
}
