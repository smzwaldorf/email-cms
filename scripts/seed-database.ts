/**
 * Database Seeding Script
 * Populates the Supabase database with sample data for development and testing
 *
 * Usage: npx ts-node scripts/seed-database.ts [--clean]
 *   --clean: Delete all data before seeding
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const shouldClean = process.argv.includes('--clean')

/**
 * Sample data generators
 */
const sampleData = {
  newsletterWeeks: [
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
  ],

  classes: [
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
  ],

  articles: [
    {
      week_number: '2025-W47',
      title: '週報開刊致詞 (Weekly Opening)',
      content: `# 歡迎閱讀本週電子報

Dear Parents and Students,

Welcome to Week 47 of our newsletter. This week we have exciting updates from all classes.

## Highlights
- School event announcements
- Academic updates
- Upcoming activities`,
      author: 'Principal',
      article_order: 1,
      is_published: true,
      visibility_type: 'public',
      created_by: null,
    },
    {
      week_number: '2025-W47',
      title: 'Grade 1A Class Updates',
      content: `# 一年級甲班班級大小事

This week in Grade 1A:
- Math: Introduction to addition
- Reading: New story time sessions
- Art: Seasonal craft projects`,
      author: 'Ms. Chen',
      article_order: 2,
      is_published: true,
      visibility_type: 'class_restricted',
      restricted_to_classes: ['A1'],
      created_by: null,
    },
    {
      week_number: '2025-W47',
      title: 'Grade 1B Class Updates',
      content: `# 一年級乙班班級大小事

This week in Grade 1B:
- Music: Learning new songs
- PE: Team sports activities
- Science: Exploring nature`,
      author: 'Mr. Wang',
      article_order: 3,
      is_published: true,
      visibility_type: 'class_restricted',
      restricted_to_classes: ['A2'],
      created_by: null,
    },
    {
      week_number: '2025-W47',
      title: 'Grade 2A Class Updates',
      content: `# 二年級甲班班級大小事

This week in Grade 2A:
- Multiplication basics
- Literature appreciation
- Field trip planning`,
      author: 'Ms. Liu',
      article_order: 4,
      is_published: true,
      visibility_type: 'class_restricted',
      restricted_to_classes: ['B1'],
      created_by: null,
    },
    {
      week_number: '2025-W47',
      title: 'Grade 2B Class Updates',
      content: `# 二年級乙班班級大小事

This week in Grade 2B:
- Division practice
- Writing workshops
- Computer lab sessions`,
      author: 'Mr. Lee',
      article_order: 5,
      is_published: true,
      visibility_type: 'class_restricted',
      restricted_to_classes: ['B2'],
      created_by: null,
    },
    {
      week_number: '2025-W47',
      title: 'Important Announcements',
      content: `# 重要公告

- Parent-teacher conferences scheduled for Nov 22-24
- School assembly next Monday
- Deadline for field trip permission slips: Nov 19`,
      author: 'Admin',
      article_order: 6,
      is_published: true,
      visibility_type: 'public',
      created_by: null,
    },
  ],
}

/**
 * Clean all data from tables
 */
async function cleanDatabase(): Promise<void> {
  console.log('🧹 Cleaning database...')

  const tables = [
    'article_audit_log',
    'teacher_class_assignment',
    'child_class_enrollment',
    'family_enrollment',
    'articles',
    'families',
    'user_roles',
    'classes',
    'newsletter_weeks',
  ]

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000').gt('id', '')

      if (error) {
        console.warn(`  ⚠️  Could not clean ${table}: ${error.message}`)
      } else {
        console.log(`  ✅ Cleaned ${table}`)
      }
    } catch (err) {
      console.warn(`  ⚠️  Error cleaning ${table}:`, err)
    }
  }
}

/**
 * Seed newsletter weeks
 */
async function seedNewsletterWeeks(): Promise<void> {
  console.log('\n📅 Seeding newsletter weeks...')

  const { data, error } = await supabase
    .from('newsletter_weeks')
    .insert(sampleData.newsletterWeeks)
    .select()

  if (error) {
    // If RLS policy blocks insert, provide helpful guidance
    if (error.message.includes('row-level security policy')) {
      console.warn('\n⚠️  Row-Level Security (RLS) is preventing inserts.')
      console.warn('To seed data in development, you have two options:\n')
      console.warn('Option 1: Disable RLS temporarily for development')
      console.warn('  1. Go to Supabase Dashboard > Authentication > Policies')
      console.warn('  2. Disable RLS for all tables')
      console.warn('  3. Run this script again')
      console.warn('  4. Re-enable RLS before deployment\n')
      console.warn('Option 2: Use service role key')
      console.warn('  1. Get SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard')
      console.warn('  2. Update scripts/seed-database.ts to use service role key\n')
      throw new Error('Cannot seed data: RLS policy blocks inserts. See instructions above.')
    }
    throw new Error(`Failed to seed newsletter weeks: ${error.message}`)
  }

  console.log(`  ✅ Created ${data?.length || 0} newsletter weeks`)
}

/**
 * Seed classes
 */
async function seedClasses(): Promise<void> {
  console.log('🏫 Seeding classes...')

  const { data, error } = await supabase
    .from('classes')
    .insert(sampleData.classes)
    .select()

  if (error) {
    throw new Error(`Failed to seed classes: ${error.message}`)
  }

  console.log(`  ✅ Created ${data?.length || 0} classes`)
}

/**
 * Seed articles
 */
async function seedArticles(): Promise<void> {
  console.log('📄 Seeding articles...')

  const { data, error } = await supabase
    .from('articles')
    .insert(sampleData.articles)
    .select()

  if (error) {
    throw new Error(`Failed to seed articles: ${error.message}`)
  }

  console.log(`  ✅ Created ${data?.length || 0} articles`)
}

/**
 * Main seeding routine
 */
async function seedDatabase(): Promise<void> {
  try {
    console.log('🌱 Starting database seeding...\n')
    console.log(`Database URL: ${supabaseUrl}`)
    console.log('━'.repeat(80))

    if (shouldClean) {
      await cleanDatabase()
    }

    await seedNewsletterWeeks()
    await seedClasses()
    await seedArticles()

    console.log('\n' + '━'.repeat(80))
    console.log('✅ Database seeding completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`  • ${sampleData.newsletterWeeks.length} newsletter weeks`)
    console.log(`  • ${sampleData.classes.length} classes`)
    console.log(`  • ${sampleData.articles.length} articles`)
    console.log('\n💡 Next steps:')
    console.log('  1. Run the app: npm run dev')
    console.log('  2. Navigate to http://localhost:5173')
    console.log('  3. View the weekly newsletter with sample data')
    console.log()
  } catch (err) {
    console.error('❌ Seeding failed:', err)
    process.exit(1)
  }
}

// Run seeding
seedDatabase()
