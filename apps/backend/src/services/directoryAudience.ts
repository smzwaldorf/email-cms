import type { SmzDirectoryGraph } from '../auth'

/** Current directory grouping only; historical references are never matched by name. */
export function directoryAudience(directory: SmzDirectoryGraph) {
  const result = new Map<string, { displayName: string; classNames: string[]; studentNames: string[] }>()
  for (const person of directory.people.filter(row => row.kind === 'adult')) {
    const familyIds = new Set(directory.familyMemberships.filter(link => link.personId === person.id && ['father', 'mother', 'guardian'].includes(link.relationship)).map(link => link.familyId))
    if (!familyIds.size) continue
    const childIds = new Set(directory.familyMemberships.filter(link => familyIds.has(link.familyId) && link.relationship === 'child').map(link => link.personId))
    const children = directory.people.filter(row => row.kind === 'student' && childIds.has(row.id))
    const validChildIds = new Set(children.map(row => row.id))
    const classIds = new Set(directory.classMemberships.filter(link => validChildIds.has(link.personId) && link.relationship === 'student').map(link => link.classId))
    result.set(person.id, { displayName: person.displayName, classNames: [...new Set(directory.classes.filter(row => classIds.has(row.id)).map(row => row.displayName))], studentNames: [...new Set(children.map(row => row.displayName))] })
  }
  return result
}
