-- ============================================================================
-- Complete Test Data Seed
-- Initializes all test data for authentication and article visibility testing
--
-- This migration sets up:
-- 1. Newsletter weeks (W47, W48, W49)
-- 2. Classes (A1, A2, B1, B2)
-- 3. Families (FAMILY001, FAMILY002)
-- 4. Articles with class-based visibility
-- 5. Demonstrates RLS policies for parent article access
-- ============================================================================

-- ============================================================================
-- Newsletter Weeks (Weekly containers for articles)
-- ============================================================================

-- Insert test weeks if not already present
INSERT INTO public.newsletter_weeks (week_number, release_date, is_published)
VALUES
  ('2025-W47', '2025-11-17', true),
  ('2025-W48', '2025-11-24', false),
  ('2025-W49', '2025-12-01', false)
ON CONFLICT (week_number) DO NOTHING;

-- ============================================================================
-- Classes (Grade levels and class groups)
-- ============================================================================

-- Insert classes if not already present
INSERT INTO public.classes (id, class_name, class_grade_year)
VALUES
  ('A1', 'Grade 1A (一年級甲班)', 1),
  ('A2', 'Grade 1B (一年級乙班)', 1),
  ('B1', 'Grade 2A (二年級甲班)', 2),
  ('B2', 'Grade 2B (二年級乙班)', 2)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Families (Parent household units)
-- ============================================================================

-- Insert test families
INSERT INTO public.families (id, family_code)
VALUES
  ('f1111111-1111-1111-1111-111111111111', 'FAMILY001'),
  ('f2222222-2222-2222-2222-222222222222', 'FAMILY002')
ON CONFLICT (family_code) DO NOTHING;

-- ============================================================================
-- Articles (Weekly newsletter content with visibility rules)
-- ============================================================================

-- Insert articles for W47 if not already present
INSERT INTO public.articles (
  week_number,
  title,
  content,
  author,
  article_order,
  is_published,
  visibility_type,
  restricted_to_classes
)
VALUES
  -- Public articles visible to everyone
  (
    '2025-W47',
    '週報開刊致詞 (Weekly Opening)',
    '# 歡迎閱讀本週電子報

Dear Parents and Students,

Welcome to Week 47 of our newsletter. This week we have exciting updates from all classes.

## Highlights
- School event announcements
- Academic updates
- Upcoming activities

---

**Published on:** 2025-11-17
**Week:** 2025-W47',
    'Principal',
    1,
    true,
    'public',
    NULL
  ),
  -- Class-restricted: Grade 1A only
  (
    '2025-W47',
    'Grade 1A Class Updates (一年級甲班班級大小事)',
    '# 一年級甲班班級大小事

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

**Note:** This article is visible only to parents with children in Grade 1A.',
    'Ms. Chen',
    2,
    true,
    'class_restricted',
    '["A1"]'
  ),
  -- Class-restricted: Grade 1B only
  (
    '2025-W47',
    'Grade 1B Class Updates (一年級乙班班級大小事)',
    '# 一年級乙班班級大小事

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

**Note:** This article is visible only to parents with children in Grade 1B.',
    'Mr. Wang',
    3,
    true,
    'class_restricted',
    '["A2"]'
  ),
  -- Class-restricted: Grade 2A only
  (
    '2025-W47',
    'Grade 2A Class Updates (二年級甲班班級大小事)',
    '# 二年級甲班班級大小事

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

**Note:** This article is visible only to parents with children in Grade 2A.',
    'Ms. Liu',
    4,
    true,
    'class_restricted',
    '["B1"]'
  ),
  -- Class-restricted: Grade 2B only
  (
    '2025-W47',
    'Grade 2B Class Updates (二年級乙班班級大小事)',
    '# 二年級乙班班級大小事

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

**Note:** This article is visible only to parents with children in Grade 2B.',
    'Mr. Lee',
    5,
    true,
    'class_restricted',
    '["B2"]'
  ),
  -- Public announcement
  (
    '2025-W47',
    'Important Announcements (重要公告)',
    '# 重要公告 - Important Announcements

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
- **Details:** Check your child''s backpack for forms
- **Questions:** Contact the main office

### Holiday Celebration Planning
- School holiday party: December 19
- Student performances, games, and refreshments
- Family invitation event

---

**Visibility:** This article is visible to all parents and visitors.',
    'Admin',
    6,
    true,
    'public',
    NULL
  )
ON CONFLICT (week_number, article_order) DO NOTHING;

-- ============================================================================
-- Test Data Documentation
-- ============================================================================

-- After running setup-test-users.ts script, the following test users will exist:

-- USER 1: parent1@example.com
-- Email: parent1@example.com
-- Password: parent1password123
-- Role: parent
-- Family: FAMILY001 (f1111111-1111-1111-1111-111111111111)
-- Children in Classes: A1, B1
--
-- Articles Visible for parent1 in Week 47:
-- 1. Weekly Opening (public) ✓
-- 2. Grade 1A Class Updates (A1) ✓
-- 3. Grade 2A Class Updates (B1) ✓
-- 4. Important Announcements (public) ✓
-- Total: 4 articles (2 public + 2 class-restricted)

-- USER 2: parent2@example.com
-- Email: parent2@example.com
-- Password: parent2password123
-- Role: parent
-- Family: FAMILY002 (f2222222-2222-2222-2222-222222222222)
-- Children in Classes: A2
--
-- Articles Visible for parent2 in Week 47:
-- 1. Weekly Opening (public) ✓
-- 2. Grade 1B Class Updates (A2) ✓
-- 3. Important Announcements (public) ✓
-- Total: 3 articles (2 public + 1 class-restricted)

-- USER 3: admin@example.com
-- Email: admin@example.com
-- Password: admin123456
-- Role: admin
-- Visibility: All articles (6/6)

-- ============================================================================
-- Testing the Setup
-- ============================================================================

-- To test the login flow:
-- 1. Run setup-test-users.ts to create auth users and family enrollments
-- 2. Sign in as parent1@example.com to see 4 articles
-- 3. Sign in as parent2@example.com to see 3 articles
-- 4. Sign out and verify only public articles are visible
-- 5. Run: npm test -- tests/e2e/authentication-flow.test.ts --run
