import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedViewer, SmzDirectoryGraph } from '#/auth'
import type { PostgresClient } from '#/lib/supabase'
import { configureSupabaseClientOverride } from '#/lib/supabase'
import { currentDirectory, withIdentityDirectory } from '#/services/identityDirectory'
import { getAnalyticsClient, withTeacherAnalytics } from '#/services/teacherAnalyticsScope'
import { analyticsAggregator } from '#/services/analyticsAggregator'
import { teacherContentService } from '#/services/teacherContentService'

vi.mock('#/services/identityDirectory', async () => ({
  ...await vi.importActual<typeof import('#/services/identityDirectory')>('#/services/identityDirectory'),
  classAliases: async (directory: SmzDirectoryGraph) => directory.classes.flatMap(row => [{ id: row.id, authId: row.id }, { id: `legacy-${row.id}`, authId: row.id }]),
  personAliases: async (directory: SmzDirectoryGraph) => directory.people.map(row => ({ id: row.id, authId: row.id })),
}))

const directory: SmzDirectoryGraph = {
  classes: [{ id: 'A', code: 'A', displayName: 'Class A' }, { id: 'B', code: 'B', displayName: 'Class B' }],
  people: [
    { id: 'pA', kind: 'adult', displayName: 'Parent A' }, { id: 'pB', kind: 'adult', displayName: 'Parent B' },
    { id: 'sA', kind: 'student', displayName: 'Student A' }, { id: 'sB', kind: 'student', displayName: 'Sibling B' },
    { id: 'sC', kind: 'student', displayName: 'Student C' },
  ],
  families: [{ id: 'fA', code: 'FA', displayName: 'Family A' }, { id: 'fB', code: 'FB', displayName: 'Family B' }],
  familyMemberships: [
    { familyId: 'fA', personId: 'pA', relationship: 'guardian' }, { familyId: 'fA', personId: 'sA', relationship: 'child' },
    { familyId: 'fA', personId: 'sB', relationship: 'child' }, { familyId: 'fB', personId: 'pB', relationship: 'guardian' },
    { familyId: 'fB', personId: 'sC', relationship: 'child' },
  ],
  classMemberships: [
    { classId: 'A', personId: 'sA', relationship: 'student' }, { classId: 'B', personId: 'sB', relationship: 'student' },
    { classId: 'B', personId: 'sC', relationship: 'student' },
  ],
}
const teacher = { id: 't', roles: ['teacher', 'parent'], role: 'teacher', teacherClassIds: ['legacy-A'], parentClassIds: ['B'] } as AuthenticatedViewer
type Row = Record<string, any>
let tables: Record<string, Row[]>
let reads: string[]
function client(): PostgresClient {
  return { from(table: string) {
    reads.push(table)
    let rows = tables[table] ?? []
    let single = false
    const builder = {
      select: () => builder,
      eq(column: string, value: unknown) { rows = rows.filter(row => row[column] === value); return builder },
      is(column: string, value: unknown) { return builder.eq(column, value) },
      in(column: string, values: unknown[]) { rows = rows.filter(row => values.includes(row[column])); return builder },
      not(column: string, _op: string, value: unknown) { rows = rows.filter(row => row[column] !== value); return builder },
      order: () => builder, limit: () => builder,
      single() { single = true; return builder },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: single ? rows[0] : rows, error: null }).then(resolve) },
    }
    return builder
  } } as unknown as PostgresClient
}
const run = <T>(method: string, args: unknown[], callback: () => Promise<T>, viewer = teacher) =>
  withIdentityDirectory({ directory: async () => directory, contacts: async () => [] }, () => withTeacherAnalytics(viewer, method, args, callback))

beforeEach(() => {
  reads = []
  tables = {
    articles: [
      { id: 'aA', title: 'Article A', created_at: '2026-10-01', deleted_at: null, status: 'published', visibility_type: 'class_restricted', restricted_to_classes: ['legacy-A'] },
      { id: 'aB', title: 'Article B', created_at: '2026-10-01', deleted_at: null, status: 'published', visibility_type: 'class_restricted', restricted_to_classes: ['B'] },
    ],
    analytics_events: [
      { article_id: 'aA', newsletter_id: 'n1', user_id: 'pA', event_type: 'page_view', created_at: '2026-10-07', articles: { title: 'Article A', created_at: '2026-10-01' } },
      { article_id: 'aB', newsletter_id: 'n1', user_id: 'pA', event_type: 'page_view', articles: { title: 'Article B' } },
      { article_id: 'aA', newsletter_id: 'n1', user_id: 'pB', event_type: 'page_view', articles: { title: 'Article A' } },
    ],
    analytics_snapshots: [{ article_id: 'aA', newsletter_id: 'n1', metric_name: 'total_views', metric_value: 999 }],
  }
  configureSupabaseClientOverride(client)
})

