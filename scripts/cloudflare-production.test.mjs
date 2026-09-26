import {test} from 'node:test'
import assert from 'node:assert/strict'
import {databaseName} from './cloudflare-database-name.mjs'
import {verifyDatabase} from './cloudflare-database-operation.mjs'
import {configuration} from './cloudflare-config.mjs'
test('production migrations refuse the staging database before any DDL', async()=>{
 const queries=[]
 const client={query:async sql=>{queries.push(sql); return {rows:[{name:'smz-cms'}]}}}
 await assert.rejects(verifyDatabase(client,{initialize:true,schema:'CREATE TABLE unsafe(id int)',expectedDatabase:databaseName({DEPLOYMENT_ENVIRONMENT:'production'})}),/Wrong logical database/)
 assert.equal(queries.length,1)
})
test('database environment mapping fails closed',()=>{
 assert.equal(databaseName({}),'smz-cms')
 assert.equal(databaseName({DEPLOYMENT_ENVIRONMENT:'production'}),'production-news')
 assert.throws(()=>databaseName({DEPLOYMENT_ENVIRONMENT:'typo'}))
})
test('production deployment can keep outbound delivery disabled',()=>{
 const c=configuration({DEPLOYMENT_ENVIRONMENT:'production',DELIVERY_ENABLED:'false',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_HYPERDRIVE_ID:'b'.repeat(32),CMS_ORIGIN:'https://news.smzwaldorf.com',CMS_API_ORIGIN:'https://news-api.smzwaldorf.com',SMZ_AUTH_ISSUER:'https://auth.smzwaldorf.com/api/auth'})
 assert.equal(c.vars.DELIVERY_ENABLED,'false')
 assert.equal(c.services[0].service,'production-smz-auth')
})
