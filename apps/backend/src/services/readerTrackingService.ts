import { HttpError, type AuthenticatedViewer } from '#/auth'
import { getSupabaseClient } from '#/lib/supabase'
import { readerService } from '#/services/readerService'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export async function recordReaderEvent(body: unknown, viewer: AuthenticatedViewer): Promise<void> {
  if (!isRecord(body) || !['page_view', 'session_end'].includes(String(body.event_type)) ||
      ![body.article_id, body.newsletter_id, body.session_id].every(value => typeof value === 'string' && uuid.test(value))) {
    throw new HttpError(400, 'Invalid reader event')
  }
  const articleId = body.article_id as string
  const newsletterId = body.newsletter_id as string
  const metadata: Record<string, unknown> = { source: 'cms_reader' }
  const inputMetadata = isRecord(body.metadata) ? body.metadata : {}
  if (body.event_type === 'session_end') {
    const duration = inputMetadata.time_spent_seconds
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 3 || duration > 86400) {
      throw new HttpError(400, 'Invalid reading duration')
    }
    metadata.time_spent_seconds = Math.round(duration)
  }
  // Correlation is diagnostic only; never use browser-supplied data as identity or email engagement.
  const journey = inputMetadata.journey_correlation_id
  if (typeof journey === 'string' && uuid.test(journey)) metadata.journey_correlation_id = journey
  const bundle = await readerService.getWeekBundle(newsletterId, viewer)
  const article = bundle.articles.find(row => row.id === articleId)
  if (bundle.newsletter.status !== 'published' || !article || article.status !== 'published') {
    throw new HttpError(404, 'Published article not found in newsletter')
  }
  const { error } = await getSupabaseClient().from('analytics_events').insert({
    event_type: body.event_type as 'page_view' | 'session_end',
    user_id: viewer.id,
    article_id: articleId,
    newsletter_id: newsletterId,
    session_id: body.session_id as string,
    metadata,
  })
  if (error) throw new HttpError(500, 'Could not record reader event')
}

export async function getReaderReadArticles(newsletter: string | undefined, viewer: AuthenticatedViewer): Promise<string[]> {
  // The caller can only retrieve its own history, scoped to currently visible articles.
  if (!newsletter) return []
  const bundle = await readerService.getWeekBundle(newsletter, viewer)
  const visible = new Set(bundle.articles.map(article => article.id))
  const { data, error } = await getSupabaseClient().from('analytics_events').select('article_id')
    .eq('user_id', viewer.id).eq('newsletter_id', bundle.newsletter.id).eq('event_type', 'page_view')
  if (error) throw new HttpError(500, 'Could not load read articles')
  return [...new Set((data ?? []).map(row => row.article_id).filter((id): id is string => !!id && visible.has(id)))]
}
