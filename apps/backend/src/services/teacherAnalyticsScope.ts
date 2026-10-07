import { AsyncLocalStorage } from 'node:async_hooks'
import { HttpError, type AuthenticatedViewer, type SmzDirectoryGraph } from '#/auth'
import { getSupabaseClient, type PostgresClient } from '#/lib/supabase'
import { classAliases, currentDirectory, identityContext, personAliases, withIdentityDirectory } from './identityDirectory'
import { directoryAudience } from './directoryAudience'
import { teacherCanReadArticle } from './teacherContentService'

interface AnalyticsScope { userIds: string[]; articleIds: string[] }
const scope = new AsyncLocalStorage<AnalyticsScope>()
export const hasTeacherAnalyticsScope = () => scope.getStore() !== undefined
export function teacherAnalyticsIncludesArticle(articleId: string | null | undefined): boolean {
  const activeScope = scope.getStore()
  return !activeScope || (typeof articleId === 'string' && activeScope.articleIds.includes(articleId))
}

/** Remove unrelated children, classes and families, including a teacher's parent-only classes. */
export function teacherAnalyticsDirectory(directory: SmzDirectoryGraph, classIds: readonly string[]): SmzDirectoryGraph {
  const classes = directory.classes.filter(row => classIds.includes(row.id))
  const allowedClasses = new Set(classes.map(row => row.id))
  const classMemberships = directory.classMemberships.filter(row => allowedClasses.has(row.classId))
  const students = new Set(classMemberships.filter(row => row.relationship === 'student').map(row => row.personId))
  const families = new Set(directory.familyMemberships.filter(row => row.relationship === 'child' && students.has(row.personId)).map(row => row.familyId))
  const familyMemberships = directory.familyMemberships.filter(row => families.has(row.familyId) && (row.relationship !== 'child' || students.has(row.personId)))
  const people = new Set([...familyMemberships.map(row => row.personId), ...classMemberships.map(row => row.personId)])
  return { classes, classMemberships, familyMemberships,
    families: directory.families.filter(row => families.has(row.id)),
    people: directory.people.filter(row => people.has(row.id)) }
}

export async function withTeacherAnalytics<T>(viewer: AuthenticatedViewer, method: string, args: unknown[], run: () => Promise<T>): Promise<T> {
  const directory = await currentDirectory()
  const aliases = await classAliases(directory)
  const classIds = aliases.filter(row => viewer.teacherClassIds.includes(row.id)).map(row => row.authId)
  const projected = teacherAnalyticsDirectory(directory, classIds)
  const className = ['getNewsletterMetrics', 'getTrendStats'].includes(method) ? args[1]
    : ['getClassHistory', 'getUsersInClass'].includes(method) ? args[0] : undefined
  if (className && !projected.classes.some(row => row.displayName === className)) {
    throw new HttpError(403, 'Analytics is limited to your assigned classes')
  }
  const audience = directoryAudience(projected)
  const userIds = (await personAliases(projected)).filter(row => audience.has(row.authId)).map(row => row.id)
  const { data: articles, error } = await getSupabaseClient().from('articles').select('*').is('deleted_at', null)
  if (error) throw new HttpError(503, 'Analytics article scope unavailable')
  const articleIds = (articles ?? []).filter(article => teacherCanReadArticle({ ...viewer, parentClassIds: [] }, article)).map(row => row.id)
  if (['getArticleMetadata', 'getArticleReaders'].includes(method) && (!classIds.length || !articleIds.includes(String(args[0])))) {
    throw new HttpError(403, 'Article analytics is outside your assigned classes')
  }
  const identity = identityContext()
  return withIdentityDirectory({ ...identity, directory: async () => projected }, () => scope.run({ userIds, articleIds }, run))
}

/** Filter before aggregation; empty assignments deliberately produce an empty IN filter. */
export function getAnalyticsClient(): PostgresClient {
  const client = getSupabaseClient()
  const activeScope = scope.getStore()
  if (!activeScope) return client
  return { ...client, from: ((table: string) => {
    const query = client.from(table)
    if (table === 'analytics_events') {
      query.in('user_id', activeScope.userIds)
      // Email-level events have no article; reader events must also be in scope.
      const eq = query.eq.bind(query)
      query.eq = ((column: string, value: unknown) => {
        if (column === 'event_type' && ['page_view', 'session_end', 'link_click'].includes(String(value))) query.in('article_id', activeScope.articleIds)
        return eq(column, value)
      }) as typeof query.eq
    }
    if (table === 'newsletter_delivery_batch_recipients') query.in('parent_id', activeScope.userIds)
    if (table === 'articles') query.in('id', activeScope.articleIds)
    if (table === 'newsletters') query.eq('is_template', false)
    return query
  }) as PostgresClient['from'] }
}
