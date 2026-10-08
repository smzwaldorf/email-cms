import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }))
vi.mock('#/lib/db', () => ({ withTransaction: m.transaction }))
import { copyArticle } from '#/services/articleCopyService'
import type { AuthenticatedViewer } from '#/auth'
const admin = { id: 'admin', role: 'admin', roles: ['admin'], teacherClassIds: [], parentClassIds: [] } as AuthenticatedViewer
const id = 'de900000-0000-4000-8000-000000000401'
beforeEach(() => {
  m.query.mockReset()
  m.transaction.mockReset().mockImplementation(fn => fn({ query: m.query }))
  m.query.mockResolvedValue({ rows: [] })
})
describe('standalone draft copies', () => {
  it('requires management permission before accessing data', async () => {
    await expect(copyArticle(id, false, { ...admin, role: 'teacher', roles: ['teacher'] })).rejects.toMatchObject({ status: 403 })
    expect(m.transaction).not.toHaveBeenCalled()
  })
  it('requires a live source in a template for template creation', async () => {
    m.query.mockResolvedValueOnce({ rows: [{ id }] })
    await expect(copyArticle(id, true, admin)).rejects.toMatchObject({ status: 400 })
    expect(m.query).toHaveBeenCalledTimes(2)
  })
  it('copies draft content, placement restrictions, media and taxonomy within one transaction', async () => {
    m.query.mockResolvedValueOnce({ rows: [{ id, class_ids: ['a'], restricted_to_classes: ['b'] }] })
      .mockResolvedValueOnce({ rows: [{ is_template: true, targeting_mode: 'targeted', target_class_ids: ['c'] }] })
      .mockResolvedValueOnce({ rows: [{ id: 'copy', status: 'draft' }] })
    expect(await copyArticle(id, true, admin)).toMatchObject({ id: 'copy', status: 'draft' })
    expect(m.query.mock.calls[2][0]).toContain("'draft'")
    expect(m.query.mock.calls[2][1]).toEqual([id, ['a', 'b', 'c'], 'admin', ['b', 'c']])
    expect(m.query.mock.calls.slice(3).map(call => call[0])).toEqual([
      expect.stringContaining('article_media_references'), expect.stringContaining('media_usage'),
      expect.stringContaining('article_category_assignments'), expect.stringContaining('article_tag_assignments')])
    expect(m.query.mock.calls.some(call => call[0].includes('INSERT INTO newsletter_articles'))).toBe(false)
  })
  it('propagates media copy failures to roll back the operation', async () => {
    m.query.mockResolvedValueOnce({ rows: [{ id }] }).mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'copy' }] }).mockRejectedValueOnce(new Error('media failure'))
    await expect(copyArticle(id, false, admin)).rejects.toThrow('media failure')
  })
})
