-- ============================================
-- Email CMS - Supabase Database Migration
-- Complete passwordless authentication system with user management
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USER PROFILES TABLE (extends auth.users)
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'PARENT' CHECK (role IN ('ADMIN', 'CLASS_TEACHER', 'PARENT', 'STUDENT')),
  first_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  display_name VARCHAR(200),
  avatar_url TEXT,
  phone_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for profiles
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);

-- ============================================
-- 2. FAMILY SYSTEM TABLES
-- ============================================

-- Family table
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_name VARCHAR(100),
  address TEXT,
  primary_contact_email VARCHAR(255),
  primary_contact_phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Family members table
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('PARENT', 'CHILD')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  is_student BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_per_family UNIQUE (user_id)
);

CREATE INDEX idx_family_members_family_id ON public.family_members(family_id);
CREATE INDEX idx_family_members_user_id ON public.family_members(user_id);
CREATE INDEX idx_family_members_role ON public.family_members(role);

-- Parent-child relationships
CREATE TABLE IF NOT EXISTS public.parent_child_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  child_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL CHECK (
    relationship_type IN ('MOTHER', 'FATHER', 'GUARDIAN', 'STEPMOTHER', 'STEPFATHER', 'GRANDPARENT', 'OTHER')
  ),
  is_primary_guardian BOOLEAN DEFAULT false,
  can_receive_updates BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_parent_child UNIQUE (parent_member_id, child_member_id),
  CONSTRAINT different_parent_child CHECK (parent_member_id != child_member_id)
);

CREATE INDEX idx_pcr_parent_member_id ON public.parent_child_relationships(parent_member_id);
CREATE INDEX idx_pcr_child_member_id ON public.parent_child_relationships(child_member_id);

-- ============================================
-- 3. CLASS SYSTEM TABLES
-- ============================================

-- Classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,  -- Chinese zodiac name (e.g., "甲辰", "辛丑甲")
  current_grade INTEGER NOT NULL CHECK (current_grade >= 0 AND current_grade <= 12),
  start_year INTEGER NOT NULL,  -- Gregorian year when entered Grade 1
  description TEXT,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_class_per_start_year UNIQUE (name, start_year)
);

CREATE INDEX idx_classes_teacher_id ON public.classes(teacher_id);
CREATE INDEX idx_classes_start_year ON public.classes(start_year);
CREATE INDEX idx_classes_is_active ON public.classes(is_active);

-- Class memberships table
CREATE TABLE IF NOT EXISTS public.class_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  joined_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  left_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'GRADUATED')),
  transfer_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT left_date_required CHECK (
    (status = 'ACTIVE' AND left_date IS NULL) OR
    (status != 'ACTIVE' AND left_date IS NOT NULL)
  )
);

CREATE INDEX idx_class_memberships_student_id ON public.class_memberships(student_id);
CREATE INDEX idx_class_memberships_class_id ON public.class_memberships(class_id);
CREATE INDEX idx_class_memberships_status ON public.class_memberships(status);

-- CRITICAL: Ensure only ONE active membership per student
CREATE UNIQUE INDEX idx_one_active_membership_per_student
  ON public.class_memberships(student_id)
  WHERE status = 'ACTIVE';

-- ============================================
-- 4. NEWSLETTER & ARTICLES TABLES
-- ============================================

-- Newsletter weeks table
CREATE TABLE IF NOT EXISTS public.newsletter_weeks (
  week_number VARCHAR(20) PRIMARY KEY,  -- Format: "2025-W43"
  release_date TIMESTAMP WITH TIME ZONE NOT NULL,
  title VARCHAR(500),
  is_published BOOLEAN DEFAULT false,
  total_articles INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX idx_newsletter_weeks_release_date ON public.newsletter_weeks(release_date);
CREATE INDEX idx_newsletter_weeks_is_published ON public.newsletter_weeks(is_published);

-- Articles table (enhanced with class support)
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,  -- Markdown content
  author VARCHAR(200),
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary TEXT,
  week_number VARCHAR(20) REFERENCES public.newsletter_weeks(week_number) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  article_type VARCHAR(50) NOT NULL DEFAULT 'ALL_SCHOOL' CHECK (
    article_type IN ('ALL_SCHOOL', 'CLASS_NEWS', 'ANNOUNCEMENT', 'EVENT')
  ),
  article_order INTEGER NOT NULL,
  slug VARCHAR(200),
  public_url TEXT NOT NULL,
  is_published BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id),
  CONSTRAINT class_news_must_have_class CHECK (
    (article_type = 'CLASS_NEWS' AND class_id IS NOT NULL) OR
    (article_type != 'CLASS_NEWS')
  ),
  UNIQUE(week_number, article_order)
);

