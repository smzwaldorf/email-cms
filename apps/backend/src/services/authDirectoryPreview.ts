import type { SmzDirectoryGraph } from '#/auth'

export interface CmsPreviewClassRow {
  id: string
  class_code?: string | null
  class_name?: string | null
  is_active?: boolean | null
}

export interface AuthPreviewChild {
  studentId: string
  studentName: string | null
  classCode: string
}

export interface AuthPreviewFamilyScope {
  familyId: string
  familyCode: string
  familyDisplayName: string
  guardianId: string
  children: AuthPreviewChild[]
  classCodes: string[]
}

export interface CmsPreviewFamilyScope {
  familyId: string
  guardianId: string
  children: Array<{ studentId: string; studentName: string | null; classId: string }>
  classes: CmsPreviewClassRow[]
  missingClassCodes: string[]
}

const adultRelationships = new Set(['father', 'mother', 'guardian'])

function normalizedCode(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Resolve one already-scoped Auth family into its active child/class graph.
 * The graph is authoritative here: CMS student_class_enrollment is not read
 * or merged into this scope, so stale local rows cannot widen a preview.
 */
export function resolveAuthPreviewFamily(
  directory: SmzDirectoryGraph,
  familyId: string,
): AuthPreviewFamilyScope | null {
  const family = directory.families.find((candidate) => candidate.id === familyId)
  if (!family) return null

  const peopleById = new Map(directory.people.map((person) => [person.id, person]))
  const classesById = new Map(directory.classes.map((schoolClass) => [schoolClass.id, schoolClass]))
  const memberships = directory.familyMemberships.filter((membership) => membership.familyId === familyId)
  const childIds = new Set(
    memberships
      .filter((membership) => membership.relationship === 'child' && peopleById.get(membership.personId)?.kind === 'student')
      .map((membership) => membership.personId),
  )
  const guardianId = memberships
    .filter((membership) => adultRelationships.has(membership.relationship) && peopleById.get(membership.personId)?.kind === 'adult')
    .map((membership) => membership.personId)
    .sort()[0] ?? `preview:${familyId}`

  const children = directory.classMemberships
    .filter((membership) => membership.relationship === 'student' && childIds.has(membership.personId))
    .map((membership): AuthPreviewChild | null => {
      const schoolClass = classesById.get(membership.classId)
      const student = peopleById.get(membership.personId)
      if (!schoolClass || !student) return null
      return {
        studentId: membership.personId,
        studentName: student.displayName,
        classCode: schoolClass.code,
      }
    })
    .filter((child): child is AuthPreviewChild => child !== null)
    .sort((left, right) => `${left.studentId}:${left.classCode}`.localeCompare(`${right.studentId}:${right.classCode}`))

  return {
    familyId: family.id,
    familyCode: family.code,
    familyDisplayName: family.displayName,
    guardianId,
    children,
    classCodes: [...new Set(children.map((child) => child.classCode))].sort(),
  }
}

/**
 * Map Auth class codes to the CMS class IDs used by newsletter articles.
 * Missing and ambiguous codes are omitted from the render scope so a bad
 * reconciliation can never expose a class-targeted article to a family.
 */
export function mapAuthPreviewFamilyToCms(
  scope: AuthPreviewFamilyScope,
  cmsClasses: CmsPreviewClassRow[],
): CmsPreviewFamilyScope {
  const classesByCode = new Map<string, CmsPreviewClassRow[]>()
  for (const schoolClass of cmsClasses) {
    if (schoolClass.is_active === false || !schoolClass.class_code?.trim()) continue
    const key = normalizedCode(schoolClass.class_code)
    classesByCode.set(key, [...(classesByCode.get(key) ?? []), schoolClass])
  }

  const missingClassCodes = new Set<string>()
  const mappedClasses = new Map<string, CmsPreviewClassRow>()
  const children = scope.children.flatMap((child) => {
    const matches = classesByCode.get(normalizedCode(child.classCode)) ?? []
    if (matches.length !== 1) {
      missingClassCodes.add(child.classCode)
      return []
    }
    const mapped = matches[0]
    mappedClasses.set(mapped.id, mapped)
    return [{ studentId: child.studentId, studentName: child.studentName, classId: mapped.id }]
  })

  return {
    familyId: scope.familyId,
    guardianId: scope.guardianId,
    children,
    classes: [...mappedClasses.values()],
    missingClassCodes: [...missingClassCodes].sort(),
  }
}
