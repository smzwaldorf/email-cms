import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetWeek, mockGetArticlesByWeek, mockGetArticleWithNewsletter, mockFrom } = vi.hoisted(() => ({
  mockGetWeek: vi.fn(),
  mockGetArticlesByWeek: vi.fn(),
  mockGetArticleWithNewsletter: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('#/services/WeekService', () => ({
  default: { getWeek: mockGetWeek },
  WeekServiceError: class WeekServiceError extends Error {
    constructor(
      message: string,
      public code: string = 'WEEK_ERROR',
    ) {
      super(message)
      this.name = 'WeekServiceError'
    }
  },
}))

vi.mock('#/services/ArticleService', () => ({
  default: {
    getArticlesByWeek: mockGetArticlesByWeek,
    getArticleWithNewsletter: mockGetArticleWithNewsletter,
  },
  ArticleServiceError: class ArticleServiceError extends Error {
    constructor(
      message: string,
      public code: string = 'ARTICLE_ERROR',
    ) {
      super(message)
      this.name = 'ArticleServiceError'
    }
  },
}))

vi.mock('#/lib/supabase', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

import { HttpError } from '#/auth'
import { readerService } from '#/services/readerService'
import type { ArticleRow, NewsletterRow } from '#/types/database'

const publishedNewsletter: NewsletterRow = {
  id: 'nl-1',
  week_number: '2026-W01',
  release_date: '2026-01-05',
  status: 'published',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const draftNewsletter: NewsletterRow = {
  ...publishedNewsletter,
  status: 'draft',
}

const publicArticle: ArticleRow = {
  id: 'art-public',
  title: 'Public',
  content: 'Hello',
  status: 'published',
  visibility_type: 'public',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  short_id: 'pub1',
  deleted_at: null,
}

const restrictedArticle: ArticleRow = {
  ...publicArticle,
  id: 'art-restricted',
  title: 'Restricted',
  visibility_type: 'class_restricted',
  restricted_to_classes: ['A1'],
  short_id: 'rst1',
}

const draftArticle: ArticleRow = {
  ...publicArticle,
  id: 'art-draft',
  title: 'Draft',
  status: 'draft',
  short_id: 'drf1',
}

describe('readerService.getWeekBundle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns published newsletter articles visible to anonymous readers', async () => {
    mockGetWeek.mockResolvedValue(publishedNewsletter)
    mockGetArticlesByWeek.mockResolvedValue([publicArticle, restrictedArticle, draftArticle])

    const result = await readerService.getWeekBundle('2026-W01', null)

    expect(result.newsletter).toEqual(publishedNewsletter)
    expect(result.articles.map((article) => article.id)).toEqual(['art-public'])
  })

  it('hides draft newsletters from anonymous readers', async () => {
    mockGetWeek.mockResolvedValue(draftNewsletter)

    await expect(readerService.getWeekBundle('nl-1', null)).rejects.toMatchObject({
      name: 'HttpError',
      status: 404,
    })
  })

  it('includes class-restricted articles for a parent in that class', async () => {
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'family_enrollment') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ family_id: 'fam-1' }], error: null }),
          }),
        }
      }
      if (tableName === 'student_class_enrollment') {
        return {
          select: () => ({
            in: () => ({
              is: () => Promise.resolve({ data: [{ class_id: 'A1' }], error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${tableName}`)
    })
    mockGetWeek.mockResolvedValue(publishedNewsletter)
    mockGetArticlesByWeek.mockResolvedValue([publicArticle, restrictedArticle])

    const result = await readerService.getWeekBundle('nl-1', {
      id: 'parent-1',
      email: 'parent@example.com',
      role: 'parent', roles: ['parent'], teacherClassIds: [], parentClassIds: ['A1'],
    })

    expect(result.articles.map((article) => article.id)).toEqual(['art-public', 'art-restricted'])
  })

  it('lets admins see draft articles', async () => {
    mockGetWeek.mockResolvedValue(publishedNewsletter)
    mockGetArticlesByWeek.mockResolvedValue([publicArticle, draftArticle])

    const result = await readerService.getWeekBundle('nl-1', {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin', roles: ['admin'], teacherClassIds: [], parentClassIds: [],
    })

    expect(result.articles.map((article) => article.id)).toEqual(['art-public', 'art-draft'])
  })
})

describe('readerService.getReaderArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a published public article', async () => {
    mockGetArticleWithNewsletter.mockResolvedValue({
      ...publicArticle,
      newsletter_id: 'nl-1',
      week_number: '2026-W01',
    })

    const article = await readerService.getReaderArticle('art-public', 'nl-1', null)
    expect(article.id).toBe('art-public')
    expect(article.newsletter_id).toBe('nl-1')
  })

  it('returns 404 for a class-restricted article when the viewer has no access', async () => {
    mockGetArticleWithNewsletter.mockResolvedValue(restrictedArticle)

    await expect(readerService.getReaderArticle('art-restricted', 'nl-1', null)).rejects.toBeInstanceOf(
      HttpError,
    )
  })
})
