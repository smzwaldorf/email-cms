-- ============================================================================
-- CMS Database Schema: Email Newsletter with Class-Based Visibility
-- Version: 1.0.0
-- Feature: 002-database-structure
-- ============================================================================

-- Enable required extensions
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Core: Newsletter Weeks
-- ============================================================================

CREATE TABLE public.newsletter_weeks (
  week_number VARCHAR(10) PRIMARY KEY,  -- Format: "YYYY-Www" (e.g., "2025-W47")
  release_date DATE NOT NULL,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_week_number CHECK (week_number ~ '^\d{4}-W\d{2}$')
);

-- ============================================================================
-- Core: Classes (班級)
-- ============================================================================

CREATE TABLE public.classes (
  id VARCHAR(10) PRIMARY KEY,  -- e.g., "A1", "B2"
  class_name TEXT NOT NULL,
  class_grade_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_grade_year CHECK (class_grade_year BETWEEN 1 AND 12)
);

-- ============================================================================
-- Core: Articles (文章)
-- ============================================================================

CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number VARCHAR(10) NOT NULL REFERENCES public.newsletter_weeks(week_number) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author VARCHAR(100),
  article_order INTEGER NOT NULL,
  is_published BOOLEAN DEFAULT false,
  visibility_type VARCHAR(20) DEFAULT 'public' CHECK (visibility_type IN ('public', 'class_restricted')),
  restricted_to_classes JSONB,  -- Array of class IDs, e.g., ["A1", "B2"]
  created_by UUID,  -- Will reference auth.users in Supabase
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,  -- Soft-delete marker
  CONSTRAINT unique_order_per_week UNIQUE (week_number, article_order),
  CONSTRAINT class_restricted_validation CHECK (
    (visibility_type = 'class_restricted' AND restricted_to_classes IS NOT NULL AND jsonb_array_length(restricted_to_classes) > 0)
    OR visibility_type = 'public'
  )
);

-- ============================================================================
-- Access Control: Users (使用者)
-- Note: Primary user record in Supabase auth; this extends with roles
-- ============================================================================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY,  -- References auth.users
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'parent', 'student')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Access Control: Families (家庭)
-- ============================================================================

CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code VARCHAR(20) UNIQUE NOT NULL,  -- Enrollment code
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Access Control: Family Enrollment (家庭成員)
-- Maps parents to families
-- ============================================================================

CREATE TABLE public.family_enrollment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  relationship VARCHAR(20) NOT NULL CHECK (relationship IN ('father', 'mother', 'guardian')),
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_parent_per_family UNIQUE (family_id, parent_id)
);

-- ============================================================================
-- Access Control: Child Class Enrollment (兒童班級註冊)
-- Maps children to classes and families
-- ============================================================================

CREATE TABLE public.child_class_enrollment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  class_id VARCHAR(10) NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  graduated_at TIMESTAMP WITH TIME ZONE,  -- NULL = still enrolled
  CONSTRAINT unique_active_enrollment UNIQUE (child_id, class_id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT valid_enrollment_dates CHECK (enrolled_at <= graduated_at OR graduated_at IS NULL)
);

-- ============================================================================
-- Access Control: Teacher Class Assignment (教師班級分派)
-- Maps teachers to classes they can edit articles for
-- ============================================================================

CREATE TABLE public.teacher_class_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  class_id VARCHAR(10) NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_teacher_per_class UNIQUE (teacher_id, class_id)
);

-- ============================================================================
-- Audit Trail: Article Audit Log (文章審計日誌)
-- ============================================================================

CREATE TABLE public.article_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'publish', 'unpublish', 'delete')),
  changed_by UUID,  -- References auth.users
  old_values JSONB,  -- Previous field values
  new_values JSONB,  -- New field values
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Articles: Common queries by week and publication status
CREATE INDEX idx_articles_week_published
  ON public.articles(week_number, is_published, deleted_at, visibility_type);

-- Articles: Display order within week
CREATE INDEX idx_articles_order
  ON public.articles(week_number, article_order);

-- Articles: Find by creator (for edit permissions)
CREATE INDEX idx_articles_created_by
  ON public.articles(created_by);

-- Classes: Grade year sorting (for family multi-class viewing)
CREATE INDEX idx_classes_grade_year
  ON public.classes(class_grade_year DESC);

-- Teachers: Find classes a teacher can edit
CREATE INDEX idx_teacher_assignment_teacher
  ON public.teacher_class_assignment(teacher_id);

-- Children: Find all classes a child is enrolled in
CREATE INDEX idx_child_enrollment_child
  ON public.child_class_enrollment(child_id, graduated_at);

-- Children: Find all children in a family
CREATE INDEX idx_child_enrollment_family
  ON public.child_class_enrollment(family_id);

-- Families: Find by enrollment code
CREATE INDEX idx_families_code
  ON public.families(family_code);

-- Audit: Find all changes for an article
CREATE INDEX idx_audit_article_date
  ON public.article_audit_log(article_id, changed_at DESC);

-- ============================================================================
-- Triggers for Automatic Updates
-- ============================================================================

-- Auto-update articles.updated_at on modification
CREATE OR REPLACE FUNCTION public.update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_articles_updated_at();

-- Auto-update newsletter_weeks.updated_at
CREATE OR REPLACE FUNCTION public.update_weeks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_weeks_updated_at
  BEFORE UPDATE ON public.newsletter_weeks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_weeks_updated_at();

