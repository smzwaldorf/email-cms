import type { IncomingMessage } from 'node:http'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AuthenticatedAdmin {
  id: string
  email: string | null
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

function readBearerToken(request: IncomingMessage): string {
  const authorization = request.headers.authorization
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) {
    throw new HttpError(401, 'Missing bearer token')
  }
  return match[1]
}

export async function requireAdmin(request: IncomingMessage, supabase: SupabaseClient): Promise<AuthenticatedAdmin> {
  const token = readBearerToken(request)
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    throw new HttpError(401, 'Invalid bearer token')
  }

  const { data: roleRow, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (roleError) {
    throw new HttpError(500, `Failed to verify admin role: ${roleError.message}`)
  }
  if ((roleRow as { role?: string } | null)?.role !== 'admin') {
    throw new HttpError(403, 'Admin role required')
  }

  return {
    id: userData.user.id,
    email: userData.user.email ?? null,
  }
}
