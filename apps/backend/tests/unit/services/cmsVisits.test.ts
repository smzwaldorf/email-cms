import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('#/lib/db', () => ({ query: m.query }))
import { cmsVisitMetrics, recordCmsVisit } from '#/services/cmsVisitService'
import type { AuthenticatedViewer } from '#/auth'
const viewer = { id: 'real-user', role: 'admin', roles: ['admin'], teacherClassIds: [], parentClassIds: [] } as AuthenticatedViewer
const body = { id: 'de900000-0000-4000-8000-000000000401', sessionId: 'de900000-0000-4000-8000-000000000501', path: '/admin/articles' }
beforeEach(() => { m.query.mockReset().mockResolvedValue({ rows: [{ visits: '4', visitors: '2' }] }) })
it('deduplicates event retries and ignores forged identity and attribution', async () => {
 await recordCmsVisit({ ...body, user_id: 'forged', newsletter_id: 'forged' }, viewer)
 expect(m.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (id) DO NOTHING'), [body.id, 'real-user', body.sessionId, JSON.stringify({ source: 'cms_route', path: body.path })])
})
it.each(['/week/2026-W41', '/article/123', '/auth/callback', '/admin?token=secret', '//evil'])('excludes reader and sensitive routes %s', async path => {
 await expect(recordCmsVisit({ ...body, path }, viewer)).rejects.toMatchObject({ status: 400 })
 expect(m.query).not.toHaveBeenCalled()
})
it('does not expose global management visits to teachers', async () => {
 await expect(cmsVisitMetrics({ ...viewer, role: 'teacher', roles: ['teacher'] })).rejects.toMatchObject({ status: 403 })
 expect(m.query).not.toHaveBeenCalled()
})
it('returns 30 day route visit counts separately from article analytics', async () => {
 expect(await cmsVisitMetrics(viewer)).toEqual({ visits: 4, visitors: 2 })
 expect(m.query.mock.calls[0][0]).toContain("metadata->>'source' = 'cms_route'")
})