-- Auto-log article changes
CREATE OR REPLACE FUNCTION public.audit_article_changes()
RETURNS TRIGGER AS $$
DECLARE
  action_type VARCHAR(20);
  old_data JSONB;
  new_data JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type := 'create';
    old_data := NULL;
    new_data := row_to_json(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := 'update';
    old_data := row_to_json(OLD);
    new_data := row_to_json(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'delete';
    old_data := row_to_json(OLD);
    new_data := NULL;
  END IF;

  -- Log the change
  INSERT INTO public.article_audit_log (article_id, action, old_values, new_values, changed_by)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    action_type,
    old_data,
    new_data,
    COALESCE(NEW.created_by, OLD.created_by)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_article_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_article_changes();

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE public.newsletter_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_class_enrollment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_class_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_enrollment ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own role information
-- Note: RLS policies for user_roles are created in fix_user_roles_rls.sql migration
-- which uses the correct, flexible approach for authentication
CREATE POLICY user_roles_read_self
  ON public.user_roles FOR SELECT
  USING (auth.uid() IS NOT NULL AND id = auth.uid());

-- Allow authenticated users to read user roles (needed for auth system)
CREATE POLICY user_roles_read_authenticated
  ON public.user_roles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow public read of published newsletter weeks
-- Anyone can see published weeks
CREATE POLICY newsletter_weeks_read
  ON public.newsletter_weeks FOR SELECT
  USING (is_published = true);

-- Allow public read of published, non-deleted public articles
CREATE POLICY articles_public_read
  ON public.articles FOR SELECT
  USING (
    is_published = true
    AND deleted_at IS NULL
    AND visibility_type = 'public'
  );

-- Allow admins to read all published articles (both public and class-restricted)
-- Admins need full visibility of content they manage
CREATE POLICY articles_admin_read
  ON public.articles FOR SELECT
  USING (
    is_published = true
    AND deleted_at IS NULL
    AND (
      -- Check if current user is an admin
      auth.uid() IN (
        SELECT id FROM public.user_roles WHERE role = 'admin'
      )
    )
  );

-- Restrict class-restricted articles to parents with children in that class
-- Security model: Parent can read article IF:
--   1. Parent is in a family (family_enrollment.parent_id)
--   2. That family has a child in the article's restricted class
--   3. The child is currently enrolled (graduated_at IS NULL)
--   4. The article is published and not soft-deleted
--
-- Note: Teachers can view all articles via application-layer permission checks.
-- RLS policy prioritizes parent access control. Fine-grained teacher permissions
-- (which specific classes they can teach) are enforced in the application.
CREATE POLICY articles_class_restricted_read
  ON public.articles FOR SELECT
  USING (
    visibility_type = 'class_restricted'
    AND is_published = true
    AND deleted_at IS NULL
    AND auth.uid() IN (
      SELECT fe.parent_id
      FROM family_enrollment fe
      JOIN child_class_enrollment cce ON fe.family_id = cce.family_id,
      LATERAL jsonb_array_elements(articles.restricted_to_classes) class_elem
      WHERE TRIM(class_elem::text, '"') = cce.class_id
        AND cce.graduated_at IS NULL  -- Only active enrollments
    )
  );

-- Allow admins to update articles
-- Only authenticated admins can update articles
CREATE POLICY articles_admin_update
  ON public.articles FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Allow admins to delete articles
-- Only authenticated admins can delete (soft-delete) articles
CREATE POLICY articles_admin_delete
  ON public.articles FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Allow reading family enrollment relationships

-- 1. Create a secure helper function to get the current user's family IDs
-- This function runs with the privileges of the creator (SECURITY DEFINER),
-- allowing it to bypass RLS on the family_enrollment table to avoid recursion.
CREATE OR REPLACE FUNCTION public.get_auth_user_family_ids()
RETURNS TABLE (family_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT family_id
  FROM public.family_enrollment
  WHERE parent_id = auth.uid()
$$;

-- 2. Update the family_enrollment RLS policy to use the helper function
CREATE POLICY family_enrollment_read_secure
  ON public.family_enrollment FOR SELECT
  USING (
    -- Admin Check
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
    OR
    -- Family Member Check (using secure function to avoid recursion)
    family_id IN (
      SELECT family_id FROM public.get_auth_user_family_ids()
    )
  );


-- Allow reading child class enrollment relationships
CREATE POLICY child_class_enrollment_read
  ON public.child_class_enrollment FOR SELECT
  USING (true);

-- All users can read class information
CREATE POLICY classes_all_read
  ON public.classes FOR SELECT
  USING (true);

-- Allow audit log insertion during article changes (triggered by audit function)
-- This is needed to allow the audit trigger to insert when articles are updated
-- The audit trigger runs as the table owner, so we allow all inserts
CREATE POLICY article_audit_log_insert
  ON public.article_audit_log FOR INSERT
  WITH CHECK (true);

-- Allow reading audit logs (for audit trails)
CREATE POLICY article_audit_log_read
  ON public.article_audit_log FOR SELECT
  USING (true);

-- ============================================================================
-- Note: Sample data is seeded via CLI scripts (scripts/seed-test-data.ts) for development only.
-- Migrations contain only schema definition, not test data.