describe('teacher analytics boundary', () => {
  it('resolves central class aliases and removes parent-only classes and siblings', async () => {
    const projected = await run('getAllClasses', [], currentDirectory)
    expect(projected.classes.map(row => row.id)).toEqual(['A'])
    expect(projected.people.map(row => row.id)).toEqual(['pA', 'sA'])
    expect(await run('getAllClasses', [], () => analyticsAggregator.getAllClasses())).toEqual(['Class A'])
  })
  it('rejects forged class filters and article drilldowns outside the taught classes', async () => {
    for (const [method, args] of [['getNewsletterMetrics', ['n1', 'Class B']], ['getClassHistory', ['Class B']], ['getArticleReaders', ['aB']], ['getArticleMetadata', ['aB']]] as const) {
      await expect(run(method, [...args], async () => true)).rejects.toMatchObject({ status: 403 })
    }
  })
  it('aggregates only allowed readers and articles, bypassing school-wide snapshots', async () => {
    const stats = await run('getArticleStatsWithFallback', ['n1'], () => analyticsAggregator.getArticleStatsWithFallback('n1'))
    expect(stats).toHaveLength(1)
    expect(stats[0]).toMatchObject({ id: 'aA', views: 1, uniqueViews: 1 })
    expect(reads).not.toContain('analytics_snapshots')
  })
  it('restricts class engagement and reader identities, including sibling names', async () => {
    const engagement = await run('getClassEngagement', ['n1'], () => analyticsAggregator.getClassEngagement('n1'))
    expect(engagement).toEqual([expect.objectContaining({ className: 'Class A', activeUsers: 1, totalUsers: 1 })])
    const readers = await run('getArticleReaders', ['aA'], () => analyticsAggregator.getArticleReaders('aA'))
    expect(readers).toEqual([expect.objectContaining({ userId: 'pA', className: ['Class A'], studentNames: ['Student A'] })])
  })
  it('filters delivery denominators and email events before aggregation', async () => {
    tables.newsletter_delivery_batch_recipients = [{ parent_id: 'pA' }, { parent_id: 'pB' }]
    tables.analytics_events = [{ user_id: 'pA', event_type: 'email_open' }, { user_id: 'pB', event_type: 'email_open' }]
    const data = await run('getNewsletterMetrics', ['n1'], async () => {
      const scoped = getAnalyticsClient()
      return [await scoped.from('newsletter_delivery_batch_recipients').select('*'), await scoped.from('analytics_events').select('*').eq('event_type', 'email_open')]
    })
    expect(data.map(row => row.data)).toEqual([[{ parent_id: 'pA' }], [{ user_id: 'pA', event_type: 'email_open' }]])
  })
  it('returns no analytics for an unassigned teacher and never changes an unscoped client', async () => {
    const viewer = { ...teacher, teacherClassIds: [] }
    expect(await run('getAllClasses', [], () => analyticsAggregator.getAllClasses(), viewer)).toEqual([])
    expect(await run('getArticleStats', ['n1'], () => analyticsAggregator.getArticleStats('n1'), viewer)).toEqual([])
    expect((await getAnalyticsClient().from('analytics_events').select('*')).data).toHaveLength(3)
  })
})

describe('teacher content views', () => {
  it('excludes newsletter templates from the list and direct detail requests', async () => {
    tables.newsletters = [{ id: 'n1', is_template: false }, { id: 'template', is_template: true }]
    expect(await teacherContentService.newsletters()).toEqual([{ id: 'n1', is_template: false }])
    await expect(teacherContentService.newsletter('template', teacher)).rejects.toMatchObject({ status: 404 })
  })
  it('includes assigned draft articles without exposing unassigned drafts or deleted content', async () => {
    tables.articles[0].status = 'draft'
    tables.articles[1].status = 'draft'
    tables.articles.push({ ...tables.articles[0], id: 'deleted', deleted_at: '2026-10-07' })
    expect((await teacherContentService.articles(teacher)).map(row => row.id)).toEqual(['aA'])
  })
  it('exposes newsletter-targeted public drafts only to teachers covering every placement', async () => {
    tables.articles = [{ ...tables.articles[0], status: 'draft', visibility_type: 'public', restricted_to_classes: null }]
    tables.newsletters = [{ id: 'n1', is_template: false }]
    tables.newsletter_articles = [{ newsletter_id: 'n1', article_id: 'aA', targeting_mode: 'targeted', target_class_ids: ['legacy-A'], article_order: 1 }]
    expect(await teacherContentService.articles(teacher)).toEqual([expect.objectContaining({ id: 'aA', teacher_edit_class_ids: ['legacy-A'] })])
    expect((await teacherContentService.newsletter('n1', teacher)).articles).toHaveLength(1)
    tables.newsletter_articles.push({ newsletter_id: 'n2', article_id: 'aA', targeting_mode: 'targeted', target_class_ids: ['B'], article_order: 1 })
    expect(await teacherContentService.articles(teacher)).toEqual([])
  })
})
