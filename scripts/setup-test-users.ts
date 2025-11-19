/**
 * Setup Test Users Script
 * Creates test users in Supabase Auth and sets up family enrollments
 *
 * Prerequisites:
 * - Database migrations must be applied (including seed data migration)
 * - Families FAMILY001 and FAMILY002 must exist in families table
 * - Classes A1, A2, B1, B2 must exist in classes table
 *
 * This script:
 * 1. Creates users in Supabase Auth
 * 2. Adds user role records to user_roles table
 * 3. Creates family enrollments linking parents to families
 * 4. Creates child class enrollments for article access control
 *
 * Usage: npx ts-node scripts/setup-test-users.ts
 *
 * Test User Access Levels:
 * ──────────────────────────────────────────────────────────────
 * parent1@example.com (Family FAMILY001):
 *   - Children in: Grade 1A (A1), Grade 2A (B1)
 *   - Articles visible: 4 (2 public + 2 class-restricted)
 *   - See: Weekly Opening, Grade 1A Updates, Grade 2A Updates, Announcements
 *
 * parent2@example.com (Family FAMILY002):
 *   - Children in: Grade 1B (A2)
 *   - Articles visible: 3 (2 public + 1 class-restricted)
 *   - See: Weekly Opening, Grade 1B Updates, Announcements
 *
 * admin@example.com:
 *   - Role: admin
 *   - Articles visible: All (6/6, no RLS restrictions)
 * ──────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  console.error('Service role key is required to create auth users')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const testUsers = [
  {
    email: 'parent1@example.com',
    password: 'parent1password123',
    role: 'parent',
    familyId: 'f1111111-1111-1111-1111-111111111111', // FAMILY001
    childrenClasses: ['A1', 'B1'], // Grade 1A, Grade 2A
  },
  {
    email: 'parent2@example.com',
    password: 'parent2password123',
    role: 'parent',
    familyId: 'f2222222-2222-2222-2222-222222222222', // FAMILY002
    childrenClasses: ['A2'], // Grade 1B
  },
  {
    email: 'admin@example.com',
    password: 'admin123456',
    role: 'admin',
  },
]

async function setupTestUsers() {
  console.log('🔐 Setting up test users...\n')

  for (const user of testUsers) {
    try {
      console.log(`📝 Creating user: ${user.email}`)

      // Create user in auth
      const { data, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Auto-confirm email
      })

      if (createError) {
        console.error(`  ❌ Auth creation failed: ${createError.message}`)
        continue
      }

      const userId = data.user?.id
      console.log(`  ✅ Auth user created: ${userId}`)

      // Create role record
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          id: userId,
          email: user.email,
          role: user.role,
        })

      if (roleError) {
        console.error(`  ❌ Role creation failed: ${roleError.message}`)
        continue
      }

      console.log(`  ✅ Role created: ${user.role}`)

      // If this is a parent, set up family enrollment
      if (user.role === 'parent' && 'familyId' in user && 'childrenClasses' in user) {
        const userWithFamily = user as any

        // Create family enrollment
        const { error: enrollError } = await supabase
          .from('family_enrollment')
          .insert({
            family_id: userWithFamily.familyId,
            parent_id: userId,
            relationship: 'mother', // Default to mother for test data
          })

        if (enrollError) {
          console.error(`  ❌ Family enrollment failed: ${enrollError.message}`)
          continue
        }

        console.log(`  ✅ Family enrollment created`)

        // Create child enrollments for each class
        for (const classId of userWithFamily.childrenClasses) {
          const { error: childError } = await supabase
            .from('child_class_enrollment')
            .insert({
              child_id: userId, // Use parent ID as child ID for test data
              family_id: userWithFamily.familyId,
              class_id: classId,
            })

          if (childError) {
            console.error(
              `  ❌ Child enrollment for class ${classId} failed: ${childError.message}`,
            )
            continue
          }
        }

        console.log(`  ✅ Child enrollments created for classes: ${userWithFamily.childrenClasses.join(', ')}\n`)
      } else {
        console.log('')
      }
    } catch (err) {
      console.error(`  ❌ Error: ${(err as any).message}\n`)
    }
  }

  console.log('✅ Test users setup complete!')
  console.log('\nTest user access levels:')
  testUsers.forEach((user) => {
    if ('childrenClasses' in user) {
      const userWithFamily = user as any
      console.log(`  📧 ${user.email}`)
      console.log(
        `     → See 2 public articles + ${userWithFamily.childrenClasses.length} class-restricted (classes: ${userWithFamily.childrenClasses.join(', ')})`,
      )
      console.log(`     🔑 ${user.password}\n`)
    } else {
      console.log(`  📧 ${user.email}`)
      console.log(`     → Admin role (all articles)`)
      console.log(`     🔑 ${user.password}\n`)
    }
  })
}

setupTestUsers()
