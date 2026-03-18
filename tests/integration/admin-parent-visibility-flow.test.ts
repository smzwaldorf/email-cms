import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminService } from '@/services/adminService'
import { getArticlesForFamily } from '@/services/queries/classArticleQueries'

type MockClass = { id: string; class_name: string; class_grade_year: number }
type MockEnrollment = { family_id: string; class_id: string; graduated_at: string | null }
type MockNewsletterArticle = {
  newsletter_id: string
  article_id: string
  article_order: number
  targeting_mode: 'shared' | 'targeted'
  target_class_ids: string[]
  articles: {
    id: string
    status: 'draft' | 'published' | 'archived'
    deleted_at: string | null
    visibility_type: 'public' | 'class_restricted'
  }
}

const mockDb = vi.hoisted(() => ({
  classes: [] as MockClass[],
  childClassEnrollment: [] as MockEnrollment[],
  newsletterArticles: [] as MockNewsletterArticle[],
}))

function createMockBuilder(tableName: string) {
  const state: {
    eq: Array<{ field: string; value: unknown }>
    in: Array<{ field: string; values: unknown[] }>
    is: Array<{ field: string; value: unknown }>
    order?: { field: string; ascending: boolean }
    updatePayload?: Record<string, unknown>
    op: 'select' | 'update'
  } = {
    eq: [],
    in: [],
    is: [],
    op: 'select',
  }

  const builder: any = {
    select: vi.fn().mockImplementation(() => {
      state.op = 'select'
      return builder
    }),
    update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      state.op = 'update'
      state.updatePayload = payload
      return builder
    }),
    eq: vi.fn().mockImplementation((field: string, value: unknown) => {
      state.eq.push({ field, value })
      return builder
    }),
    in: vi.fn().mockImplementation((field: string, values: unknown[]) => {
      state.in.push({ field, values })
      return builder
    }),
    is: vi.fn().mockImplementation((field: string, value: unknown) => {
      state.is.push({ field, value })
      return builder
    }),
    order: vi.fn().mockImplementation((field: string, options?: { ascending?: boolean }) => {
      state.order = { field, ascending: options?.ascending ?? true }
      return builder
    }),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: any; error: any }) => unknown) => {
      let dataset: any[] = []
      if (tableName === 'classes') {
        dataset = [...mockDb.classes]
      } else if (tableName === 'child_class_enrollment') {
        dataset = [...mockDb.childClassEnrollment]
      } else if (tableName === 'newsletter_articles') {
        dataset = [...mockDb.newsletterArticles]
      }

      for (const filter of state.eq) {
        dataset = dataset.filter((row: any) => row[filter.field] === filter.value)
      }
      for (const filter of state.in) {
        dataset = dataset.filter((row: any) => filter.values.includes(row[filter.field]))
      }
      for (const filter of state.is) {
        dataset = dataset.filter((row: any) => row[filter.field] === filter.value)
      }
      if (state.order) {
        const { field, ascending } = state.order
        dataset.sort((a: any, b: any) => {
          if (a[field] === b[field]) return 0
          return ascending ? (a[field] > b[field] ? 1 : -1) : a[field] > b[field] ? -1 : 1
        })
      }

      if (state.op === 'update' && tableName === 'newsletter_articles' && state.updatePayload) {
        dataset.forEach((row: any) => {
          Object.assign(row, state.updatePayload)
        })
      }

      return resolve({ data: dataset, error: null })
    },
  }

  return builder
}

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn((tableName: string) => createMockBuilder(tableName)),
  })),
  table: vi.fn((tableName: string) => createMockBuilder(tableName)),
}))

describe('Admin control to parent visibility flow', () => {
  beforeEach(() => {
    mockDb.classes = [
      { id: 'A1', class_name: 'A1', class_grade_year: 1 },
      { id: 'B1', class_name: 'B1', class_grade_year: 1 },
    ]
    mockDb.childClassEnrollment = [
      { family_id: 'family-a1', class_id: 'A1', graduated_at: null },
      { family_id: 'family-b1', class_id: 'B1', graduated_at: null },
    ]
    mockDb.newsletterArticles = [
      {
        newsletter_id: 'newsletter-1',
        article_id: 'article-shared',
        article_order: 1,
        targeting_mode: 'shared',
        target_class_ids: [],
        articles: { id: 'article-shared', status: 'published', deleted_at: null, visibility_type: 'public' },
      },
      {
        newsletter_id: 'newsletter-1',
        article_id: 'article-target',
        article_order: 2,
        targeting_mode: 'shared',
        target_class_ids: [],
        articles: { id: 'article-target', status: 'published', deleted_at: null, visibility_type: 'public' },
      },
      {
        newsletter_id: 'newsletter-1',
        article_id: 'article-draft',
        article_order: 3,
        targeting_mode: 'shared',
        target_class_ids: [],
        articles: { id: 'article-draft', status: 'draft', deleted_at: null, visibility_type: 'public' },
      },
    ]
  })

  it('applies admin targeting and enforces parent visibility for published newsletter', async () => {
    await adminService.updateArticleTargetingInNewsletterById(
      'newsletter-1',
      'article-target',
      'targeted',
      ['A1']
    )

    const familyA1Result = await getArticlesForFamily('family-a1', 'newsletter-1')
    const familyB1Result = await getArticlesForFamily('family-b1', 'newsletter-1')

    expect(familyA1Result.articles.map((article) => article.id)).toEqual([
      'article-shared',
      'article-target',
    ])
    expect(familyB1Result.articles.map((article) => article.id)).toEqual(['article-shared'])
  })

  it('rejects invalid admin targeting selection before mutating visibility', async () => {
    await expect(
      adminService.updateArticleTargetingInNewsletterById('newsletter-1', 'article-target', 'targeted', [])
    ).rejects.toThrow('請至少選擇一個班級')
  })

  it('preserves newsletter-relative order after parent eligibility filtering', async () => {
    mockDb.newsletterArticles = [
      {
        newsletter_id: 'newsletter-1',
        article_id: 'article-1',
        article_order: 1,
        targeting_mode: 'shared',
        target_class_ids: [],
        articles: { id: 'article-1', status: 'published', deleted_at: null, visibility_type: 'public' },
      },
      {
        newsletter_id: 'newsletter-1',
        article_id: 'article-2',
        article_order: 2,
        targeting_mode: 'targeted',
        target_class_ids: ['B1'],
        articles: { id: 'article-2', status: 'published', deleted_at: null, visibility_type: 'public' },
      },
      {
        newsletter_id: 'newsletter-1',
        article_id: 'article-3',
        article_order: 3,
        targeting_mode: 'targeted',
        target_class_ids: ['A1'],
        articles: { id: 'article-3', status: 'published', deleted_at: null, visibility_type: 'public' },
      },
      {
        newsletter_id: 'newsletter-1',
        article_id: 'article-4',
        article_order: 4,
        targeting_mode: 'shared',
        target_class_ids: [],
        articles: { id: 'article-4', status: 'published', deleted_at: null, visibility_type: 'public' },
      },
    ]

    const result = await getArticlesForFamily('family-a1', 'newsletter-1')
    expect(result.articles.map((article) => article.id)).toEqual(['article-1', 'article-3', 'article-4'])
  })
})
