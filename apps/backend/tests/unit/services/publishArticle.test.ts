import { beforeEach, expect, it, vi } from 'vitest'
import type { AuthenticatedViewer } from '#/auth'
const execute = vi.hoisted(() => vi.fn())
vi.mock('#/lib/db', () => ({ withClient: (fn: (client: { query: typeof execute }) => unknown) => fn({ query: execute }) }))
import { cmsArticleService } from '#/services/cmsArticleService'
beforeEach(() => execute.mockReset().mockResolvedValue({ rows: [{ id: 'a1', status: 'published' }] }))
it('publishes one active article as admin', async () => {
 expect(await cmsArticleService.publish('a1', { id: 'admin1', roles: ['admin'] } as AuthenticatedViewer)).toMatchObject({ id: 'a1', status: 'published' })
 expect(execute).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1 AND deleted_at IS NULL'), ['a1', 'admin1'])
 expect(execute.mock.calls[0][0]).not.toContain('is_template')
})
it.each(['parent', 'teacher'])('rejects %s publication before writing', async role => {
 await expect(cmsArticleService.publish('a1', { roles: [role] } as AuthenticatedViewer)).rejects.toMatchObject({ status: 403 })
 expect(execute).not.toHaveBeenCalled()
})
it('rejects absent or deleted articles', async () => {
 execute.mockResolvedValue({ rows: [] })
 await expect(cmsArticleService.publish('a1', { roles: ['admin'] } as AuthenticatedViewer)).rejects.toMatchObject({ status: 404 })
})
