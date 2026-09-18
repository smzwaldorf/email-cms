import {describe,it,expect,vi} from 'vitest'
vi.mock('#/lib/supabase',()=>({getSupabaseClient:()=>({from:()=>{throw new Error('No identity table allowed')}})}))
vi.mock('#/lib/db',()=>({query:async()=>({rows:[{legacy_id:'legacy',auth_id:'class'}]})}))
import {adminService} from '#/services/adminService'
import {withIdentityDirectory} from '#/services/identityDirectory'
const directory={people:[],families:[{id:'family',code:'F',displayName:'Family'}],classes:[{id:'class',code:'C',displayName:'Class'}],familyMemberships:[],classMemberships:[]}
const context={directory:async()=>directory,contacts:async()=>[]}
describe('Auth-owned catalogues',()=>{
 it('reads canonical class and family IDs without local identity tables',async()=>{const result=await withIdentityDirectory(context,async()=>({classes:await adminService.fetchClasses(),families:await adminService.fetchFamilies()}));expect(result.classes[0]).toMatchObject({id:'class',name:'Class'});expect(result.families[0]).toMatchObject({id:'family',name:'Family'})})
 it('validates targets only from current Auth classes and explicit historical aliases',async()=>{const service=adminService as unknown as {validateTargetClassIds(ids:string[]):Promise<void>};await withIdentityDirectory(context,()=>service.validateTargetClassIds(['class','legacy']));await expect(withIdentityDirectory(context,()=>service.validateTargetClassIds(['missing']))).rejects.toThrow('Unknown Auth class')})
})
