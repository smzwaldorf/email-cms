import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''

const hasRequiredEnv = !!supabaseUrl && !!supabaseAnonKey && !!supabaseServiceKey

describe.skipIf(!hasRequiredEnv)('user_roles admin RPCs', () => {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let createdUserIds: string[] = []
  let adminClient: SupabaseClient | null = null
  let parentClient: SupabaseClient | null = null

  const createAuthedClient = () =>
    createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

  const createAuthUser = async (email: string, password: string) => {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error || !data.user) {
      throw new Error(`Failed to create auth user ${email}: ${error?.message}`)
    }

    createdUserIds.push(data.user.id)
    return data.user
  }

  beforeEach(async () => {
    createdUserIds = []
    adminClient = createAuthedClient()
    parentClient = createAuthedClient()

    const testId = Date.now().toString()
    const adminEmail = `admin-rpc-${testId}@example.com`
    const parentEmail = `parent-rpc-${testId}@example.com`

    const adminUser = await createAuthUser(adminEmail, 'AdminPassword123!')
    const parentUser = await createAuthUser(parentEmail, 'ParentPassword123!')

    await supabaseAdmin.from('user_roles').insert([
      { id: adminUser.id, email: adminEmail, role: 'admin' },
      { id: parentUser.id, email: parentEmail, role: 'parent' },
    ])

    const adminSignIn = await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password: 'AdminPassword123!',
    })
    if (adminSignIn.error) {
      throw adminSignIn.error
    }

    const parentSignIn = await parentClient.auth.signInWithPassword({
      email: parentEmail,
      password: 'ParentPassword123!',
    })
    if (parentSignIn.error) {
      throw parentSignIn.error
    }
  })

  afterEach(async () => {
    if (adminClient) {
      await adminClient.auth.signOut()
    }
    if (parentClient) {
      await parentClient.auth.signOut()
    }

    for (const userId of createdUserIds) {
      await supabaseAdmin.from('user_roles').delete().eq('id', userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
    }
  })

  it('allows an authenticated admin to create a user_roles row via RPC', async () => {
    const target = await createAuthUser(`target-create-${Date.now()}@example.com`, 'TargetPassword123!')

    const { data, error } = await adminClient!.rpc('admin_create_user_role', {
      target_user_id: target.id,
      target_email: target.email!,
      target_role: 'teacher',
    })

    expect(error).toBeNull()
    expect(data).toMatchObject({
      id: target.id,
      email: target.email,
      role: 'teacher',
    })
  })

  it('allows an authenticated admin to update and delete a user_roles row via RPC', async () => {
    const target = await createAuthUser(`target-mutate-${Date.now()}@example.com`, 'TargetPassword123!')

    await supabaseAdmin.from('user_roles').insert({
      id: target.id,
      email: target.email,
      role: 'parent',
    })

    const updateResult = await adminClient!.rpc('admin_update_user_role', {
      target_user_id: target.id,
      target_role: 'teacher',
    })

    expect(updateResult.error).toBeNull()
    expect(updateResult.data).toMatchObject({
      id: target.id,
      role: 'teacher',
    })

    const deleteResult = await adminClient!.rpc('admin_delete_user_role', {
      target_user_id: target.id,
    })

    expect(deleteResult.error).toBeNull()
    expect(deleteResult.data).toBe(true)
  })

  it('rejects non-admin user_roles mutations via RPC', async () => {
    const target = await createAuthUser(`target-denied-${Date.now()}@example.com`, 'TargetPassword123!')

    const { data, error } = await parentClient!.rpc('admin_create_user_role', {
      target_user_id: target.id,
      target_email: target.email!,
      target_role: 'teacher',
    })

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Access denied')
  })
})
