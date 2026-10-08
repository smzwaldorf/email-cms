// Run after npm run server:build. All fixtures and migrations roll back.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import dotenv from 'dotenv'
import pg from 'pg'
const require = createRequire(import.meta.url)
const { copyArticle } = require('../apps/backend/dist/services/articleCopyService.js')
const { recordCmsVisit, cmsVisitMetrics } = require('../apps/backend/dist/services/cmsVisitService.js')
const { withDatabasePool } = require('../apps/backend/dist/lib/db.js')
dotenv.config({ path: ['.env.local', '.env'], quiet: true })
const target = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw Error('Local database required')
const client = new pg.Client({ connectionString: target.href })
await client.connect()
await client.query('BEGIN')
try {
 await client.query("SET LOCAL lock_timeout = '5s'")
 await client.query(readFileSync(new URL('../db/migrations/20261007_r2_article_media.sql', import.meta.url), 'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm, ''))
 const owner = randomUUID(), source = randomUUID(), template = randomUUID(), image = randomUUID(), audio = randomUUID()
 const path = id => `development/${owner}/${id}.png`
 for (const [id, type, mime] of [[image, 'image', 'image/png'], [audio, 'audio', 'audio/mpeg']]) {
  await client.query(`INSERT INTO media_files(id,filename,file_type,mime_type,file_size,storage_path,storage_provider,public_url,uploaded_by,storage_bucket,storage_environment)
   VALUES ($1,'copy-fixture',$2,$3,12,$4,'s3',$5,$6,'smz-cms-media-dev-staging','development')`, [id, type, mime, path(id), `storage://media/${path(id)}`, owner])
 }
 const html = `<img src="storage://media/${path(image)}"><div data-type="audio" data-src="storage://media/${path(audio)}"></div><iframe src="https://www.youtube.com/embed/test"></iframe>`
 await client.query("INSERT INTO articles(id,title,content,status,short_id,author,summary) VALUES ($1,'Copy fixture',$2,'published',$3,'Author','Summary')", [source, html, source.slice(0,10)])
 await client.query("INSERT INTO newsletters(id,title,status,is_template,release_date) VALUES ($1,'Copy template','draft',true,CURRENT_DATE)", [template])
 await client.query("INSERT INTO newsletter_articles(newsletter_id,article_id,article_order,targeting_mode,target_class_ids) VALUES ($1,$2,1,'targeted',ARRAY['class-a'])", [template, source])
 // Service owns a transaction; map it to a savepoint inside the rollback-only test transaction.
 const connection = { query: (text, values) => client.query(text === 'BEGIN' ? 'SAVEPOINT copy_operation' : text === 'COMMIT' ? 'RELEASE SAVEPOINT copy_operation' : text === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT copy_operation' : text, values), release() {} }
 const pool = { connect: async () => connection, query: (text, values) => client.query(text, values) }
 const admin = { id: owner, role: 'admin', roles: ['admin'], teacherClassIds: [], parentClassIds: [] }
 const copied = await withDatabasePool(pool, () => copyArticle(source, true, admin))
 assert.equal(copied.content, html)
 assert.equal(copied.status, 'draft')
 assert.equal(copied.published_at, null)
 assert.equal(copied.week_number, null)
 assert.equal(copied.author, 'Author')
 assert.equal(copied.summary, 'Summary')
 assert.deepEqual(copied.restricted_to_classes, ['class-a'])
 assert.notEqual(copied.short_id, source.slice(0,10))
 assert.equal((await client.query('SELECT count(*) FROM newsletter_articles WHERE article_id=$1', [copied.id])).rows[0].count, '0')
 assert.equal((await client.query('SELECT count(*) FROM article_media_references WHERE article_id=$1', [copied.id])).rows[0].count, '2')
 assert.equal((await client.query("SELECT count(*) FROM media_usage WHERE target_type='article' AND target_id=$1 AND active", [copied.id])).rows[0].count, '2')
 assert.ok((await client.query('SELECT usage_count FROM media_files WHERE id=ANY($1::uuid[])', [[image,audio]])).rows.every(row => row.usage_count === 2))
 // A database failure after the article insert must leave no orphan draft.
 const failing = { ...connection, query(text, values) { if (text.includes('INSERT INTO article_tag_assignments')) return client.query('SELECT no_such_copy_fixture_column'); return connection.query(text, values) } }
 await assert.rejects(withDatabasePool({ connect: async () => failing }, () => copyArticle(source, false, admin)))
 assert.equal((await client.query("SELECT count(*) FROM articles WHERE title='Copy fixture'", [])).rows[0].count, '2')
 const visit = { id: randomUUID(), sessionId: randomUUID(), path: '/admin/articles' }
 const before = await withDatabasePool(pool, () => cmsVisitMetrics(admin))
 await withDatabasePool(pool, () => recordCmsVisit(visit, admin))
 await withDatabasePool(pool, () => recordCmsVisit(visit, admin))
 const after = await withDatabasePool(pool, () => cmsVisitMetrics(admin))
 assert.equal(after.visits, before.visits + 1)
 assert.equal(after.visitors, before.visitors + 1)
 assert.equal((await client.query('SELECT count(*) FROM analytics_events WHERE id=$1 AND newsletter_id IS NULL AND article_id IS NULL', [visit.id])).rows[0].count, '1')
 console.info('PostgreSQL visits passed: retry deduplication, signed-in visitor count and null reader attribution. All events rolled back.')
 console.info('PostgreSQL standalone copy passed: draft lifecycle, targeting, YouTube/image/audio content, trigger-safe media usage, and rollback after partial failure. All fixtures rolled back.')
} finally { await client.query('ROLLBACK'); await client.end() }
