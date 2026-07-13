import { describe, expect, it } from 'vitest'

import {
  buildFallbackArticleImageUrl,
  extractFirstArticleImageUrl,
  formatArticleDisplayDate,
  mondayOfIsoWeek,
} from '@/services/articleEmailPresentation'

describe('extractFirstArticleImageUrl', () => {
  it('extracts the first <img> src from HTML content', () => {
    const html =
      '<p>Intro</p><img alt="hero" src="https://cdn.example.com/a.jpg" /><img src="https://cdn.example.com/b.jpg" />'
    expect(extractFirstArticleImageUrl(html)).toBe('https://cdn.example.com/a.jpg')
  })

  it('keeps storage:// URLs intact for later signing', () => {
    const html = '<img src="storage://media/user-1/photo.webp">'
    expect(extractFirstArticleImageUrl(html)).toBe('storage://media/user-1/photo.webp')
  })

  it('extracts markdown image syntax from legacy content', () => {
    const markdown = '# Title\n\n![alt text](https://cdn.example.com/md.png "caption")\n\nBody'
    expect(extractFirstArticleImageUrl(markdown)).toBe('https://cdn.example.com/md.png')
  })

  it('returns null when the content has no image', () => {
    expect(extractFirstArticleImageUrl('<p>text only</p>')).toBeNull()
    expect(extractFirstArticleImageUrl('')).toBeNull()
    expect(extractFirstArticleImageUrl(null)).toBeNull()
  })
})

describe('buildFallbackArticleImageUrl', () => {
  it('builds the placeholder URL from the public app base URL', () => {
    expect(buildFallbackArticleImageUrl('https://news.example.com/')).toBe(
      'https://news.example.com/email/article-placeholder.jpg',
    )
  })
})

describe('formatArticleDisplayDate', () => {
  it('uses the Monday of the ISO week for weekly newsletters', () => {
    // ISO week 2025-W38 starts Monday 2025-09-15.
    expect(mondayOfIsoWeek('2025-W38')?.toISOString().slice(0, 10)).toBe('2025-09-15')
    expect(formatArticleDisplayDate({ weekNumber: '2025-W38' })).toBe('Monday September 2025')
  })

  it('falls back to the article timestamp for special editions', () => {
    expect(
      formatArticleDisplayDate({ weekNumber: null, articleTimestamp: '2025-12-03T10:00:00.000Z' }),
    ).toBe('Wednesday December 2025')
  })

  it('ignores malformed week numbers and uses the timestamp instead', () => {
    expect(
      formatArticleDisplayDate({ weekNumber: 'not-a-week', articleTimestamp: '2026-01-05T08:00:00.000Z' }),
    ).toBe('Monday January 2026')
  })
})
