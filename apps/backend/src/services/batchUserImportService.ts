import { getSupabaseClient } from '#/lib/supabase'

export interface CSVUserRow {
  email: string
  name: string
  role: 'admin' | 'teacher' | 'parent' | 'student'
  status?: 'active' | 'disabled' | 'pending_approval'
}

export interface BatchUserImportResult {
  importedCount: number
  importedUserEmails: string[]
}

const ALLOWED_ROLES = new Set(['admin', 'teacher', 'parent', 'student'])

function isCSVUserRow(value: unknown): value is CSVUserRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.email === 'string' &&
    row.email.trim().length > 0 &&
    typeof row.name === 'string' &&
    row.name.trim().length > 0 &&
    typeof row.role === 'string' &&
    ALLOWED_ROLES.has(row.role)
  )
}

function normalizeRow(row: CSVUserRow): CSVUserRow {
  return {
    email: row.email.trim().toLowerCase(),
    name: row.name.trim(),
    role: row.role,
    status: row.status ?? 'pending_approval',
  }
}

export const batchUserImportService = {
  async importUsers(rowsInput: unknown): Promise<BatchUserImportResult> {
    if (!Array.isArray(rowsInput) || rowsInput.length === 0) {
      throw new Error('No rows provided')
    }

    const rows = rowsInput.map((row, index) => {
      if (!isCSVUserRow(row)) {
        throw new Error(`Invalid import row at index ${index}`)
      }
      return normalizeRow(row)
    })

    const supabase = getSupabaseClient()
    const createdUsers: string[] = []
    const createdUserRoles: string[] = []

    try {
      for (const row of rows) {
        const { data: createdAuth, error: createAuthError } = await supabase.auth.admin.createUser({
          email: row.email,
          email_confirm: true,
          user_metadata: {
            name: row.name,
            import_status: row.status,
          },
        })

        if (createAuthError || !createdAuth.user) {
          throw new Error(createAuthError?.message || `Failed to create auth user for ${row.email}`)
        }

        createdUsers.push(createdAuth.user.id)

        const { error: createRoleError } = await supabase
          .from('user_roles')
          .insert({
            id: createdAuth.user.id,
            email: row.email,
            role: row.role,
          })

        if (createRoleError) {
          throw new Error(createRoleError.message)
        }

        createdUserRoles.push(createdAuth.user.id)
      }

      return {
        importedCount: rows.length,
        importedUserEmails: rows.map((row) => row.email),
      }
    } catch (error) {
      for (const userId of createdUserRoles) {
        await supabase.from('user_roles').delete().eq('id', userId)
      }

      for (const userId of createdUsers) {
        await supabase.auth.admin.deleteUser(userId)
      }

      throw error
    }
  },
}
