import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CSVUserRow {
  email: string
  name: string
  role: 'admin' | 'teacher' | 'parent' | 'student'
  status?: 'active' | 'disabled' | 'pending_approval'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_ANON_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase environment variables' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: currentRole, error: roleLookupError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleLookupError || currentRole?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Access denied: admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as { rows?: CSVUserRow[] }
    const rows = body.rows ?? []

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'No rows provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const createdUsers: string[] = []
    const createdUserRoles: string[] = []

    try {
      for (const row of rows) {
        const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
          email: row.email,
          email_confirm: true,
        })

        if (createAuthError || !createdAuth.user) {
          throw new Error(createAuthError?.message || `Failed to create auth user for ${row.email}`)
        }

        createdUsers.push(createdAuth.user.id)

        const { error: createRoleError } = await adminClient
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

      return new Response(
        JSON.stringify({
          importedCount: rows.length,
          importedUserEmails: rows.map((row) => row.email),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      for (const userId of createdUserRoles) {
        await adminClient.from('user_roles').delete().eq('id', userId)
      }

      for (const userId of createdUsers) {
        await adminClient.auth.admin.deleteUser(userId)
      }

      throw error
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
