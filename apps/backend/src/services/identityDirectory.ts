import { AsyncLocalStorage } from 'node:async_hooks'
import type { SmzDirectoryGraph } from '#/auth'
import { query } from '#/lib/db'
export interface DeliveryContact { personId: string; displayName: string; email: string; families: Array<{ familyId: string; familyCode: string; classIds: string[]; classCodes: string[] }> }
export interface IdentityContext { directory: () => Promise<SmzDirectoryGraph>; contacts: () => Promise<DeliveryContact[]>; sessionId?: string }
const scope = new AsyncLocalStorage<IdentityContext>()
export const withIdentityDirectory = <T>(context: IdentityContext, run: () => T): T => scope.run(context, run)
export function identityContext(): IdentityContext { const context = scope.getStore(); if (!context) throw new Error('Identity authorization required'); return context }
export const currentDirectory = () => identityContext().directory()
export const currentDeliveryContacts = () => identityContext().contacts()
export function projectClassAliases(directory: SmzDirectoryGraph, mappings: Array<{legacy_id:string;auth_id:string}>) {
 return directory.classes.flatMap(c => [{id:c.id,authId:c.id,code:c.code,name:c.displayName}, ...mappings.filter(r=>r.auth_id===c.id && r.legacy_id!==c.id).map(r=>({id:r.legacy_id,authId:c.id,code:c.code,name:c.displayName}))])
}
export async function classAliases(directory: SmzDirectoryGraph) {
 const {rows} = await query<{legacy_id:string;auth_id:string}>('SELECT legacy_id, auth_id FROM identity_reference_mappings WHERE entity_type = $1 AND auth_id IS NOT NULL',['class'])
 return projectClassAliases(directory,rows)
}

export async function personAliases(directory:SmzDirectoryGraph) {
 const {rows}=await query<{legacy_id:string;auth_id:string}>('SELECT legacy_id, auth_id FROM identity_reference_mappings WHERE entity_type = $1 AND auth_id IS NOT NULL',['person'])
 return directory.people.flatMap(p=>[{id:p.id,authId:p.id},...rows.filter(r=>r.auth_id===p.id && r.legacy_id!==p.id).map(r=>({id:r.legacy_id,authId:p.id}))])
}

export function projectFamilyChildren(directory:SmzDirectoryGraph,familyId:string,aliases:ReturnType<typeof projectClassAliases>) {
 const children=new Set(directory.familyMemberships.filter(m=>m.familyId===familyId && m.relationship==='child' && directory.people.some(p=>p.id===m.personId && p.kind==='student')).map(m=>m.personId))
 return directory.classMemberships.filter(m=>m.relationship==='student' && children.has(m.personId)).flatMap(m=>aliases.filter(c=>c.authId===m.classId).map(c=>({studentId:m.personId,studentName:directory.people.find(p=>p.id===m.personId)?.displayName??null,classId:c.id})))
}
