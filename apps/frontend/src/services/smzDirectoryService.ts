import { backendRequest } from '@/services/backendApi'

export interface SmzDirectoryFamily {
  id: string
  code: string
  displayName: string
}

/**
 * The Identity directory is the source of the family list shown to operators.
 * CMS bridges the authenticated browser or sealed server session without ever
 * returning the Identity credential to JavaScript.
 */
export async function fetchSmzDirectoryFamilies(): Promise<SmzDirectoryFamily[]> {
  const response = await backendRequest<{ families: SmzDirectoryFamily[] }>('/api/admin/directory/families')
  return response.families
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
}
