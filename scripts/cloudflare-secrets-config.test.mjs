import {test} from 'node:test'
import assert from 'node:assert/strict'
import {secretConfiguration} from './cloudflare-secrets-config.mjs'
const valid={CMS_SESSION_SECRET:'a'.repeat(64),CMS_OIDC_CLIENT_SECRET:'b'.repeat(32),RESEND_API_KEY:'re_fixture',RESEND_FROM_EMAIL:'Demo <newsletter@school.test>',JWT_SECRET:'c'.repeat(64)}
test('requires all runtime email/tracking secrets before provisioning',()=>{for(const key of Object.keys(valid)){assert.throws(()=>secretConfiguration({...valid,[key]:''}),undefined,key)};assert.deepEqual(secretConfiguration(valid),valid)})
test('rejects session key reuse and sender header injection',()=>{assert.throws(()=>secretConfiguration({...valid,JWT_SECRET:valid.CMS_SESSION_SECRET}),/separate/);assert.throws(()=>secretConfiguration({...valid,RESEND_FROM_EMAIL:'x@school.test\r\nBcc: y@school.test'}),/Configure RESEND/)})
