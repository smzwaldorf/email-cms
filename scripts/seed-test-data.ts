/**
 * Seed Test Data Script
 * Creates comprehensive test data for development and testing
 *
 * Prerequisites:
 * - Database schema must be initialized (migrations applied)
 * - Service role key is required for direct database access
 *
 * This script creates:
 * 1. Newsletter weeks (W47, W48, W49)
 * 2. Classes (A1, A2, B1, B2)
 * 3. Families (FAMILY001, FAMILY002)
 * 4. Articles with mixed visibility (public and class-restricted)
 *
 * Usage: npx ts-node scripts/seed-test-data.ts
 *
 * Article Visibility After Seeding:
 * ──────────────────────────────────────────────────────────────
 * parent1@example.com sees in Week 47:
 *   1. Weekly Opening (public)
 *   2. Grade 1A Updates (class: A1)
 *   3. Grade 2A Updates (class: B1)
 *   4. Announcements (public)
 *   Total: 4 articles
 *
 * parent2@example.com sees in Week 47:
 *   1. Weekly Opening (public)
 *   2. Grade 1B Updates (class: A2)
 *   3. Announcements (public)
 *   Total: 3 articles
 *
 * admin@example.com sees: All articles (6/6)
 * ──────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  console.error('Service role key is required for database write access')
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

// ============================================================================
// Helper Functions
// ============================================================================

async function seedData(
  table: string,
  data: any[],
  conflictColumn: string,
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
// Main Seeding Function
// ============================================================================

async function seedTestData() {
  console.log('🌱 Seeding test data for development...\n')

  try {
    // Seed newsletter weeks
    console.log('📅 Seeding newsletter weeks...')
    const weeksResult = await seedData('newsletter_weeks', testWeeks, 'week_number')
    console.log(`   ✅ Created: ${weeksResult.success} | ⏭️  Skipped: ${weeksResult.skipped}\n`)

    // Seed classes
    console.log('🏫 Seeding classes...')
    const classesResult = await seedData('classes', testClasses, 'id')
    console.log(`   ✅ Created: ${classesResult.success} | ⏭️  Skipped: ${classesResult.skipped}\n`)

    // Seed families
    console.log('👨‍👩‍👧‍👦 Seeding families...')
    const familiesResult = await seedData('families', testFamilies, 'family_code')
    console.log(`   ✅ Created: ${familiesResult.success} | ⏭️  Skipped: ${familiesResult.skipped}\n`)

    // Seed articles
    console.log('📰 Seeding articles...')
    const articlesResult = await seedData('articles', testArticles, 'article_order')
    console.log(`   ✅ Created: ${articlesResult.success} | ⏭️  Skipped: ${articlesResult.skipped}\n`)

    // Summary
    console.log('✅ Test data seeding complete!\n')
    console.log('📊 Summary:')
    console.log(`  - Newsletter weeks: ${weeksResult.success} created`)
    console.log(`  - Classes: ${classesResult.success} created`)
    console.log(`  - Families: ${familiesResult.success} created`)
    console.log(`  - Articles: ${articlesResult.success} created`)
    console.log('\n📝 Next steps:')
    console.log('  1. Run: npx ts-node scripts/setup-test-users.ts')
    console.log('  2. Sign in as parent1@example.com or parent2@example.com')
    console.log('  3. View articles for Week 47 to verify RLS visibility\n')

    console.log('🎯 Article Access Verification:')
    console.log('  parent1@example.com → 4 articles (2 public + 2 class-restricted)')
    console.log('  parent2@example.com → 3 articles (2 public + 1 class-restricted)')
    console.log('  admin@example.com → All 6 articles\n')
  } catch (err) {
    console.error('❌ Fatal error during seeding:', (err as any).message)
    process.exit(1)
  }
}

// Run the seeding
seedTestData()