CREATE INDEX idx_articles_week_number ON public.articles(week_number);
CREATE INDEX idx_articles_class_id ON public.articles(class_id);
CREATE INDEX idx_articles_author_id ON public.articles(author_id);
CREATE INDEX idx_articles_article_type ON public.articles(article_type);
CREATE INDEX idx_articles_is_published ON public.articles(is_published);
CREATE INDEX idx_articles_published ON public.articles(is_published, week_number);

-- ============================================
-- 5. AUTHENTICATION AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email VARCHAR(255),
  event_type VARCHAR(50) NOT NULL,  -- 'login', 'logout', 'magic_link_sent', 'token_refresh', etc.
  auth_method VARCHAR(50),           -- 'google', 'magic_link'
  success BOOLEAN NOT NULL,
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_auth_audit_log_user_id ON public.auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_created_at ON public.auth_audit_log(created_at);
CREATE INDEX idx_auth_audit_log_event_type ON public.auth_audit_log(event_type);

-- ============================================
-- 6. TRIGGERS
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_members_updated_at BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pcr_updated_at BEFORE UPDATE ON public.parent_child_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_memberships_updated_at BEFORE UPDATE ON public.class_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_newsletter_weeks_updated_at BEFORE UPDATE ON public.newsletter_weeks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email_confirmed_at IS NOT NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_child_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Newsletter weeks policies
CREATE POLICY "Published newsletters are viewable by everyone"
  ON public.newsletter_weeks FOR SELECT
  USING (is_published = true OR auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'CLASS_TEACHER')
  ));

CREATE POLICY "Editors can insert newsletters"
  ON public.newsletter_weeks FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'CLASS_TEACHER')
  ));

CREATE POLICY "Editors can update newsletters"
  ON public.newsletter_weeks FOR UPDATE
  USING (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'CLASS_TEACHER')
  ));

-- Articles policies
CREATE POLICY "Published articles are viewable by everyone"
  ON public.articles FOR SELECT
  USING (is_published = true OR auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'CLASS_TEACHER')
  ));

CREATE POLICY "Editors can insert articles"
  ON public.articles FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'CLASS_TEACHER')
  ));

CREATE POLICY "Editors can update articles"
  ON public.articles FOR UPDATE
  USING (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'CLASS_TEACHER')
  ));

CREATE POLICY "Editors can delete articles"
  ON public.articles FOR DELETE
  USING (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'CLASS_TEACHER')
  ));

-- Classes policies
CREATE POLICY "Classes are viewable by all authenticated users"
  ON public.classes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can manage classes"
  ON public.classes FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'ADMIN'
  ));

-- Families policies
CREATE POLICY "Users can view their own family"
  ON public.families FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.family_members WHERE family_id = id
    ) OR
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'ADMIN'
    )
  );

-- ============================================
-- 9. SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert admin user profile (requires manual user creation in Supabase Auth first)
-- After creating auth user, update the UUID below and uncomment:
/*
INSERT INTO public.profiles (id, email, role, first_name, last_name, display_name, is_active, email_verified)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'admin@school.com', 'ADMIN', 'Admin', 'User', 'School Admin', true, true)
ON CONFLICT (id) DO NOTHING;
*/

-- Sample newsletter week
INSERT INTO public.newsletter_weeks (week_number, release_date, is_published, title)
VALUES ('2025-W43', '2025-10-27', true, '第43週電子報')
ON CONFLICT (week_number) DO NOTHING;

-- Sample all-school article
INSERT INTO public.articles (
  title, content, author, week_number, article_type, article_order, public_url, is_published
)
VALUES (
  '歡迎使用電子報系統',
  '# 歡迎\n\n這是一個示範文章。',
  '系統管理員',
  '2025-W43',
  'ALL_SCHOOL',
  1,
  '/articles/welcome',
  true
)
ON CONFLICT (week_number, article_order) DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
