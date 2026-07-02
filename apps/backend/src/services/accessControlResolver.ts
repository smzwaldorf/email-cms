export type AccessControlRole = 'admin' | 'teacher' | 'parent' | 'student'

export type AccessControlAction =
  | 'article:view'
  | 'article:edit'
  | 'article:delete'
  | 'admin:manage_permissions'

export interface AccessControlScope {
  readClassIds: string[]
  writeClassIds: string[]
}

export interface AccessControlResolutionInput {
  roles: AccessControlRole[]
  action: AccessControlAction
  teacherClassIds?: string[]
  parentClassIds?: string[]
  studentClassIds?: string[]
  targetClassId?: string | null
}

export interface AccessControlResolution {
  granted: boolean
  winningRole: AccessControlRole | null
  evaluatedRoles: AccessControlRole[]
  scope: AccessControlScope
  policyVersion: string
  reason: string
}

const POLICY_VERSION = 'access-policy-2026-03-20.1'

const ROLE_PRECEDENCE: Record<AccessControlRole, number> = {
  admin: 4,
  teacher: 3,
  parent: 2,
  student: 1,
}

const CANONICAL_ROLE_ORDER: AccessControlRole[] = ['admin', 'teacher', 'parent', 'student']

function dedupeAndSort(input: string[]): string[] {
  return Array.from(new Set(input.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function normalizeRoles(input: AccessControlRole[]): AccessControlRole[] {
  const uniqueRoles = Array.from(new Set(input))
  return uniqueRoles.sort((left, right) => ROLE_PRECEDENCE[right] - ROLE_PRECEDENCE[left])
}

export function resolveWinningRole(roles: AccessControlRole[]): AccessControlRole | null {
  const normalized = normalizeRoles(roles)
  return normalized[0] || null
}

export function resolveClassScope(input: {
  roles: AccessControlRole[]
  teacherClassIds?: string[]
  parentClassIds?: string[]
  studentClassIds?: string[]
}): AccessControlScope {
  const roles = new Set(input.roles)

  const teacherClasses = roles.has('teacher') ? input.teacherClassIds || [] : []
  const parentClasses = roles.has('parent') ? input.parentClassIds || [] : []
  const studentClasses = roles.has('student') ? input.studentClassIds || [] : []

  const readClassIds = dedupeAndSort([...teacherClasses, ...parentClasses, ...studentClasses])
  const writeClassIds = dedupeAndSort([...teacherClasses])

  return {
    readClassIds,
    writeClassIds,
  }
}

function canPerformAction(
  action: AccessControlAction,
  roles: AccessControlRole[],
  scope: AccessControlScope,
  targetClassId?: string | null,
): { granted: boolean; reason: string } {
  const roleSet = new Set(roles)

  if (roleSet.has('admin')) {
    return { granted: true, reason: 'Admin role grants full access.' }
  }

  if (action === 'admin:manage_permissions') {
    return { granted: false, reason: 'Only admins can manage access-control settings.' }
  }

  if (action === 'article:delete') {
    return { granted: false, reason: 'Only admins can delete articles.' }
  }

  if (action === 'article:view') {
    if (roleSet.size === 0) {
      return { granted: false, reason: 'No assigned role available for article visibility.' }
    }

    if (targetClassId && !scope.readClassIds.includes(targetClassId)) {
      return {
        granted: false,
        reason: 'Requested class is outside resolved read scope.',
      }
    }

    return { granted: true, reason: 'Read visibility granted by resolved class scope.' }
  }

  if (action === 'article:edit') {
    if (!roleSet.has('teacher')) {
      return {
        granted: false,
        reason: 'Edit requires teacher role or higher.',
      }
    }

    if (!targetClassId) {
      return {
        granted: false,
        reason: 'Edit requires explicit target class scope.',
      }
    }

    if (!scope.writeClassIds.includes(targetClassId)) {
      return {
        granted: false,
        reason: 'Requested class is outside resolved write scope.',
      }
    }

    return { granted: true, reason: 'Teacher write scope allows editing this class content.' }
  }

  return { granted: false, reason: 'Unhandled action.' }
}

export function resolveAccessControl(input: AccessControlResolutionInput): AccessControlResolution {
  const roles = normalizeRoles(input.roles)
  const scope = resolveClassScope({
    roles,
    teacherClassIds: input.teacherClassIds,
    parentClassIds: input.parentClassIds,
    studentClassIds: input.studentClassIds,
  })
  const winningRole = resolveWinningRole(roles)
  const actionResult = canPerformAction(input.action, roles, scope, input.targetClassId)

  return {
    granted: actionResult.granted,
    winningRole,
    evaluatedRoles: CANONICAL_ROLE_ORDER.filter((role) => roles.includes(role)),
    scope,
    policyVersion: POLICY_VERSION,
    reason: actionResult.reason,
  }
}
