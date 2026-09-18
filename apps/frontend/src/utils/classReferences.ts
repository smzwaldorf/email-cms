/** Preserve unmapped references; only explicit unique aliases may change identity. */
export function canonicalClassReferences(ids: string[] | undefined, classes: Array<{id:string;legacyIds?:string[]}>): string[] {
 return [...new Set((ids ?? []).map(id => {
  if(classes.some(c=>c.id===id)) return id
  const matches=classes.filter(c=>c.legacyIds?.includes(id))
  return matches.length===1 ? matches[0].id : id
 }))]
}
