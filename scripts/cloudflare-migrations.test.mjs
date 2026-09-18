import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyMigrations } from './cloudflare-migrations.mjs'
function fake(tables=[],changed=false){const log=[];let scans=0;return {log,query:async(sql)=>{log.push(sql);if(sql.startsWith('SELECT tablename'))return {rows:tables.map(tablename=>({tablename}))};if(sql.includes('AS digest'))return {rows:[{count:'1',digest:changed&&scans++?'changed':'same'}]};return {rows:[]}}}}
test('legacy retirement fails before DDL without explicit backup and review',async()=>{const c=fake(['families']);await assert.rejects(applyMigrations(c,[]),/verified backup/);assert.equal(c.log.at(-1),'ROLLBACK');assert(!c.log.some(s=>s.startsWith('CREATE TABLE')))})
test('migration wrappers cannot commit before historical preservation checks',async()=>{const c=fake(['articles'],true);await assert.rejects(applyMigrations(c,[{name:'test',sql:'BEGIN;\nSELECT 1;\nCOMMIT;'}]),/historical/);assert(!c.log.includes('COMMIT'));assert.equal(c.log.at(-1),'ROLLBACK');assert(c.log.some(s=>s.trim()==='SELECT 1;'))})
test('empty baseline receives migrations in a single commit',async()=>{const c=fake();await applyMigrations(c,[{name:'test',sql:'SELECT 1;'}]);assert.equal(c.log.filter(s=>s==='COMMIT').length,1)})
