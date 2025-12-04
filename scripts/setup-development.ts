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
 *
 * harryworld@gmail.com (Google Sign In):
 *   - Password: harrypassword123
 *   - Family: FAMILY001 (Same as parent1)
 *   - Articles visible: 4 (Same as parent1)
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
    is_published: true,
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
    short_id: 'a00001',
    title: '週報開刊致詞 (Weekly Opening)',
    content: `<h1>歡迎閱讀本週電子報</h1>
<p>Dear Parents and Students,</p>
<p>Welcome to Week 47 of our newsletter. This week we have exciting updates from all classes.</p>
<h2>Highlights</h2>
<ul>
<li>School event announcements</li>
<li>Academic updates</li>
<li>Upcoming activities</li>
</ul>
<hr>
<p><strong>Published on:</strong> 2025-11-17<br>
<strong>Week:</strong> 2025-W47</p>`,
    author: 'Principal',
    article_order: 1,
    is_published: true,
    visibility_type: 'public',
    restricted_to_classes: null,
  },
  {
    week_number: '2025-W47',
    short_id: 'a00002',
    title: 'Grade 1A Class Updates (一年級甲班班級大小事)',
    content: `<h1>一年級甲班班級大小事</h1>
<p>This week in Grade 1A:</p>
<h2>Academic Updates</h2>
<ul>
<li><strong>Math:</strong> Introduction to addition and subtraction</li>
<li><strong>Reading:</strong> New story time sessions every afternoon</li>
<li><strong>Art:</strong> Seasonal craft projects with fall themes</li>
</ul>
<h2>Activities</h2>
<ul>
<li>Class field trip to local museum (Nov 22)</li>
<li>Show and tell event (Nov 24)</li>
<li>Parent-teacher conference (Nov 23 at 3:00 PM)</li>
</ul>
<h2>Homework</h2>
<ul>
<li>Math worksheets (30 minutes)</li>
<li>Reading journal entries (2 pages)</li>
</ul>
<p><strong>Note:</strong> This article is visible only to parents with children in Grade 1A.</p>`,
    author: 'Ms. Chen',
    article_order: 2,
    is_published: true,
    visibility_type: 'class_restricted',
    restricted_to_classes: ['A1'],
  },
  {
    week_number: '2025-W47',
    short_id: 'a00003',
    title: 'Grade 1B Class Updates (一年級乙班班級大小事)',
    content: `<h1>一年級乙班班級大小事</h1>
<p>This week in Grade 1B:</p>
<h2>Academic Updates</h2>
<ul>
<li><strong>Music:</strong> Learning new songs and instruments</li>
<li><strong>PE:</strong> Team sports activities and cooperative games</li>
<li><strong>Science:</strong> Exploring nature and seasons</li>
</ul>
<h2>Class Events</h2>
<ul>
<li>Music performance practice (Friday)</li>
<li>Sports day competition (upcoming)</li>
<li>Class election for student council</li>
</ul>
<h2>Important Dates</h2>
<ul>
<li>Parent conference: Nov 23 at 2:00 PM</li>
<li>Holiday celebration: Dec 15</li>
</ul>
<p><strong>Note:</strong> This article is visible only to parents with children in Grade 1B.</p>`,
    author: 'Mr. Wang',
    article_order: 3,
    is_published: true,
    visibility_type: 'class_restricted',
    restricted_to_classes: ['A2'],
  },
  {
    week_number: '2025-W47',
    short_id: 'a00004',
    title: 'Grade 2A Class Updates (二年級甲班班級大小事)',
    content: `<h1>二年級甲班班級大小事</h1>
<p>This week in Grade 2A:</p>
<h2>Learning Highlights</h2>
<ul>
<li><strong>Mathematics:</strong> Multiplication basics and strategies</li>
<li><strong>Literature:</strong> Classic story appreciation and discussion</li>
<li><strong>Social Studies:</strong> Community helpers and professions</li>
</ul>
<h2>Field Trip</h2>
<ul>
<li>Planned for Dec 5</li>
<li>Destination: Local nature preserve</li>
<li>Permission slips due: Nov 30</li>
</ul>
<h2>Student Achievements</h2>
<ul>
<li>Math competition scores announced</li>
<li>Science fair projects starting</li>
<li>Reading club selections announced</li>
</ul>
<p><strong>Note:</strong> This article is visible only to parents with children in Grade 2A.</p>`,
    author: 'Ms. Liu',
    article_order: 4,
    is_published: true,
    visibility_type: 'class_restricted',
    restricted_to_classes: ['B1'],
  },
  {
    week_number: '2025-W47',
    short_id: 'a00005',
    title: 'Grade 2B Class Updates (二年級乙班班級大小事)',
    content: `<h1>二年級乙班班級大小事</h1>
<p>This week in Grade 2B:</p>
<h2>Academic Focus</h2>
<ul>
<li><strong>Division Practice:</strong> Solving word problems</li>
<li><strong>Writing:</strong> Short story composition and editing</li>
<li><strong>Computer Lab:</strong> Introduction to typing and digital literacy</li>
</ul>
<h2>Upcoming Events</h2>
<ul>
<li>Technology showcase (Dec 10)</li>
<li>Writing workshop with guest author (Nov 28)</li>
<li>Computer skills assessment (Dec 1-5)</li>
</ul>
<h2>Reminders</h2>
<ul>
<li>Library books due Friday</li>
<li>Project submission deadline: next Thursday</li>
<li>Parent volunteer sign-up: please help with field trip</li>
</ul>
<p><strong>Note:</strong> This article is visible only to parents with children in Grade 2B.</p>`,
    author: 'Mr. Lee',
    article_order: 5,
    is_published: true,
    visibility_type: 'class_restricted',
    restricted_to_classes: ['B2'],
  },
  {
    week_number: '2025-W47',
    short_id: 'a00006',
    title: 'Important Announcements (重要公告)',
    content: `<h1>重要公告 - Important Announcements</h1>
<h2>School-Wide Updates</h2>
<h3>Parent-Teacher Conferences</h3>
<ul>
<li><strong>Dates:</strong> November 22-24, 2025</li>
<li><strong>Time:</strong> 1:00 PM - 5:00 PM each day</li>
<li><strong>Sign-up:</strong> See class teachers for time slots</li>
<li><strong>Location:</strong> Classroom and multipurpose room</li>
</ul>
<h3>School Assembly</h3>
<ul>
<li><strong>When:</strong> Monday, November 17 at 8:30 AM</li>
<li><strong>Where:</strong> Gymnasium</li>
<li><strong>Topic:</strong> Annual awards and recognition ceremony</li>
</ul>
<h3>Field Trip Permission Slips</h3>
<ul>
<li><strong>Deadline:</strong> November 19, 2025</li>
<li><strong>Details:</strong> Check your child's backpack for forms</li>
<li><strong>Questions:</strong> Contact the main office</li>
</ul>
<h3>Holiday Celebration Planning</h3>
<ul>
<li>School holiday party: December 19</li>
<li>Student performances, games, and refreshments</li>
<li>Family invitation event</li>
</ul>
<hr>
<p><strong>Visibility:</strong> This article is visible to all parents and visitors.</p>`,
    author: 'Admin',
    article_order: 6,
    is_published: true,
    visibility_type: 'public',
    restricted_to_classes: null,
  },
  // Week 2025-W48 Articles
  {
    week_number: '2025-W48',
    short_id: 'a00007',
    title: '週報開刊致詞 (Weekly Opening - Week 48)',
    content: `<h1>歡迎閱讀第 48 週電子報</h1>
<p>Dear Parents and Students,</p>
<p>Welcome to Week 48 of our newsletter. As we enter the final stretch before the holiday season, we want to share exciting updates from our school community.</p>
<h2>Holiday Season Planning</h2>
<ul>
<li>Thanksgiving celebration week (Nov 24-28)</li>
<li>Holiday performances planning (upcoming)</li>
<li>Winter break schedule announcement</li>
</ul>
<h2>Academic Updates</h2>
<ul>
<li>End of quarter assessments</li>
<li>Progress reports distribution</li>
<li>Achievement recognitions</li>
</ul>
<hr>
<p><strong>Published on:</strong> 2025-11-24<br>
<strong>Week:</strong> 2025-W48</p>`,
    author: 'Principal',
    article_order: 1,
    is_published: true,
    visibility_type: 'public',
    restricted_to_classes: null,
  },
  {
    week_number: '2025-W48',
    short_id: 'a00008',
    title: 'Thanksgiving Activities & Gratitude (感恩節活動)',
    content: `<h1>感恩節特別活動</h1>
<p>Dear Families,</p>
<p>This week we celebrate gratitude and thankfulness with special activities across all grades.</p>
<h2>Grade 1 Activities</h2>
<ul>
<li>Gratitude chain craft project</li>
<li>Thanksgiving story time</li>
<li>Food sharing day preparation</li>
</ul>
<h2>Grade 2 Activities</h2>
<ul>
<li>Community helpers appreciation event</li>
<li>Gratitude journal writing</li>
<li>Potluck celebration planning</li>
</ul>
<h2>Family Engagement</h2>
<ul>
<li>Share your gratitude: Send us your family's thankfulness message</li>
<li>Join us for the school-wide gratitude assembly on Friday at 10:00 AM</li>
<li>Bring dishes for the potluck: Sign-up sheet sent separately</li>
</ul>
<hr>
<p><strong>Note:</strong> All grades participating in special Thanksgiving programming.</p>`,
    author: 'Ms. Chen & Mr. Wang',
    article_order: 2,
    is_published: true,
    visibility_type: 'public',
    restricted_to_classes: null,
  },
  {
    week_number: '2025-W48',
    short_id: 'a00009',
    title: 'Winter Break Logistics & Holiday Closure',
    content: `<h1>冬季假期說明與校園關閉</h1>
<p>Dear Parents,</p>
<h2>Winter Break Schedule</h2>
<ul>
<li><strong>Last day of school:</strong> December 19, 2025</li>
<li><strong>Winter break:</strong> December 20, 2025 - January 4, 2026</li>
<li><strong>School resumes:</strong> January 5, 2026 (Monday)</li>
</ul>
<h2>Campus Closure</h2>
<ul>
<li>Administrative offices closed Dec 20 - Jan 4</li>
<li>Emergency contact for urgent matters: (123) 456-7890</li>
<li>All facilities closed except for scheduled maintenance</li>
</ul>
<h2>Before Holiday Break</h2>
<ul>
<li>Return all borrowed books and materials</li>
<li>Clear out lockers and cubbies</li>
<li>Take home all seasonal decorations and projects</li>
</ul>
<h2>Winter Break Activities (Optional)</h2>
<ul>
<li>Reading challenge: Log 10 hours of reading</li>
<li>Math practice: Complete learning packets (available online)</li>
<li>Art project: Create holiday greeting card for classmates</li>
</ul>
<hr>
<p><strong>Questions?</strong> Contact the main office by December 12.</p>`,
    author: 'Admin',
    article_order: 3,
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
  {
    email: 'harryworld@gmail.com',
    password: 'harrypassword123',
    role: 'parent',
    familyId: 'f1111111-1111-1111-1111-111111111111', // FAMILY001
  },
]

