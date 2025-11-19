-- ============================================================================
-- User and Family Seeding Script
-- This script seeds test users and family relationships
-- Usage: docker exec -i supabase_db_email-cms psql -U postgres < scripts/seed-users.sql
-- ============================================================================

-- Disable RLS temporarily for seeding
ALTER TABLE public.newsletter_weeks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.families DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_enrollment DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_class_enrollment DISABLE ROW LEVEL SECURITY;

-- Clear existing data (dependent tables first)
DELETE FROM public.article_audit_log;
DELETE FROM public.teacher_class_assignment;
DELETE FROM public.child_class_enrollment;
DELETE FROM public.family_enrollment;
DELETE FROM public.articles;
DELETE FROM public.families;
DELETE FROM public.user_roles;
DELETE FROM public.classes;
DELETE FROM public.newsletter_weeks;

-- ============================================================================
-- Step 1: Seed Newsletter Weeks
-- ============================================================================
INSERT INTO public.newsletter_weeks (week_number, release_date, is_published) VALUES
('2025-W47', '2025-11-17', true),
('2025-W48', '2025-11-24', false),
('2025-W49', '2025-12-01', false);

-- ============================================================================
-- Step 2: Seed Classes
-- ============================================================================
INSERT INTO public.classes (id, class_name, class_grade_year) VALUES
('A1', 'Grade 1A (一年級甲班)', 1),
('A2', 'Grade 1B (一年級乙班)', 1),
('B1', 'Grade 2A (二年級甲班)', 2),
('B2', 'Grade 2B (二年級乙班)', 2);

-- ============================================================================
-- Step 3: Seed Articles
-- ============================================================================
INSERT INTO public.articles (week_number, title, content, author, article_order, is_published, visibility_type, restricted_to_classes) VALUES
('2025-W47', '週報開刊致詞 (Weekly Opening)', '# 歡迎閱讀本週電子報

Dear Parents and Students,

Welcome to Week 47 of our newsletter. This week we have exciting updates from all classes.

## Highlights
- School event announcements
- Academic updates
- Upcoming activities', 'Principal', 1, true, 'public', NULL),
('2025-W47', 'Grade 1A Class Updates', '# 一年級甲班班級大小事

This week in Grade 1A:
- Math: Introduction to addition
- Reading: New story time sessions
- Art: Seasonal craft projects', 'Ms. Chen', 2, true, 'class_restricted', '["A1"]'),
('2025-W47', 'Grade 1B Class Updates', '# 一年級乙班班級大小事

This week in Grade 1B:
- Music: Learning new songs
- PE: Team sports activities
- Science: Exploring nature', 'Mr. Wang', 3, true, 'class_restricted', '["A2"]'),
('2025-W47', 'Grade 2A Class Updates', '# 二年級甲班班級大小事

This week in Grade 2A:
- Multiplication basics
- Literature appreciation
- Field trip planning', 'Ms. Liu', 4, true, 'class_restricted', '["B1"]'),
('2025-W47', 'Grade 2B Class Updates', '# 二年級乙班班級大小事

This week in Grade 2B:
- Division practice
- Writing workshops
- Computer lab sessions', 'Mr. Lee', 5, true, 'class_restricted', '["B2"]'),
('2025-W47', 'Important Announcements', '# 重要公告

- Parent-teacher conferences scheduled for Nov 22-24
- School assembly next Monday
- Deadline for field trip permission slips: Nov 19', 'Admin', 6, true, 'public', NULL);

-- ============================================================================
-- Step 4: Seed User Roles (Parents and Children)
-- ============================================================================
INSERT INTO public.user_roles (id, email, role) VALUES
('11111111-1111-1111-1111-111111111111', 'parent1@example.com', 'parent'),
('22222222-2222-2222-2222-222222222222', 'parent2@example.com', 'parent'),
('33333333-3333-3333-3333-333333333333', 'parent3@example.com', 'parent'),
('55555555-5555-5555-5555-555555555555', 'child1@example.com', 'student'),
('66666666-6666-6666-6666-666666666666', 'child2@example.com', 'student'),
('77777777-7777-7777-7777-777777777777', 'child3@example.com', 'student');

-- ============================================================================
-- Step 5: Seed Families
-- ============================================================================
INSERT INTO public.families (id, family_code) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'FAMILY001'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'FAMILY002');

-- ============================================================================
-- Step 6: Seed Family Enrollment (Link Parents to Families)
-- ============================================================================
INSERT INTO public.family_enrollment (family_id, parent_id, relationship) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'father'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'mother');

-- ============================================================================
-- Step 7: Seed Child Class Enrollment
-- ============================================================================
INSERT INTO public.child_class_enrollment (child_id, family_id, class_id) VALUES
('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A1'),
('66666666-6666-6666-6666-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'B1'),
('77777777-7777-7777-7777-777777777777', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'A2');

-- ============================================================================
-- Re-enable RLS
-- ============================================================================
ALTER TABLE public.newsletter_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_enrollment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_class_enrollment ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Summary
-- ============================================================================
SELECT '✅ Database seeding completed!' as status;

SELECT
  (SELECT COUNT(*) FROM public.newsletter_weeks) as newsletter_weeks,
  (SELECT COUNT(*) FROM public.classes) as classes,
  (SELECT COUNT(*) FROM public.articles) as articles,
  (SELECT COUNT(*) FROM public.user_roles) as user_roles,
  (SELECT COUNT(*) FROM public.families) as families,
  (SELECT COUNT(*) FROM public.family_enrollment) as family_enrollments,
  (SELECT COUNT(*) FROM public.child_class_enrollment) as child_class_enrollments;
