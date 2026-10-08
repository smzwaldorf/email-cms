import { canAccessCmsPanel, canPerformCmsAction } from '@email-cms/shared'
import { HttpError, type AuthenticatedViewer } from '#/auth'
import { query } from '#/lib/db'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function recordCmsVisit(body: unknown, viewer: AuthenticatedViewer): Promise<void> {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid visit')
  const { id, sessionId, path } = body as Record<string, unknown>
  if (typeof id !== 'string' || !uuid.test(id) || typeof sessionId !== 'string' || !uuid.test(sessionId) ||
      typeof path !== 'string' || path.length > 200 || !/^\/(?:admin(?:\/[A-Za-z0-9_/-]*)?|editor\/[A-Za-z0-9_-]+)?$/.test(path)) throw new HttpError(400, 'Invalid visit')
  if (path !== '/' && !canAccessCmsPanel(viewer)) throw new HttpError(403, 'CMS permission required')
  // No attribution on management visits: they must never inflate newsletter reading metrics.
  await query(`INSERT INTO analytics_events (id, user_id, session_id, event_type, metadata)
    VALUES ($1, $2, $3, 'page_view', $4::jsonb) ON CONFLICT (id) DO NOTHING`,
    [id, viewer.id, sessionId, JSON.stringify({ source: 'cms_route', path })])
}

export async function cmsVisitMetrics(viewer: AuthenticatedViewer): Promise<{ visits: number; visitors: number }> {
  if (!canPerformCmsAction(viewer, 'cms:manage')) throw new HttpError(403, 'CMS management permission required')
  const { rows } = await query<{ visits: string; visitors: string }>(`SELECT count(*) AS visits, count(DISTINCT user_id) AS visitors
    FROM analytics_events WHERE event_type = 'page_view' AND metadata->>'source' = 'cms_route'
    AND created_at >= now() - interval '30 days'`)
  return { visits: Number(rows[0].visits), visitors: Number(rows[0].visitors) }
}
