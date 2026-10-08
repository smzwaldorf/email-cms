// Opt-in PostgreSQL integration check. All migration and fixture changes are rolled back.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import dotenv from 'dotenv'
import pg from 'pg'
dotenv.config({path:['.env.local','.env'],quiet:true})
const target = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost','127.0.0.1'].includes(target.hostname)) throw new Error('This check requires a localhost database')
const client = new pg.Client({connectionString:target.href})
await client.connect()
await client.query('BEGIN')
try {
 await client.query("SET LOCAL lock_timeout='5s'")
 const migration=readFileSync(new URL('../db/migrations/20261007_r2_article_media.sql',import.meta.url),'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm,'')
 await client.query(migration)
 await client.query(readFileSync(new URL('../db/migrations/20261007_email_media_serving.sql',import.meta.url),'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm,''))
 const owner=randomUUID(), image=randomUUID(), audio=randomUUID(), article=randomUUID(), copied=randomUUID()
 const path = id => `development/${owner}/${id}.png`
 for (const [id,type,mime,ext] of [[image,'image','image/png','png'],[audio,'audio','audio/mpeg','mp3']]) {
  await client.query(`INSERT INTO media_files(id,filename,file_type,mime_type,file_size,storage_path,storage_provider,public_url,uploaded_by,storage_bucket,storage_environment)
   VALUES ($1,$2,$3,$4,12,$5,'s3',$6,$7,'smz-cms-media-dev-staging','development')`,[id,`fixture.${ext}`,type,mime,path(id),`storage://media/${path(id)}`,owner])
 }
 const approvals = (await client.query('SELECT email_serving_enabled FROM media_files WHERE id=ANY($1::uuid[])',[[image,audio]])).rows
 assert.ok(approvals.every(row=>row.email_serving_enabled===false),'Uploaded assets default to restricted access')
 await client.query('UPDATE media_files SET email_serving_enabled=true WHERE id=$1',[image])
 await client.query('SAVEPOINT protected_email_media')
 await assert.rejects(client.query('DELETE FROM media_files WHERE id=$1',[image]),/Revoke public email access/)
 await client.query('ROLLBACK TO SAVEPOINT protected_email_media')
 await client.query('UPDATE media_files SET email_serving_enabled=false WHERE id=$1',[image])
 const html=`<img src="storage://media/${path(image)}" data-media-id="${image}"><img src="storage://media/${path(image)}"><div data-type="audio" data-src="storage://media/${path(audio)}" data-media-id="${audio}"></div>`
 const insert=async(id,content)=>client.query("INSERT INTO articles(id,title,content,status,short_id) VALUES ($1,'R2 transaction fixture',$2,'draft',$3)",[id,content,id.slice(0,10)])
 await insert(article,html)
 const refs=async id=>(await client.query('SELECT media_id,position FROM article_media_references WHERE article_id=$1 ORDER BY position',[id])).rows
 const usage=async id=>(await client.query("SELECT media_id,active FROM media_usage WHERE target_type='article' AND target_id=$1 ORDER BY media_id",[id])).rows
 const counts=async()=>(await client.query('SELECT id,usage_count,referenced_articles FROM media_files WHERE id=ANY($1::uuid[]) ORDER BY id',[[image,audio]])).rows
 assert.deepEqual((await refs(article)).map(r=>r.media_id),[image,audio])
 assert.ok((await usage(article)).every(r=>r.active));assert.equal((await usage(article)).length,2)
 assert.ok((await counts()).every(r=>r.usage_count===1 && r.referenced_articles.includes(article)))
 await client.query('UPDATE articles SET content=$2 WHERE id=$1',[article,html])
 assert.ok((await counts()).every(r=>r.usage_count===1),'Repeated saves must not inflate usage')
 await client.query('UPDATE articles SET content=$2 WHERE id=$1',[article,`<audio data-storage-src="storage://media/${path(audio)}"></audio>`])
 assert.deepEqual((await refs(article)).map(r=>r.media_id),[audio])
 assert.equal((await usage(article)).find(r=>r.media_id===image).active,false)
 assert.equal((await counts()).find(r=>r.id===image).usage_count,0)
 await client.query('UPDATE articles SET content=$2 WHERE id=$1',[article,html])
 assert.ok((await usage(article)).every(r=>r.active),'Undo/restore reactivates ledger')
 await insert(copied,html)
 assert.ok((await counts()).every(r=>r.usage_count===2),'Article copies reuse one object with two article references')
 await client.query('UPDATE articles SET deleted_at=now() WHERE id=$1',[article])
 assert.equal((await refs(article)).length,0);assert.ok((await usage(article)).every(r=>!r.active))
 assert.ok((await counts()).every(r=>r.usage_count===1))
 await client.query('UPDATE articles SET deleted_at=NULL WHERE id=$1',[article])
 assert.equal((await refs(article)).length,2)
 await client.query('SAVEPOINT rejected_media')
 await assert.rejects(client.query('UPDATE articles SET content=$2 WHERE id=$1',[article,'<img src="storage://media/development/missing.png">']),/unregistered media object/)
 await client.query('ROLLBACK TO SAVEPOINT rejected_media')
 assert.equal((await refs(article)).length,2,'Failed content saves preserve earlier media references')
 await client.query('UPDATE articles SET content=$2 WHERE id=$1',[article,`![image](storage://media/${path(image)})`])
 assert.deepEqual((await refs(article)).map(r=>r.media_id),[image],'Markdown delimiter is excluded from storage key')
 await client.query('UPDATE articles SET content=$2 WHERE id=$1',[article,JSON.stringify({type:'doc',content:[{type:'image',attrs:{src:`storage://media/${path(image)}`}}]})])
 assert.deepEqual((await refs(article)).map(r=>r.media_id),[image],'TipTap JSON content is supported')
 await client.query('DELETE FROM articles WHERE id=$1',[article])
 assert.ok((await usage(article)).every(r=>!r.active),'Hard deletion deactivates ledger')
 assert.ok((await counts()).every(r=>r.usage_count===1))
 console.info('PostgreSQL checks passed: image/audio links, duplicate saves, removal, restore, copy, soft/hard deletion, invalid media rollback, Markdown and JSON. All fixture and migration changes rolled back.')
} finally { await client.query('ROLLBACK'); await client.end() }
