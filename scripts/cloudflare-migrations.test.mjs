import { test } from 'node:test'
import assert from 'node:assert/strict'
import { additiveMigrationFiles, migrationFilesFor } from './cloudflare-database.mjs'
import { applyMigrations } from './cloudflare-migrations.mjs'
function fake(tables=[],changed=false){const log=[];let scans=0;return {log,query:async(sql)=>{log.push(sql);if(sql.startsWith('SELECT tablename'))return {rows:tables.map(tablename=>({tablename}))};if(sql.includes('AS digest'))return {rows:[{count:'1',digest:changed&&scans++?'changed':'same'}]};return {rows:[]}}}}
test('legacy retirement fails before DDL without explicit backup and review',async()=>{const c=fake(['families']);await assert.rejects(applyMigrations(c,[{name:'20260918_retire_identity_masters.sql',sql:'SELECT 1;'}]),/verified backup/);assert.equal(c.log.at(-1),'ROLLBACK');assert(!c.log.some(s=>s.startsWith('CREATE TABLE')))})
test('additive migrations coexist with legacy identity tables without retirement approval',async()=>{const c=fake(['families']);await applyMigrations(c,[{name:'20260920_identity_coexistence.sql',sql:'SELECT 1;'}]);assert.equal(c.log.at(-1),'COMMIT')})
test('production migration selection excludes identity retirement until its controls are supplied',()=>{
  assert.deepEqual(migrationFilesFor({}),additiveMigrationFiles)
  assert(migrationFilesFor({CMS_IDENTITY_RETIREMENT_APPROVED:'true'}).includes('20260918_retire_identity_masters.sql'))
  assert(migrationFilesFor({CMS_IDENTITY_BACKUP_REFERENCE:'backup-1'}).includes('20260918_retire_identity_masters.sql'))
})
test('migration wrappers cannot commit before historical preservation checks',async()=>{const c=fake(['articles'],true);await assert.rejects(applyMigrations(c,[{name:'test',sql:'BEGIN;\nSELECT 1;\nCOMMIT;'}]),/historical/);assert(!c.log.includes('COMMIT'));assert.equal(c.log.at(-1),'ROLLBACK');assert(c.log.some(s=>s.trim()==='SELECT 1;'))})
test('empty baseline receives migrations in a single commit',async()=>{const c=fake();await applyMigrations(c,[{name:'test',sql:'SELECT 1;'}]);assert.equal(c.log.filter(s=>s==='COMMIT').length,1)})
