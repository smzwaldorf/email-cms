import { describe, expect, it } from 'vitest'
import { resolveAccessControl, resolveClassScope, resolveWinningRole } from '@/services/accessControlResolver'

describe('accessControlResolver', () => {
  it('selects the same winning role regardless of input role order', () => {
    const first = resolveWinningRole(['teacher', 'parent'])
    const second = resolveWinningRole(['parent', 'teacher'])

    expect(first).toBe('teacher')
    expect(second).toBe('teacher')
  })

  it('resolves canonical read/write class scope for multi-role users', () => {
    const scope = resolveClassScope({
      roles: ['parent', 'teacher', 'student'],
      teacherClassIds: ['G2', 'G1'],
      parentClassIds: ['G3', 'G1'],
      studentClassIds: ['G4', 'G1'],
    })

    expect(scope.readClassIds).toEqual(['G1', 'G2', 'G3', 'G4'])
    expect(scope.writeClassIds).toEqual(['G1', 'G2'])
  })

  it('grants view deterministically when class is in resolved read scope', () => {
    const resolution = resolveAccessControl({
      roles: ['parent', 'teacher'],
      action: 'article:view',
      teacherClassIds: ['A1'],
      parentClassIds: ['B1'],
      targetClassId: 'B1',
    })

    expect(resolution.granted).toBe(true)
    expect(resolution.winningRole).toBe('teacher')
    expect(resolution.scope.readClassIds).toEqual(['A1', 'B1'])
  })

  it('denies edit when target class is outside teacher write scope', () => {
    const resolution = resolveAccessControl({
      roles: ['teacher', 'parent'],
      action: 'article:edit',
      teacherClassIds: ['A1'],
      parentClassIds: ['B1'],
      targetClassId: 'B1',
    })

    expect(resolution.granted).toBe(false)
    expect(resolution.reason).toContain('outside resolved write scope')
  })
})
