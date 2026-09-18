import {beforeEach,describe,it,expect,vi} from 'vitest'
import {createCmsMemoryStore} from '../../helpers/cmsMemoryStore'
const h=vi.hoisted(()=>({store:null as ReturnType<typeof createCmsMemoryStore>|null,query:vi.fn()}))
vi.mock('#/lib/supabase',()=>({getSupabaseClient:()=>({from:(name:string)=>{if(['families','classes','user_roles','family_enrollment','student_class_enrollment'].includes(name))throw new Error('retired table accessed');return h.store!.from(name)}})}))
vi.mock('#/lib/db',()=>({query:h.query}))
import {withIdentityDirectory} from '#/services/identityDirectory'
import {backendEmailPlatformService} from '#/services/emailPlatform/backendEmailPlatformService'
import {newsletterDeliveryService} from '#/services/newsletterDeliveryService'
const graph={people:[{id:'s',displayName:'Student',kind:'student' as const}],families:[{id:'f',code:'F',displayName:'Family'},{id:'friend',code:'FRIEND',displayName:'Friend'}],classes:[{id:'c',code:'C',displayName:'Class'}],familyMemberships:[{familyId:'f',personId:'s',relationship:'child' as const}],classMemberships:[{personId:'s',classId:'c',relationship:'student' as const}]}
const context={directory:async()=>graph,contacts:async()=>[{personId:'p',displayName:'Parent',email:'parent@example.test',families:[{familyId:'f',familyCode:'F',classIds:['c'],classCodes:['C']}]}],sessionId:'hash'}
beforeEach(()=>{h.store=createCmsMemoryStore();h.query.mockResolvedValue({rows:[{legacy_id:'old-class',auth_id:'c'}]})})
describe('delivery after identity table retirement',()=>{
 it('defaults an Auth-discovered family to subscribed when it has no explicit opt-out',async()=>{
 const r=await withIdentityDirectory(context,()=>newsletterDeliveryService.resolveAudience({mode:'family',familyId:'f'}));expect(r.eligibleCount).toBe(1);expect(r.recipients[0]).toMatchObject({eligibilityStatus:'eligible',subscriptionStatus:'subscribed',parentId:'p'})
 })
 it('keeps an explicit unsubscribe out of the Auth-derived count',async()=>{
 h.store!.rows('newsletter_family_preferences').push({family_id:'preference-family',auth_family_id:'f',newsletter_subscription_status:'unsubscribed'})
 const r=await withIdentityDirectory(context,()=>newsletterDeliveryService.resolveAudience({mode:'family',familyId:'f'}));expect(r.eligibleCount).toBe(0);expect(r.recipients[0].eligibilityReason).toBe('not_subscribed')
 })
 it('keeps an explicit pending preference out of the Auth-derived count',async()=>{
 h.store!.rows('newsletter_family_preferences').push({family_id:'preference-family',auth_family_id:'f',newsletter_subscription_status:'pending'})
 const r=await withIdentityDirectory(context,()=>newsletterDeliveryService.resolveAudience({mode:'family',familyId:'f'}));expect(r.eligibleCount).toBe(0);expect(r.recipients[0]).toMatchObject({eligibilityStatus:'ineligible',eligibilityReason:'not_subscribed',subscriptionStatus:'unsubscribed'})
 })
 it('uses authorized contact and explicit class alias only with affirmative consent',async()=>{
 h.store!.rows('newsletter_family_preferences').push({family_id:'legacy-family',auth_family_id:'f',newsletter_subscription_status:'subscribed'})
 const r=await withIdentityDirectory(context,()=>newsletterDeliveryService.resolveAudience({mode:'classes',classIds:['old-class']}));expect(r.eligibleCount).toBe(1);expect(r.recipients[0]).toMatchObject({familyId:'f',parentId:'p',parentEmail:'parent@example.test',classIds:['c','old-class']})
 })
 it('maps a historical resend family ID to its current Auth family ID',async()=>{
  h.query.mockResolvedValueOnce({rows:[{legacy_id:'old-family',auth_id:'f'}]})
  const service=newsletterDeliveryService as unknown as {resolveAuthFamilyIds(ids:string[]):Promise<string[]>}
  await expect(withIdentityDirectory(context,()=>service.resolveAuthFamilyIds(['old-family']))).resolves.toEqual(['f'])
 })
 it('fails closed when a historical resend family ID has no Auth mapping',async()=>{
  h.query.mockResolvedValueOnce({rows:[]})
  const service=newsletterDeliveryService as unknown as {resolveAuthFamilyIds(ids:string[]):Promise<string[]>}
  await expect(withIdentityDirectory(context,()=>service.resolveAuthFamilyIds(['old-family']))).rejects.toThrow('cannot be resolved unambiguously')
 })
 it('fails closed when the contact authority is unavailable',async()=>{
 await expect(withIdentityDirectory({...context,contacts:async()=>{throw new Error('revoked')}},()=>newsletterDeliveryService.resolveAudience())).rejects.toThrow('revoked')
 })
})

