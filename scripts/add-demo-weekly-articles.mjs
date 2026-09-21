import dotenv from 'dotenv'
import pg from 'pg'

import { buildDemoPlan } from './seed-demo.mjs'

const NEWSLETTER_ID = 'de900000-0000-4000-8000-000000000301'
const WEEKLY_TAG_ID = 'de900000-0000-4000-8000-000000000601'
const ARTICLE_IDS = [405, 406, 407, 408].map(
  (suffix) => `de900000-0000-4000-8000-${String(suffix).padStart(12, '0')}`,
)
const EXISTING_ARTICLE_IDS = [401, 402, 403, 404].map(
  (suffix) => `de900000-0000-4000-8000-${String(suffix).padStart(12, '0')}`,
)

function parseMode() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !['--check', '--apply'].includes(args[0])) {
    throw new Error('Usage: node scripts/add-demo-weekly-articles.mjs --check | --apply')
  }
  return args[0] === '--apply' ? 'apply' : 'check'
}

function rowsForUpgrade() {
  const plan = buildDemoPlan({})
  return {
    articles: plan.filter(
      (entry) => entry.table === 'public.articles' && ARTICLE_IDS.includes(entry.values.id),
    ),
    existingArticles: plan.filter(
      (entry) => entry.table === 'public.articles' && EXISTING_ARTICLE_IDS.includes(entry.values.id),
    ),
    links: plan.filter(
      (entry) =>
        entry.table === 'public.newsletter_articles' && ARTICLE_IDS.includes(entry.values.article_id),
    ),
  }
}

async function ensureExistingArticleImage(client, values) {
  const existing = await client.query('SELECT title, content FROM articles WHERE id = $1', [values.id])
  if (existing.rowCount !== 1) {
    throw new Error(`Expected existing demo article is missing: ${values.id}`)
  }
  if (existing.rows[0].title !== values.title) {
    throw new Error(`Article ID conflict: ${values.id}`)
  }
  if (/<img\b/i.test(existing.rows[0].content)) return 'existing'
  const image = values.content.match(/^<img[^>]+>/i)?.[0]
  if (!image) throw new Error(`Seed image is missing: ${values.id}`)
  await client.query('UPDATE articles SET content = $1, updated_at = now() WHERE id = $2', [
    `${image}${existing.rows[0].content}`,
    values.id,
  ])
  return 'inserted'
}

async function requireNewsletter(client) {
  const result = await client.query('SELECT id FROM newsletters WHERE id = $1', [NEWSLETTER_ID])
  if (result.rowCount !== 1) {
    throw new Error('Expected demo newsletter is missing')
  }
}

async function resolveWeeklyTag(client) {
  let result = await client.query(
    "SELECT id FROM article_tags WHERE lower(name) = 'weekly' AND is_active = true",
  )
  if (result.rowCount > 1) {
    throw new Error('Multiple active weekly tags found')
  }
  if (result.rowCount === 0) {
    result = await client.query(
      `INSERT INTO article_tags (id, name, description, is_active)
       VALUES ($1, 'weekly', 'Routes shared articles to the weekly summary section.', true)
       RETURNING id`,
      [WEEKLY_TAG_ID],
    )
  }
  return result.rows[0].id
}

async function ensureArticle(client, values) {
  const existing = await client.query('SELECT title FROM articles WHERE id = $1', [values.id])
  if (existing.rowCount === 1) {
    if (existing.rows[0].title !== values.title) {
      throw new Error(`Article ID conflict: ${values.id}`)
    }
    return 'existing'
  }
  await client.query(
    `INSERT INTO articles
      (id, short_id, title, content, status, author, visibility_type, restricted_to_classes, class_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      values.id,
      values.short_id,
      values.title,
      values.content,
      values.status,
      values.author,
      values.visibility_type,
      values.restricted_to_classes,
      values.class_ids,
    ],
  )
  return 'inserted'
}

async function ensureSharedBinding(client, values) {
  const existing = await client.query(
    `SELECT id, targeting_mode, target_class_ids
       FROM newsletter_articles
      WHERE newsletter_id = $1 AND article_id = $2`,
    [NEWSLETTER_ID, values.article_id],
  )
  if (existing.rowCount > 1) {
    throw new Error(`Duplicate newsletter binding: ${values.article_id}`)
  }
  if (existing.rowCount === 1) {
    const row = existing.rows[0]
    if (row.targeting_mode !== 'shared' || row.target_class_ids.length !== 0) {
      throw new Error(`Unexpected newsletter binding: ${values.article_id}`)
    }
    return 'existing'
  }
  await client.query(
    `INSERT INTO newsletter_articles
      (id, newsletter_id, article_id, article_order, targeting_mode, target_class_ids)
     VALUES ($1, $2, $3, $4, 'shared', $5)`,
    [values.id, NEWSLETTER_ID, values.article_id, values.article_order, []],
  )
  return 'inserted'
}

export async function addDemoWeeklyArticles(client, { apply }) {
  const { articles, existingArticles, links } = rowsForUpgrade()
  const summary = {
    articlesInserted: 0,
    bindingsInserted: 0,
    tagAssignmentsInserted: 0,
    existingArticleImagesAdded: 0,
  }

  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock(1936553061)')
    await requireNewsletter(client)
    const tagId = await resolveWeeklyTag(client)

    for (const article of existingArticles) {
      if ((await ensureExistingArticleImage(client, article.values)) === 'inserted') {
        summary.existingArticleImagesAdded += 1
      }
    }

    for (const article of articles) {
      if ((await ensureArticle(client, article.values)) === 'inserted') summary.articlesInserted += 1
      const link = links.find((entry) => entry.values.article_id === article.values.id)
      if (!link) throw new Error(`Seed link is missing: ${article.values.id}`)
      if ((await ensureSharedBinding(client, link.values)) === 'inserted') summary.bindingsInserted += 1
      const assignment = await client.query(
        `INSERT INTO article_tag_assignments (article_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT (article_id, tag_id) DO NOTHING`,
        [article.values.id, tagId],
      )
      summary.tagAssignmentsInserted += assignment.rowCount ?? 0
    }

    await client.query(apply ? 'COMMIT' : 'ROLLBACK')
    return { mode: apply ? 'applied' : 'checked-and-rolled-back', ...summary }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

const mode = parseMode()
dotenv.config({ path: ['.env.local', '.env'], quiet: true })
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required')
const target = new URL(process.env.DATABASE_URL)
if (process.env.DEMO_DATABASE_CONFIRM !== `${target.hostname}${target.pathname}`) {
  throw new Error('Set DEMO_DATABASE_CONFIRM to the exact database host/name (no credentials)')
}
const client = new pg.Client({ connectionString: target.href })
await client.connect()
try {
  console.log(JSON.stringify(await addDemoWeeklyArticles(client, { apply: mode === 'apply' })))
} finally {
  await client.end()
}
