import { describe, it, expect, vi } from 'vitest'
import { directoryAudience } from '../../../src/services/directoryAudience'
import type { SmzDirectoryGraph } from '../../../src/auth'
import { analyticsAggregator } from '../../../src/services/analyticsAggregator'
vi.mock('../../../src/services/identityDirectory', () => ({ currentDirectory: vi.fn(), personAliases: vi.fn() }))
vi.mock('../../../src/lib/supabase', () => ({ getSupabaseClient: vi.fn() }))
import { currentDirectory, personAliases } from '../../../src/services/identityDirectory'
import { getSupabaseClient } from '../../../src/lib/supabase'
const directory: SmzDirectoryGraph = {
 people: [{id:'adult',kind:'adult',displayName:'Adult'},{id:'friend',kind:'adult',displayName:'Friend'},{id:'child',kind:'student',displayName:'Child'},{id:'other',kind:'student',displayName:'Other'}],
 families:[{id:'f',code:'F',displayName:'Family'},{id:'g',code:'G',displayName:'Other family'}],
 classes:[{id:'c',code:'C',displayName:'Class'}],
 familyMemberships:[{familyId:'f',personId:'adult',relationship:'father'},{familyId:'f',personId:'child',relationship:'child'},{familyId:'g',personId:'friend',relationship:'guardian'},{familyId:'g',personId:'other',relationship:'child'}],
 classMemberships:[{personId:'child',classId:'c',relationship:'student'},{personId:'child',classId:'c',relationship:'student'}]
}
describe('Auth analytics audience', () => {
 it('isolates families and deduplicates repeated class membership', () => {
  const result=directoryAudience(directory)
  expect(result.get('adult')?.classNames).toEqual(['Class'])
  expect(result.get('friend')?.classNames).toEqual([])
  expect(result.has('child')).toBe(false)
  expect(result.has('old-id')).toBe(false)
 })
 it('deduplicates an adult with multiple children across families in a class', () => {
  const result=directoryAudience({...directory,familyMemberships:[...directory.familyMemberships,{familyId:'g',personId:'adult',relationship:'guardian'}],classMemberships:[...directory.classMemberships,{personId:'other',classId:'c',relationship:'student'}]})
  expect(result.get('adult')?.classNames).toEqual(['Class'])
  expect(result.get('adult')?.studentNames).toEqual(['Child','Other'])
 })
 it('uses explicit legacy aliases without retired identity table queries', async () => {
  vi.mocked(currentDirectory).mockResolvedValue(directory)
  vi.mocked(personAliases).mockResolvedValue([{id:'adult',authId:'adult'},{id:'legacy',authId:'adult'},{id:'friend',authId:'friend'}])
  expect(await analyticsAggregator.getUsersInClass('Class')).toEqual(['adult','legacy'])
  expect(getSupabaseClient).not.toHaveBeenCalled()
 })
 it('keeps unresolved historical readers and their counts without fabricated identity', async () => {
  vi.mocked(currentDirectory).mockResolvedValue(directory)
  vi.mocked(personAliases).mockResolvedValue([{id:'legacy',authId:'adult'}])
  const builder = { select: vi.fn(), eq: vi.fn() }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({data:[{user_id:'legacy',created_at:'2026-01-01'},{user_id:'unknown',created_at:'2026-01-02'}],error:null})
  vi.mocked(getSupabaseClient).mockReturnValue({from:vi.fn(() => builder)} as unknown as ReturnType<typeof getSupabaseClient>)
  const readers = await analyticsAggregator.getArticleReaders('article')
  expect(readers[0]).toMatchObject({userId:'legacy',email:'Adult',className:['Class'],viewCount:1})
  expect(readers[1]).toMatchObject({userId:'unknown',email:'Unknown historical reader',role:'Unknown',className:[],viewCount:1})
 })
 it('propagates unavailable Auth rather than using stale identities', async () => {
  vi.mocked(currentDirectory).mockRejectedValue(new Error('Auth unavailable'))
  await expect(analyticsAggregator.getUsersInClass('Class')).rejects.toThrow('Auth unavailable')
 })
})
