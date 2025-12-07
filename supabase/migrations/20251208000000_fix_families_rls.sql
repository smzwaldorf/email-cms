-- ============================================================================
-- Fix: Missing RLS Policies for Families Table
-- Task: Debug Class Analytics
-- ============================================================================

-- The 'families' table had RLS enabled but no policies, causing all reads to fail (default deny).
-- This prevented the Analytics Aggregator from joining family data to identify classes.

-- 1. Admin: View all families
CREATE POLICY families_admin_read
  ON public.families FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- 2. Parents: View their own family
CREATE POLICY families_parent_read
  ON public.families FOR SELECT
  USING (
    id IN (
      SELECT family_id FROM public.family_enrollment
      WHERE parent_id = auth.uid()
    )
  );