describe('revocation during preparation',()=>{
 it('marks removed recipients terminal instead of leaving them pending',async()=>{
 const row={id:'recipient',family_id:'f',parent_id:'gone',parent_email:'old@example.test',send_status:'pending'}
 h.store!.rows('newsletter_delivery_batch_recipients').push(row)
 const service=newsletterDeliveryService as unknown as {loadGuardianInputs(rows:unknown[]):Promise<{guardians:unknown[]}>}
 const result=await withIdentityDirectory(context,()=>service.loadGuardianInputs([row]))
 expect(result.guardians).toEqual([]);expect(row).toMatchObject({send_status:'skipped',failure_reason:'recipient_access_or_address_changed'})
 })
 it('fails preparation if recording a removed recipient fails',async()=>{
 const original=h.store!.from
 h.store!.from=((name:string)=>name==='newsletter_delivery_batch_recipients'?{update:()=>({eq:()=>Promise.resolve({error:{message:'write failed'}})})}:original(name)) as typeof original
 const service=newsletterDeliveryService as unknown as {loadGuardianInputs(rows:unknown[]):Promise<unknown>}
 await expect(withIdentityDirectory(context,()=>service.loadGuardianInputs([{id:'r',family_id:'f',parent_id:'gone',parent_email:'old@example.test',send_status:'pending'}]))).rejects.toThrow('Could not record revoked recipient')
 })
 it('does not call Resend when directory scope changes after render',async()=>{
 const send=vi.spyOn(backendEmailPlatformService,'sendNewsletter')
 const service=newsletterDeliveryService as unknown as {sendPreparedBatchViaResend(input:unknown):Promise<unknown>}
 await expect(withIdentityDirectory(context,()=>service.sendPreparedBatchViaResend({batchId:'b',newsletterId:'n',expectedDirectory:JSON.stringify({...graph,classMemberships:[]}),recipients:[{familyId:'f',parentEmail:'parent@example.test'}]}))).rejects.toThrow('Directory changed')
 expect(send).not.toHaveBeenCalled()
 })
 it('does not call Resend when contacts revoke during preparation',async()=>{
 const send=vi.spyOn(backendEmailPlatformService,'sendNewsletter')
 const service=newsletterDeliveryService as unknown as {sendPreparedBatchViaResend(input:unknown):Promise<unknown>}
 await expect(withIdentityDirectory({...context,contacts:async()=>[]},()=>service.sendPreparedBatchViaResend({batchId:'b',newsletterId:'n',expectedDirectory:JSON.stringify(graph),recipients:[{familyId:'f',parentEmail:'parent@example.test'}]}))).rejects.toThrow('Recipient access')
 expect(send).not.toHaveBeenCalled()
 })
})

describe('preview after table retirement',()=>{
 it('excludes the class article body and link for the other family',async()=>{
 h.store!.tables.email_templates=[]
 h.query.mockResolvedValue({rows:[{legacy_id:'C6',auth_id:'c'}]})
 const allowed=await newsletterDeliveryService.previewPersonalizationForFamily({newsletterId:'n1',familyId:'f',directory:graph})
 const excluded=await newsletterDeliveryService.previewPersonalizationForFamily({newsletterId:'n1',familyId:'friend',directory:graph})
 expect(allowed.renderedBody).toContain('Original note')
 expect(excluded.renderedBody).not.toContain('Original note')
 expect(excluded.renderedBody).not.toContain('article-one')
 })
})
