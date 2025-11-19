/**
 * Complete Development Setup Script
 * Sets up everything needed for local development in one command
 *
 * Prerequisites:
 * - Database schema must be initialized (migrations applied via `supabase db reset`)
 * - Service role key required for auth user creation and database writes
 *
 * This script:
 * 1. Seeds test data: newsletter weeks, classes, families, articles
 * 2. Creates auth users: parent1, parent2, admin
 * 3. Sets up family enrollments and class relationships
 *
 * Usage: npx ts-node scripts/setup-development.ts
 *
 * Test User Access After Setup:
 * ──────────────────────────────────────────────────────────────
 * parent1@example.com:
 *   - Password: parent1password123
 *   - Family: FAMILY001 (Grade 1A, Grade 2A)
 *   - Articles visible: 4 (2 public + 2 class-restricted)
 *
 * parent2@example.com:
 *   - Password: parent2password123
 *   - Family: FAMILY002 (Grade 1B)
 *   - Articles visible: 3 (2 public + 1 class-restricted)
 *
 * teacher@example.com:
 *   - Password: teacher123456
 *   - Role: teacher
 *   - Class: A1 (Grade 1A)
 *   - Can edit: Class-restricted articles for A1
 *   - Articles visible: All 6 articles
 *
 * admin@example.com:
 *   - Password: admin123456
 *   - Role: admin
 *   - Articles visible: All 6 articles
 *   - Can edit: All articles
 * ──────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  console.error('Service role key is required for auth user creation and database writes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// ============================================================================
// Test Data Definitions
// ============================================================================

const testWeeks = [
  {
    week_number: '2025-W47',
    release_date: '2025-11-17',
    is_published: true,
  },
  {
    week_number: '2025-W48',
    release_date: '2025-11-24',
    is_published: false,
  },
  {
    week_number: '2025-W49',
    release_date: '2025-12-01',
    is_published: false,
  },
]

const testClasses = [
  {
    id: 'A1',
    class_name: 'Grade 1A (一年級甲班)',
    class_grade_year: 1,
  },
  {
    id: 'A2',
    class_name: 'Grade 1B (一年級乙班)',
    class_grade_year: 1,
  },
  {
    id: 'B1',
    class_name: 'Grade 2A (二年級甲班)',
    class_grade_year: 2,
  },
  {
    id: 'B2',
    class_name: 'Grade 2B (二年級乙班)',
    class_grade_year: 2,
  },
]

const testFamilies = [
  {
    id: 'f1111111-1111-1111-1111-111111111111',
    family_code: 'FAMILY001',
  },
  {
    id: 'f2222222-2222-2222-2222-222222222222',
    family_code: 'FAMILY002',
  },
]

const testArticles = [
  {
    week_number: '2025-W47',
    title: '週報開刊致詞 (Weekly Opening)',
    content: `# 歡迎閱讀本週電子報

Dear Parents and Students,

Welcome to Week 47 of our newsletter. This week we have exciting updates from all classes.

## Highlights
- School event announcements
- Academic updates
- Upcoming activities

---

**Published on:** 2025-11-17
**Week:** 2025-W47`,
    author: 'Principal',
    article_order: 1,
    is_published: true,
    visibility_type: 'public',
    restricted_to_classes: null,
  },
  {
    week_number: '2025-W47',
    title: 'Grade 1A Class Updates (一年級甲班班級大小事)',
    content: `# 一年級甲班班級大小事

This week in Grade 1A:

## Academic Updates
- **Math:** Introduction to addition and subtraction
- **Reading:** New story time sessions every afternoon
- **Art:** Seasonal craft projects with fall themes

## Activities
- Class field trip to local museum (Nov 22)
- Show and tell event (Nov 24)
- Parent-teacher conference (Nov 23 at 3:00 PM)

## Homework
- Math worksheets (30 minutes)
- Reading journal entries (2 pages)

**Note:** This article is visible only to parents with children in Grade 1A.`,
    author: 'Ms. Chen',
    article_order: 2,
    is_published: true,
    visibility_type: 'class_restricted',
    restricted_to_classes: ['A1'],
  },
  {
    week_number: '2025-W47',
    title: 'Grade 1B Class Updates (一年級乙班班級大小事)',
    content: `# 一年級乙班班級大小事

This week in Grade 1B:

## Academic Updates
- **Music:** Learning new songs and instruments
- **PE:** Team sports activities and cooperative games
- **Science:** Exploring nature and seasons

## Class Events
- Music performance practice (Friday)
- Sports day competition (upcoming)
- Class election for student council

## Important Dates
- Parent conference: Nov 23 at 2:00 PM
- Holiday celebration: Dec 15

**Note:** This article is visible only to parents with children in Grade 1B.`,
    author: 'Mr. Wang',
    article_order: 3,
    is_published: true,
    visibility_type: 'class_restricted',
    restricted_to_classes: ['A2'],
  },
  {
    week_number: '2025-W47',
    title: 'Grade 2A Class Updates (二年級甲班班級大小事)',
    content: `# 二年級甲班班級大小事

This week in Grade 2A:

## Learning Highlights
- **Mathematics:** Multiplication basics and strategies
- **Literature:** Classic story appreciation and discussion
- **Social Studies:** Community helpers and professions

## Field Trip
- Planned for Dec 5
- Destination: Local nature preserve
- Permission slips due: Nov 30

## Student Achievements
- Math competition scores announced
- Science fair projects starting
- Reading club selections announced

**Note:** This article is visible only to parents with children in Grade 2A.`,
    author: 'Ms. Liu',
    article_order: 4,
    is_published: true,
    visibility_type: 'class_restricted',
    restricted_to_classes: ['B1'],
  },
  {
    week_number: '2025-W47',
    title: 'Grade 2B Class Updates (二年級乙班班級大小事)',
    content: `# 二年級乙班班級大小事

This week in Grade 2B:

## Academic Focus
- **Division Practice:** Solving word problems
- **Writing:** Short story composition and editing
- **Computer Lab:** Introduction to typing and digital literacy

## Upcoming Events
- Technology showcase (Dec 10)
- Writing workshop with guest author (Nov 28)
- Computer skills assessment (Dec 1-5)

## Reminders
- Library books due Friday
- Project submission deadline: next Thursday
- Parent volunteer sign-up: please help with field trip

**Note:** This article is visible only to parents with children in Grade 2B.`,
    author: 'Mr. Lee',
    article_order: 5,
    is_published: true,
    visibility_type: 'class_restricted',
    restricted_to_classes: ['B2'],
  },
  {
    week_number: '2025-W47',
    title: 'Important Announcements (重要公告)',
    content: `# 重要公告 - Important Announcements

## School-Wide Updates

### Parent-Teacher Conferences
- **Dates:** November 22-24, 2025
- **Time:** 1:00 PM - 5:00 PM each day
- **Sign-up:** See class teachers for time slots
- **Location:** Classroom and multipurpose room

### School Assembly
- **When:** Monday, November 17 at 8:30 AM
- **Where:** Gymnasium
- **Topic:** Annual awards and recognition ceremony

### Field Trip Permission Slips
- **Deadline:** November 19, 2025
- **Details:** Check your child's backpack for forms
- **Questions:** Contact the main office

### Holiday Celebration Planning
- School holiday party: December 19
- Student performances, games, and refreshments
- Family invitation event

---

**Visibility:** This article is visible to all parents and visitors.`,
    author: 'Admin',
    article_order: 6,
    is_published: true,
    visibility_type: 'public',
    restricted_to_classes: null,
  },
]

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
    email: 'teacher@example.com',
    password: 'teacher123456',
    role: 'teacher',
    assignedClasses: ['A1'], // Teaches Grade 1A only
  },
  {
    email: 'admin@example.com',
    password: 'admin123456',
    role: 'admin',
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

async function seedData(
  table: string,
  data: any[],
): Promise<{ success: number; skipped: number; failed: number }> {
  let success = 0
  let skipped = 0
  let failed = 0

  for (const record of data) {
    try {
      const { error } = await supabase.from(table).insert(record)

      // Handle conflicts gracefully - just skip existing records
      if (error?.code === 'PGRST116' || error?.message?.includes('duplicate')) {
        skipped++
      } else if (error) {
        console.error(`  ❌ Failed: ${JSON.stringify(record)}`)
        console.error(`     Error: ${error.message}`)
        failed++
      } else {
        success++
      }
    } catch (err) {
      console.error(`  ❌ Error: ${(err as any).message}`)
      failed++
    }
  }

  return { success, skipped, failed }
}

// ============================================================================
// Main Setup Function
// ============================================================================

async function setupDevelopment() {
  console.log('🚀 Setting up development environment...\n')

  try {
    // ========================================================================
    // PHASE 1: Seed Test Data
    // ========================================================================
    console.log('📊 PHASE 1: Seeding test data\n')

    // Seed newsletter weeks
    console.log('📅 Seeding newsletter weeks...')
    const weeksResult = await seedData('newsletter_weeks', testWeeks)
    console.log(`   ✅ Created: ${weeksResult.success} | ⏭️  Skipped: ${weeksResult.skipped}\n`)

    // Seed classes
    console.log('🏫 Seeding classes...')
    const classesResult = await seedData('classes', testClasses)
    console.log(`   ✅ Created: ${classesResult.success} | ⏭️  Skipped: ${classesResult.skipped}\n`)

    // Seed families
    console.log('👨‍👩‍👧‍👦 Seeding families...')
    const familiesResult = await seedData('families', testFamilies)
    console.log(`   ✅ Created: ${familiesResult.success} | ⏭️  Skipped: ${familiesResult.skipped}\n`)

    // Seed articles
    console.log('📰 Seeding articles...')
    const articlesResult = await seedData('articles', testArticles)
    console.log(`   ✅ Created: ${articlesResult.success} | ⏭️  Skipped: ${articlesResult.skipped}\n`)

    // ========================================================================
    // PHASE 2: Create Auth Users & Enrollments
    // ========================================================================
    console.log('🔐 PHASE 2: Creating test users and enrollments\n')

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
        const { error: roleError } = await supabase.from('user_roles').insert({
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
          const { error: enrollError } = await supabase.from('family_enrollment').insert({
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
            const { error: childError } = await supabase.from('child_class_enrollment').insert({
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

          console.log(
            `  ✅ Child enrollments created for classes: ${userWithFamily.childrenClasses.join(', ')}\n`,
          )
        } else if (user.role === 'teacher' && 'assignedClasses' in user) {
          // If this is a teacher, set up class assignments
          const userWithClasses = user as any

          // Create teacher class assignments
          for (const classId of userWithClasses.assignedClasses) {
            const { error: assignError } = await supabase.from('teacher_class_assignment').insert({
              teacher_id: userId,
              class_id: classId,
            })

            if (assignError) {
              console.error(
                `  ❌ Teacher assignment for class ${classId} failed: ${assignError.message}`,
              )
              continue
            }
          }

          console.log(
            `  ✅ Teacher assignments created for classes: ${userWithClasses.assignedClasses.join(', ')}\n`,
          )
        } else {
          console.log('')
        }
      } catch (err) {
        console.error(`  ❌ Error: ${(err as any).message}\n`)
      }
    }

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('━'.repeat(80))
    console.log('✅ Development setup complete!\n')
    console.log('📊 Summary:')
    console.log(`  Test Data:`)
    console.log(`    - Newsletter weeks: ${weeksResult.success} created`)
    console.log(`    - Classes: ${classesResult.success} created`)
    console.log(`    - Families: ${familiesResult.success} created`)
    console.log(`    - Articles: ${articlesResult.success} created`)
    console.log(`\n  Test Users:`)
    testUsers.forEach((user) => {
      if ('childrenClasses' in user) {
        const userWithFamily = user as any
        console.log(`    - ${user.email} (Family, Classes: ${userWithFamily.childrenClasses.join(', ')})`)
      } else if ('assignedClasses' in user) {
        const userWithClasses = user as any
        console.log(`    - ${user.email} (Teacher, Classes: ${userWithClasses.assignedClasses.join(', ')})`)
      } else {
        console.log(`    - ${user.email} (Admin)`)
      }
    })

    console.log('\n📝 Next steps:')
    console.log('  1. Start dev server: npm run dev')
    console.log('  2. Open http://localhost:5173')
    console.log('  3. Sign in with any test user:')
    console.log('     - parent1@example.com / parent1password123')
    console.log('     - parent2@example.com / parent2password123')
    console.log('     - teacher@example.com / teacher123456')
    console.log('     - admin@example.com / admin123456\n')

    console.log('🎯 Article Access (RLS Enforced):')
    console.log('  parent1@example.com → 4 articles (2 public + 2 class-restricted)')
    console.log('  parent2@example.com → 3 articles (2 public + 1 class-restricted)')
    console.log('  teacher@example.com → Can edit A1 class-restricted article (can view all 6)')
    console.log('  admin@example.com → All 6 articles (can edit all)\n')
  } catch (err) {
    console.error('❌ Fatal error during setup:', (err as any).message)
    process.exit(1)
  }
}

// Run the setup
setupDevelopment()
