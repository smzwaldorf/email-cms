/**
 * Test Authentication Script
 * Verifies that the authentication flow works correctly
 * Usage: npx ts-node scripts/test-auth.ts
 */

import { createClient } from './lib/dbClient.ts'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const testCredentials = {
  email: 'parent1@example.com',
  password: 'parent1password123',
}

async function testAuth() {
  console.log('🔐 Testing authentication flow...\n')

  try {
    // Test 1: Sign in
    console.log('1️⃣  Attempting sign in with:', testCredentials.email)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testCredentials.email,
      password: testCredentials.password,
    })

    if (signInError) {
      console.error('  ❌ Sign in failed:', signInError.message)
      return
    }

    const userId = signInData.user?.id
    console.log('  ✅ Sign in successful')
    console.log('     User ID:', userId)
    console.log('     Email:', signInData.user?.email)

    // Test 2: Fetch user role
    console.log('\n2️⃣  Fetching user role from database...')
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('id', userId)
      .single()

    if (roleError) {
      console.error('  ❌ Failed to fetch role:', roleError.message)
      return
    }

    console.log('  ✅ User role fetched successfully')
    console.log('     Role:', roleData.role)
    console.log('     Email:', roleData.email)

    // Test 3: Sign out
    console.log('\n3️⃣  Testing sign out...')
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      console.error('  ❌ Sign out failed:', signOutError.message)
      return
    }

    console.log('  ✅ Sign out successful')

    // Test 4: Verify session is cleared
    console.log('\n4️⃣  Verifying session is cleared...')
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      console.error('  ❌ Session still exists after sign out')
      return
    }

    console.log('  ✅ Session cleared successfully')

    console.log('\n✅ All authentication tests passed!')
  } catch (err) {
    console.error('❌ Unexpected error:', (err as any).message)
  }
}

testAuth()