const testChildren = [
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    name: 'Child One',
    familyId: 'f1111111-1111-1111-1111-111111111111', // FAMILY001
    classId: 'A1', // Grade 1A
  },
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    name: 'Child Two',
    familyId: 'f1111111-1111-1111-1111-111111111111', // FAMILY001
    classId: 'B1', // Grade 2A
  },
  {
    id: 'c3333333-3333-3333-3333-333333333333',
    name: 'Child Three',
    familyId: 'f2222222-2222-2222-2222-222222222222', // FAMILY002
    classId: 'A2', // Grade 1B
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
        if (user.role === 'parent' && 'familyId' in user) {
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

          console.log(`  ✅ Family enrollment created\n`)
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
    // PHASE 3: Create Children & Enrollments
    // ========================================================================
    console.log('👶 PHASE 3: Creating children and enrollments\n')

    for (const child of testChildren) {
      try {
        console.log(`📝 Creating child: ${child.name}`)

        // Create child in students table
        const { error: studentError } = await supabase.from('students').insert({
          id: child.id,
          name: child.name,
        })

        if (studentError) {
          console.error(`  ❌ Student creation failed: ${studentError.message}`)
          continue
        }

        console.log(`  ✅ Student created`)

        // Create family enrollment for student
        const { error: familyError } = await supabase.from('family_enrollment').insert({
          family_id: child.familyId,
          student_id: child.id,
          relationship: 'child',
        })

        if (familyError) {
          console.error(`  ❌ Student family enrollment failed: ${familyError.message}`)
          continue
        }

        console.log(`  ✅ Student added to family`)

        // Create student class enrollment
        const { error: enrollError } = await supabase.from('student_class_enrollment').insert({
          student_id: child.id,
          family_id: child.familyId,
          class_id: child.classId,
        })

        if (enrollError) {
          console.error(`  ❌ Student class enrollment failed: ${enrollError.message}`)
          continue
        }

        console.log(`  ✅ Student enrolled in class: ${child.classId}\n`)
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
    console.log(`    - Articles: ${articlesResult.success} created
    - Children: ${testChildren.length} created`)
    console.log(`\n  Test Users:`)
    testUsers.forEach((user) => {
      if ('familyId' in user) {
        const userWithFamily = user as any
        console.log(`    - ${user.email} (Family: ${userWithFamily.familyId})`)
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
    console.log('  admin@example.com → All 6 articles (can edit all)')
    console.log('  harryworld@gmail.com → 4 articles (Same as parent1)\n')
  } catch (err) {
    console.error('❌ Fatal error during setup:', (err as any).message)
    process.exit(1)
  }
}

// Run the setup
setupDevelopment()
