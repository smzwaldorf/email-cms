import { beforeEach, describe, expect, it, vi } from 'vitest'
import { countArticlesForFamily, getArticlesForClass, getArticlesForFamily } from '@/services/queries/classArticleQueries'

type QueryResolver<T> = (value: { data: T; error: null }) => unknown

const mockTableBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
  then: vi.fn(),
}

const mockNewsletterBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  then: vi.fn(),
}

const mockSupabase = {
  from: vi.fn(() => mockNewsletterBuilder),
}

vi.mock('@/lib/supabase', () => ({
  table: vi.fn(() => mockTableBuilder),
  getSupabaseClient: vi.fn(() => mockSupabase),
}))

describe('classArticleQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTableBuilder.then.mockReset()
    mockNewsletterBuilder.then.mockReset()
  })

  it('includes shared articles, excludes unmatched targeted, preserves order', async () => {
    mockTableBuilder.then
      .mockImplementationOnce((resolve: QueryResolver<{ id: string; is_active: boolean }>) => resolve({ data: { id: 'family-1', is_active: true }, error: null }))
      .mockImplementationOnce((resolve: QueryResolver<Array<{ class_id: string; student_id: string }>>) => resolve({ data: [{ class_id: 'A1', student_id: 'student-1' }], error: null }))
      .mockImplementationOnce((resolve: QueryResolver<Array<{ id: string }>>) => resolve({ data: [{ id: 'student-1' }], error: null }))
      .mockImplementationOnce((resolve: QueryResolver<Array<{ id: string; class_name: string; class_grade_year: number }>>) => resolve({ data: [{ id: 'A1', class_name: 'A1', class_grade_year: 1 }], error: null }))

    mockNewsletterBuilder.then.mockImplementationOnce((resolve: QueryResolver<Array<Record<string, unknown>>>) =>
      resolve({
        data: [
          {
            article_order: 1,
            targeting_mode: 'shared',
            target_class_ids: [],
            articles: { id: 'shared-1', status: 'published', deleted_at: null, visibility_type: 'public' },
          },
          {
            article_order: 2,
            targeting_mode: 'targeted',
            target_class_ids: ['B1'],
            articles: { id: 'targeted-b1', status: 'published', deleted_at: null, visibility_type: 'public' },
          },
          {
            article_order: 3,
            targeting_mode: 'targeted',
            target_class_ids: ['A1'],
            articles: { id: 'targeted-a1', status: 'published', deleted_at: null, visibility_type: 'public' },
          },
        ],
        error: null,
      })
    )

    const result = await getArticlesForFamily('family-1', 'newsletter-1')
    expect(result.articles.map((a) => a.id)).toEqual(['shared-1', 'targeted-a1'])
  })

  it('returns shared and matched targeted articles for class query', async () => {
    mockNewsletterBuilder.then.mockImplementationOnce((resolve: QueryResolver<Array<Record<string, unknown>>>) =>
      resolve({
        data: [
          {
            article_order: 1,
            targeting_mode: 'targeted',
            target_class_ids: ['A1'],
            articles: { id: 'a1', status: 'published', deleted_at: null, visibility_type: 'public' },
          },
          {
            article_order: 2,
            targeting_mode: 'targeted',
            target_class_ids: ['B1'],
            articles: { id: 'b1', status: 'published', deleted_at: null, visibility_type: 'public' },
          },
          {
            article_order: 3,
            targeting_mode: 'shared',
            target_class_ids: [],
            articles: { id: 'shared', status: 'published', deleted_at: null, visibility_type: 'public' },
          },
        ],
        error: null,
      })
    )

    const result = await getArticlesForClass('A1', 'newsletter-1')
    expect(result.map((a) => a.id)).toEqual(['a1', 'shared'])
  })

  it('countArticlesForFamily reflects filtered article count', async () => {
    mockTableBuilder.then
      .mockImplementationOnce((resolve: QueryResolver<{ id: string; is_active: boolean }>) => resolve({ data: { id: 'family-1', is_active: true }, error: null }))
      .mockImplementationOnce((resolve: QueryResolver<Array<{ class_id: string; student_id: string }>>) => resolve({ data: [{ class_id: 'A1', student_id: 'student-1' }], error: null }))
      .mockImplementationOnce((resolve: QueryResolver<Array<{ id: string }>>) => resolve({ data: [{ id: 'student-1' }], error: null }))
      .mockImplementationOnce((resolve: QueryResolver<Array<{ id: string; class_name: string; class_grade_year: number }>>) => resolve({ data: [{ id: 'A1', class_name: 'A1', class_grade_year: 1 }], error: null }))
    mockNewsletterBuilder.then.mockImplementationOnce((resolve: QueryResolver<Array<Record<string, unknown>>>) =>
      resolve({
        data: [
          {
            article_order: 1,
            targeting_mode: 'shared',
            target_class_ids: [],
            articles: { id: 'shared-1', status: 'published', deleted_at: null, visibility_type: 'public' },
          },
          {
            article_order: 2,
            targeting_mode: 'targeted',
            target_class_ids: ['A1'],
            articles: { id: 'targeted-a1', status: 'published', deleted_at: null, visibility_type: 'public' },
          },
        ],
        error: null,
      })
    )

    const count = await countArticlesForFamily('family-1', 'newsletter-1')
    expect(count).toBe(2)
  })
})
