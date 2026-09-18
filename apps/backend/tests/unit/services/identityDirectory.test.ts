import {describe,it,expect} from 'vitest'
import {projectFamilyChildren,projectClassAliases,withIdentityDirectory,currentDirectory} from '../../../src/services/identityDirectory'
const directory={people:[],families:[],classes:[{id:'canonical',code:'G1',displayName:'Grade1'}],familyMemberships:[],classMemberships:[]}
describe('Auth directory projection',()=>{
 it('only accepts explicit mappings to current Auth classes',()=>{expect(projectClassAliases(directory,[{legacy_id:'old',auth_id:'canonical'},{legacy_id:'stale',auth_id:'deleted'}]).map(c=>c.id)).toEqual(['canonical','old'])})
 it('fails closed outside request context',()=>expect(()=>currentDirectory()).toThrow('Identity authorization required'))
 it('isolates concurrent request directories',async()=>{const other={...directory,classes:[]}; const results=await Promise.all([withIdentityDirectory({directory:async()=>directory,contacts:async()=>[]},async()=>{await Promise.resolve();return currentDirectory()}),withIdentityDirectory({directory:async()=>other,contacts:async()=>[]},()=>currentDirectory())]);expect(results).toEqual([directory,other])})
})

describe('family entitlement projection',()=>{
 it('excludes another family and keeps canonical and explicit legacy targets',()=>{
 const graph={...directory,people:[{id:'child',displayName:'Child',kind:'student' as const}],families:[{id:'family',code:'F1',displayName:'Family'}],familyMemberships:[{familyId:'family',personId:'child',relationship:'child' as const}],classMemberships:[{classId:'canonical',personId:'child',relationship:'student' as const}]}
 const aliases=projectClassAliases(graph,[{legacy_id:'old',auth_id:'canonical'}])
 expect(projectFamilyChildren(graph,'other',aliases)).toEqual([])
 expect(projectFamilyChildren(graph,'family',aliases).map(c=>c.classId)).toEqual(['canonical','old'])
 })
})
