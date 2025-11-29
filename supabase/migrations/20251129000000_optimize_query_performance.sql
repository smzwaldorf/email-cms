-- ============================================================================
-- Query Performance Optimization
-- Version: 1.0.0
-- Feature: 003-passwordless-auth (Phase 12 - Optimization & Polish)
-- ============================================================================
-- This migration adds indexes and optimizations to improve database query
-- performance, particularly for authentication, RBAC, and article queries.
--
-- Performance improvements from this migration:
-- 1. Indexed role lookups for RLS policy evaluation (user_roles table)
-- 2. Filtered indexes for auth_events suspicious activity detection
-- 3. Composite indexes for common query patterns
-- 4. Partial indexes for active enrollments only
--
-- Estimated impact:
-- - 10-30ms improvement for article list queries
-- - 5-15ms improvement for auth event queries
-- - 5-10ms improvement for RLS policy evaluation
-- ============================================================================

-- ============================================================================
-- Priority 1: Missing Indexes for RLS Policy Evaluation
-- ============================================================================

-- Index for admin/role-based RLS policies
-- Used by: articles_admin_read, articles_teacher_update policies
-- Query pattern: SELECT id FROM user_roles WHERE role = 'admin'
CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON public.user_roles(role);

COMMENT ON INDEX idx_user_roles_role IS
'Optimizes RLS policy evaluation for role-based access control. Supports fast admin/teacher role lookups when filtering articles.';

-- ============================================================================
-- Priority 2: Composite Indexes for Common Query Patterns
-- ============================================================================

-- Index for teacher class assignment lookups (used in RLS policy for restricted articles)
-- Query pattern: SELECT tca.* FROM teacher_class_assignment tca WHERE teacher_id = ? AND class_id = ?
CREATE INDEX IF NOT EXISTS idx_teacher_assignment_teacher_class
  ON public.teacher_class_assignment(teacher_id, class_id);

COMMENT ON INDEX idx_teacher_assignment_teacher_class IS
'Composite index for RLS policy evaluation when checking if teacher can access class-restricted articles.';

-- Index for article queries by creator and week
-- Query pattern: SELECT * FROM articles WHERE created_by = ? AND week_number = ?
CREATE INDEX IF NOT EXISTS idx_articles_created_by_week
  ON public.articles(created_by, week_number)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_articles_created_by_week IS
'Optimizes queries for fetching articles created by a specific user in a specific week (article editor).';

-- Index for active child class enrollments (excluding graduated students)
-- Query pattern: SELECT * FROM child_class_enrollment WHERE family_id = ? AND graduated_at IS NULL
CREATE INDEX IF NOT EXISTS idx_child_enrollment_family_active
  ON public.child_class_enrollment(family_id, class_id)
  WHERE graduated_at IS NULL;

COMMENT ON INDEX idx_child_enrollment_family_active IS
'Partial index for active enrollments only. Optimizes family view queries and RLS policy evaluation for parents.';

-- ============================================================================
-- Priority 3: Filtered Indexes for Auth Event Queries
-- ============================================================================

-- Index for suspicious activity detection (failed login counts)
-- Query pattern: SELECT user_id FROM auth_events WHERE event_type = 'login_failure' AND created_at > ?
CREATE INDEX IF NOT EXISTS idx_auth_events_user_failures_time
  ON public.auth_events(user_id, created_at DESC)
  WHERE event_type = 'login_failure';

COMMENT ON INDEX idx_auth_events_user_failures_time IS
'Filtered index for efficient detection of failed login attempts. Used for rate limiting and suspicious activity detection.';

-- Index for magic link token verification
-- Query pattern: SELECT * FROM auth_events WHERE event_type IN ('magic_link_sent', 'magic_link_verified') AND user_id = ? AND created_at > ?
CREATE INDEX IF NOT EXISTS idx_auth_events_magic_link_user
  ON public.auth_events(user_id, created_at DESC)
  WHERE event_type IN ('magic_link_sent', 'magic_link_verified');

COMMENT ON INDEX idx_auth_events_magic_link_user IS
'Filtered index for magic link auth flow tracking. Supports audit log queries for users who authenticated via magic link.';

-- ============================================================================
-- Optional: Statistics Update for Query Planner
-- ============================================================================

-- Force statistics refresh on newly indexed tables
-- This helps PostgreSQL query planner make better optimization decisions
ANALYZE public.user_roles;
ANALYZE public.teacher_class_assignment;
ANALYZE public.articles;
ANALYZE public.child_class_enrollment;
ANALYZE public.auth_events;

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON TABLE public.auth_events IS
'Authentication event audit log with optimized indexes for common queries including user history, failed login detection, and auth method analytics.';

COMMENT ON TABLE public.user_roles IS
'User roles lookup table with optimized indexes for role-based RLS policy evaluation and admin dashboard queries.';

COMMENT ON TABLE public.child_class_enrollment IS
'Child class enrollment tracking with partial indexes optimized for active enrollments (graduated_at IS NULL) to reduce query scope.';
