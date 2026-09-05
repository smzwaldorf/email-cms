/** In-memory persistence fixture. Production service code executes unchanged above this boundary. */
export type Row = Record<string, unknown>
export function createCmsMemoryStore() {
  const tables: Record<string, Row[]> = {}
  let sequence = 0
  const rows = (name: string) => tables[name] ??= []
  function from(name: string) {
    let predicates: Array<(row: Row) => boolean> = []
    let mutation: { kind: string; data: unknown } | null = null
    let singular = false
    let max = Infinity
    let selection = '*'
    const api = {
      select(value = '*') { selection = value; return api },
      eq(key: string, value: unknown) { predicates.push(row => row[key] === value); return api },
      neq(key: string, value: unknown) { predicates.push(row => row[key] !== value); return api },
      in(key: string, value: unknown[]) { predicates.push(row => value.includes(row[key])); return api },
      is(key: string, value: unknown) { predicates.push(row => (row[key] ?? null) === value); return api },
      not(key: string, _op: string, value: unknown) { predicates.push(row => (row[key] ?? null) !== value); return api },
      lte() { return api }, gte() { return api }, order() { return api },
      limit(value: number) { max = value; return api },
      insert(data: unknown) { mutation = { kind: 'insert', data }; return api },
      update(data: unknown) { mutation = { kind: 'update', data }; return api },
      single() { singular = true; return api }, maybeSingle() { singular = true; return api },
      then(resolve: (value: { data: unknown; error: { message: string } | null; count: number }) => unknown) {
        let result = rows(name).filter(row => predicates.every(predicate => predicate(row))).slice(0, max)
        if (mutation?.kind === 'insert') {
          if (name === 'email_platform_webhook_events' && rows(name).some(row => row.delivery_key === (mutation!.data as Row).delivery_key)) {
            return Promise.resolve(resolve({ data: null, error: { message: 'duplicate key' }, count: 0 }))
          }
          result = (Array.isArray(mutation.data) ? mutation.data : [mutation.data]).map(value => ({
            id: `fixture-${++sequence}`, created_at: '2026-09-05T00:00:00Z', updated_at: '2026-09-05T00:00:00Z',
            attempts: 0, max_attempts: 3, ...value as Row,
          }))
          rows(name).push(...result)
        }
        if (mutation?.kind === 'update') result.forEach(row => Object.assign(row, mutation?.data))
        const decorated = result.map(row => {
          if (name === 'newsletters' && selection.includes('newsletter_articles')) return { ...row, newsletter_articles: [{ count: rows('newsletter_articles').filter(item => item.newsletter_id === row.id).length }] }
          if (name === 'newsletter_articles' && selection.includes('articles')) return { ...row, articles: rows('articles').find(item => item.id === row.article_id) }
          if (name === 'student_class_enrollment') return { ...row, students: { name: 'Fixture Student', is_active: true }, classes: rows('classes').find(item => item.id === row.class_id) }
          return { ...row }
        })
        return Promise.resolve(resolve({ data: singular ? decorated[0] ?? null : decorated, error: null, count: decorated.length }))
      },
    }
    return api
  }
  function seed() {
    for (const key of Object.keys(tables)) delete tables[key]
    rows('newsletters').push({ id: 'n1', title: 'Fixture Newsletter', status: 'draft', is_template: false, release_date: '2026-09-05', week_number: '2026-W36', updated_at: 'revision-1' })
    rows('articles').push({ id: 'a1', short_id: 'article-one', title: 'Class note', content: '<p>Original note</p>', status: 'published', deleted_at: null, visibility_type: 'class_restricted', restricted_to_classes: ['C6'] })
    rows('newsletter_articles').push({ newsletter_id: 'n1', article_id: 'a1', article_order: 1, targeting_mode: 'targeted', target_class_ids: ['C6'] })
    rows('classes').push({ id: 'C6', class_code: 'G6', class_name: 'Grade 6', is_active: true }, { id: 'C4', class_code: 'G4', class_name: 'Grade 4', is_active: true })
    rows('email_templates').push({ id: 'template', state: 'active', current_revision_id: 'template-v1' })
    rows('email_template_revisions').push({ id: 'template-v1', template_id: 'template', subject_template: '{{newsletter.title}}', body_template: '<p>Hello {{guardian.email}}</p>' })
    rows('families').push({ id: 'f1', is_active: true, newsletter_subscription_status: 'subscribed' }, { id: 'pending-family', is_active: true, newsletter_subscription_status: 'pending' })
    rows('family_enrollment').push({ family_id: 'f1', parent_id: 'p1' }, { family_id: 'pending-family', parent_id: 'p2' })
    rows('user_roles').push({ id: 'p1', email: 'parent@example.test' }, { id: 'p2', email: 'pending@example.test' })
    rows('student_class_enrollment').push({ family_id: 'f1', student_id: 's1', class_id: 'C6', graduated_at: null }, { family_id: 'pending-family', student_id: 's2', class_id: 'C6', graduated_at: null })
  }
  seed()
  return { tables, rows, from, seed }
}
