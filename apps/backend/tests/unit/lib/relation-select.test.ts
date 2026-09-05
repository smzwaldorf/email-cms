import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('#/lib/db', () => ({ query: mocks.query }))
import { from } from '#/lib/query'

describe('relation select projections', () => {
  beforeEach(() => mocks.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 }))
  it('keeps multi-column student and class embeds separate from base columns', async () => {
    const result = await from('student_class_enrollment')
      .select('student_id, students(name, is_active), classes(class_name, class_code, is_active)')
    expect(result.error).toBeNull()
    const sql = mocks.query.mock.calls[0][0]
    expect(sql).toContain('LEFT JOIN "students"')
    expect(sql).toContain('LEFT JOIN "classes"')
    expect(sql).toContain("'is_active', \"students\".\"is_active\"")
    expect(sql).toContain("'class_code', \"classes\".\"class_code\"")
  })
  it('retains explicit inner joins with multi-column projections', async () => {
    await from('newsletter_articles').select('article_order, articles!inner(title, content)')
    expect(mocks.query.mock.calls[0][0]).toContain('INNER JOIN "articles"')
  })
  it('rejects unbalanced relation projections before executing SQL', () => {
    expect(() => from('student_class_enrollment').select('students(name, is_active')).toThrow('Unbalanced')
    expect(mocks.query).not.toHaveBeenCalled()
  })
})
