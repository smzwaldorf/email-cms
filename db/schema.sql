-- Vanilla Postgres schema for email-cms.
-- Generated from the local Supabase public schema.
-- Stripped: auth.users FKs, RLS policies, Storage, auth-only RPCs.
-- Auth/OCID is out of scope; identity FKs point at public.user_roles(id).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET transaction_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

CREATE SCHEMA IF NOT EXISTS public;;

CREATE TYPE public.email_platform_provider AS ENUM (
    'kit'
);

CREATE TYPE public.email_platform_sync_job_status AS ENUM (
    'pending',
    'processing',
    'retryable',
    'succeeded',
    'failed',
    'dead_lettered'
);

CREATE TYPE public.email_platform_webhook_status AS ENUM (
    'received',
    'processing',
    'retryable',
    'processed',
    'unresolved',
    'failed',
    'dead_lettered'
);

CREATE TYPE public.media_file_type AS ENUM (
    'image',
    'audio',
    'video',
    'document'
);

CREATE TYPE public.media_reference_type AS ENUM (
    'inline',
    'embed',
    'attachment'
);

CREATE TYPE public.media_variant_status AS ENUM (
    'pending',
    'processing',
    'ready',
    'failed'
);

CREATE TYPE public.media_variant_type AS ENUM (
    'original',
    'thumbnail',
    'webp',
    'audio_optimized'
);

CREATE TYPE public.newsletter_delivery_audience_mode AS ENUM (
    'all',
    'classes',
    'families',
    'family'
);

CREATE TYPE public.newsletter_delivery_batch_state AS ENUM (
    'queued',
    'preparing',
    'sending',
    'completed',
    'completed_with_failures',
    'failed'
);

CREATE TYPE public.newsletter_delivery_eligibility_status AS ENUM (
    'eligible',
    'ineligible'
);

CREATE TYPE public.newsletter_delivery_preparation_status AS ENUM (
    'pending',
    'ready',
    'warning',
    'failed',
    'skipped'
);

CREATE TYPE public.newsletter_delivery_send_status AS ENUM (
    'pending',
    'handoff_pending',
    'sent',
    'failed',
    'skipped'
);

CREATE TYPE public.newsletter_delivery_trigger AS ENUM (
    'publish',
    'resend'
);

CREATE TYPE public.newsletter_subscription_status AS ENUM (
    'pending',
    'subscribed',
    'unsubscribed',
    'bounced',
    'complained'
);

CREATE TYPE public.storage_provider_type AS ENUM (
    'supabase',
    's3'
);

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.user_roles (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'student'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    display_name text,
    CONSTRAINT user_roles_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'teacher'::character varying, 'parent'::character varying, 'student'::character varying])::text[])))
);

COMMENT ON TABLE public.user_roles IS 'User roles lookup table with optimized indexes for role-based RLS policy evaluation and admin dashboard queries.';

CREATE TABLE public.user_auth_identities (
    issuer text NOT NULL,
    subject text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.user_auth_identities IS 'Stable OIDC issuer and subject links for application-local users. Email is used only to bootstrap an exact verified match.';

CREATE FUNCTION public.audit_article_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  action_type VARCHAR(20);
  old_data JSONB;
  new_data JSONB;
BEGIN
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
$$;

CREATE FUNCTION public.generate_short_id() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  chars TEXT := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE FUNCTION public.get_article_newsletters(p_article_id uuid) RETURNS TABLE(newsletter_id uuid, article_order integer, week_number character varying, title text, release_date date, status character varying)
    LANGUAGE sql STABLE
    AS $$
  SELECT 
    na.newsletter_id,
    na.article_order,
    n.week_number,
    n.title,
    n.release_date,
    n.status
  FROM public.newsletter_articles na
  JOIN public.newsletters n ON n.id = na.newsletter_id
  WHERE na.article_id = p_article_id
  ORDER BY n.release_date DESC;
$$;

COMMENT ON FUNCTION public.get_article_newsletters(p_article_id uuid) IS 'Returns all newsletters that contain a specific article, ordered by release date descending';

CREATE FUNCTION public.get_newsletter_articles(p_newsletter_id uuid) RETURNS TABLE(article_id uuid, article_order integer, title text, content text, author_id uuid, status character varying, created_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
  SELECT 
    a.id,
    na.article_order,
    a.title,
    a.content,
    a.author_id,
    a.status,
    a.created_at
  FROM public.newsletter_articles na
  JOIN public.articles a ON a.id = na.article_id
  WHERE na.newsletter_id = p_newsletter_id
    AND a.deleted_at IS NULL
  ORDER BY na.article_order ASC;
$$;

COMMENT ON FUNCTION public.get_newsletter_articles(p_newsletter_id uuid) IS 'Returns all articles in a newsletter ordered by their position';

CREATE FUNCTION public.set_article_short_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  new_short_id TEXT;
  done BOOLEAN := FALSE;
BEGIN
  IF NEW.short_id IS NULL THEN
    WHILE NOT done LOOP
      new_short_id := generate_short_id();
      IF NOT EXISTS (SELECT 1 FROM public.articles WHERE short_id = new_short_id) THEN
        NEW.short_id := new_short_id;
        done := TRUE;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.set_email_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.state = 'inactive' AND OLD.state <> 'inactive' THEN
    NEW.deactivated_at = COALESCE(NEW.deactivated_at, NOW());
  ELSIF NEW.state <> 'inactive' THEN
    NEW.deactivated_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.set_students_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.deactivated_at = COALESCE(NEW.deactivated_at, NOW());
  ELSIF NEW.is_active = true THEN
    NEW.deactivated_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_article_taxonomy_lifecycle_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_active = false AND (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    NEW.deactivated_at := COALESCE(NEW.deactivated_at, NOW());
  ELSIF NEW.is_active = true AND (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    NEW.deactivated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_class_lifecycle_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    NEW.deactivated_at = COALESCE(NEW.deactivated_at, NOW());
  ELSIF NEW.is_active = TRUE AND OLD.is_active = FALSE THEN
    NEW.deactivated_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_family_lifecycle_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_active = false AND (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    NEW.deactivated_at := COALESCE(NEW.deactivated_at, NOW());
  ELSIF NEW.is_active = true AND (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    NEW.deactivated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_primary_role_from_assignments() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  target_user_id UUID;
  resolved_role VARCHAR(20);
BEGIN
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  SELECT ura.role
  INTO resolved_role
  FROM public.user_role_assignments ura
  WHERE ura.user_id = target_user_id
  ORDER BY CASE ura.role
    WHEN 'admin' THEN 1
    WHEN 'teacher' THEN 2
    WHEN 'parent' THEN 3
    WHEN 'student' THEN 4
    ELSE 99
  END
  LIMIT 1;

  UPDATE public.user_roles
  SET
    role = COALESCE(resolved_role, 'student'),
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.sync_teacher_profile_lifecycle() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    NEW.deactivated_at = COALESCE(NEW.deactivated_at, NOW());
    NEW.status = 'disabled';
  ELSIF NEW.is_active = TRUE AND OLD.is_active = FALSE THEN
    NEW.deactivated_at = NULL;
    NEW.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_article_taxonomy_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_articles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_classes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_families_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_media_usage_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE media_files
    SET usage_count = usage_count + 1,
        referenced_articles = array_append(referenced_articles, NEW.article_id)
    WHERE id = NEW.media_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE media_files
    SET usage_count = usage_count - 1,
        referenced_articles = array_remove(referenced_articles, OLD.article_id)
    WHERE id = OLD.media_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE FUNCTION public.update_newsletters_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_teacher_profiles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_user_role_assignments_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE public.analytics_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    newsletter_id uuid,
    article_id uuid,
    session_id text,
    event_type character varying(50) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.analytics_events IS 'Raw event log for user actions (views, clicks, scrolls).';

CREATE TABLE public.analytics_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_date date NOT NULL,
    newsletter_id uuid,
    article_id uuid,
    class_id text,
    metric_name character varying(50) NOT NULL,
    metric_value numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.analytics_snapshots IS 'Daily aggregated metrics for dashboards to avoid expensive raw queries.';

CREATE TABLE public.article_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    action character varying(20) NOT NULL,
    changed_by uuid,
    old_values jsonb,
    new_values jsonb,
    changed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT article_audit_log_action_check CHECK (((action)::text = ANY ((ARRAY['create'::character varying, 'update'::character varying, 'publish'::character varying, 'unpublish'::character varying, 'delete'::character varying])::text[])))
);

CREATE TABLE public.article_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    CONSTRAINT article_categories_name_not_blank CHECK ((btrim(name) <> ''::text))
);

CREATE TABLE public.article_category_assignments (
    article_id uuid NOT NULL,
    category_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.article_media_references (
    article_id uuid NOT NULL,
    media_id uuid NOT NULL,
    reference_type public.media_reference_type DEFAULT 'inline'::public.media_reference_type NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.article_tag_assignments (
    article_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.article_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    CONSTRAINT article_tags_name_not_blank CHECK ((btrim(name) <> ''::text))
);

CREATE TABLE public.articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    author_id uuid,
    status character varying(20) DEFAULT 'draft'::character varying,
    visibility_type character varying(20) DEFAULT 'public'::character varying,
    restricted_to_classes jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    short_id character varying(10) NOT NULL,
    week_number character varying(10),
    author text,
    summary text,
    article_order integer,
    class_ids text[],
    family_ids uuid[],
    published_at timestamp with time zone,
    edited_at timestamp with time zone,
    last_edited_by uuid,
    deleted_by uuid,
    purge_scheduled_at timestamp with time zone,
    CONSTRAINT articles_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT articles_visibility_type_check CHECK (((visibility_type)::text = ANY ((ARRAY['public'::character varying, 'class_restricted'::character varying])::text[]))),
    CONSTRAINT class_restricted_validation CHECK (((((visibility_type)::text = 'class_restricted'::text) AND (restricted_to_classes IS NOT NULL) AND (jsonb_array_length(restricted_to_classes) > 0)) OR ((visibility_type)::text = 'public'::text)))
);

COMMENT ON COLUMN public.articles.week_number IS 'Legacy compatibility column retained for services still resolving newsletters by ISO week number.';

COMMENT ON COLUMN public.articles.article_order IS 'Legacy compatibility column retained for services still reading or writing per-newsletter order directly on articles.';

CREATE TABLE public.auth_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type character varying(30) NOT NULL,
    auth_method character varying(20),
    ip_address inet,
    user_agent text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT auth_events_auth_method_check CHECK (((auth_method)::text = ANY ((ARRAY['google_oauth'::character varying, 'magic_link'::character varying, 'email_password'::character varying])::text[]))),
    CONSTRAINT auth_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['login_success'::character varying, 'login_failure'::character varying, 'logout'::character varying, 'oauth_google_start'::character varying, 'oauth_google_success'::character varying, 'oauth_google_failure'::character varying, 'magic_link_sent'::character varying, 'magic_link_verified'::character varying, 'magic_link_expired'::character varying, 'token_refresh_success'::character varying, 'token_refresh_failure'::character varying, 'session_expired'::character varying])::text[])))
);

COMMENT ON TABLE public.auth_events IS 'Authentication event audit log with optimized indexes for common queries including user history, failed login detection, and auth method analytics.';

COMMENT ON COLUMN public.auth_events.event_type IS 'Type of authentication event. Used for filtering and analysis. Covers password login, OAuth, magic links, token management, and session lifecycle.';

COMMENT ON COLUMN public.auth_events.auth_method IS 'Authentication method used for this event. Identifies which auth flow was involved (password, Google OAuth, or magic link).';

COMMENT ON COLUMN public.auth_events.ip_address IS 'IP address of the request. NULL for client-side events (captured via user_agent instead). Server-side events can populate this field.';

COMMENT ON COLUMN public.auth_events.user_agent IS 'Browser/device user agent string. Primary identifier for device tracking since IP address is not available client-side.';

COMMENT ON COLUMN public.auth_events.metadata IS 'Additional event context as JSON. Examples: email for magic_link_sent, target_user_id for admin_force_logout, error details for failures.';

CREATE TABLE public.authorization_decision_trace (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action character varying(60) NOT NULL,
    winning_role character varying(20),
    resolved_scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    granted boolean NOT NULL,
    reason text NOT NULL,
    policy_version character varying(50) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.class_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id character varying(10) NOT NULL,
    action character varying(20) NOT NULL,
    actor_id uuid,
    prior_state jsonb,
    new_state jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT class_audit_log_action_check CHECK (((action)::text = ANY ((ARRAY['create'::character varying, 'update'::character varying, 'activate'::character varying, 'deactivate'::character varying])::text[])))
);

CREATE TABLE public.classes (
    id character varying(10) NOT NULL,
    class_name text NOT NULL,
    class_grade_year integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    class_code text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    deactivated_at timestamp with time zone,
    CONSTRAINT valid_grade_year CHECK (((class_grade_year >= 1) AND (class_grade_year <= 12)))
);

CREATE TABLE public.email_platform_subscriber_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_id uuid NOT NULL,
    provider public.email_platform_provider DEFAULT 'kit'::public.email_platform_provider NOT NULL,
    external_identity_key text NOT NULL,
    external_subscriber_id text,
    external_email_address text,
    provider_state text,
    last_synced_at timestamp with time zone,
    last_payload_fingerprint text,
    last_provider_version_marker text,
    last_reconciled_at timestamp with time zone,
    last_drift_reason text,
    sync_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.email_platform_subscription_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_id uuid NOT NULL,
    provider public.email_platform_provider DEFAULT 'kit'::public.email_platform_provider NOT NULL,
    mapping_id uuid,
    webhook_event_id uuid,
    old_status public.newsletter_subscription_status,
    new_status public.newsletter_subscription_status NOT NULL,
    source text NOT NULL,
    event_type text,
    occurred_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.email_platform_sync_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_id uuid,
    mapping_id uuid,
    provider public.email_platform_provider DEFAULT 'kit'::public.email_platform_provider NOT NULL,
    job_type text NOT NULL,
    status public.email_platform_sync_job_status DEFAULT 'pending'::public.email_platform_sync_job_status NOT NULL,
    enqueue_reason text DEFAULT 'unspecified'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    payload_fingerprint text,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    next_retry_at timestamp with time zone DEFAULT now() NOT NULL,
    processing_started_at timestamp with time zone,
    completed_at timestamp with time zone,
    dead_lettered_at timestamp with time zone,
    mismatch_reason text,
    last_error_code text,
    last_error_message text,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_platform_sync_jobs_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT email_platform_sync_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['upsert_subscriber'::text, 'reconcile_subscriber'::text, 'sync_newsletter_merge_properties'::text]))),
    CONSTRAINT email_platform_sync_jobs_max_attempts_check CHECK ((max_attempts > 0))
);

CREATE TABLE public.email_platform_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider public.email_platform_provider DEFAULT 'kit'::public.email_platform_provider NOT NULL,
    provider_event_id text NOT NULL,
    event_type text NOT NULL,
    delivery_key text NOT NULL,
    signature_valid boolean DEFAULT false NOT NULL,
    signature_failure_reason text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    payload_hash text NOT NULL,
    occurred_at timestamp with time zone,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    status public.email_platform_webhook_status DEFAULT 'received'::public.email_platform_webhook_status NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    next_retry_at timestamp with time zone DEFAULT now() NOT NULL,
    processing_started_at timestamp with time zone,
    processed_at timestamp with time zone,
    dead_lettered_at timestamp with time zone,
    resolved_family_id uuid,
    resolved_mapping_id uuid,
    unresolved_reason text,
    last_error_code text,
    last_error_message text,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_platform_webhook_events_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT email_platform_webhook_events_max_attempts_check CHECK ((max_attempts > 0))
);

CREATE TABLE public.email_template_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    revision_number integer NOT NULL,
    subject_template text NOT NULL,
    body_template text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT email_template_revisions_revision_number_check CHECK ((revision_number > 0))
);

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    state text DEFAULT 'draft'::text NOT NULL,
    current_revision_id uuid,
    deactivated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_templates_state_check CHECK ((state = ANY (ARRAY['draft'::text, 'active'::text, 'inactive'::text])))
);

CREATE TABLE public.families (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_code character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    family_name text,
    guardian_email text,
    description text,
    related_topics jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    newsletter_subscription_status public.newsletter_subscription_status DEFAULT 'pending'::public.newsletter_subscription_status NOT NULL,
    newsletter_subscription_source text,
    newsletter_subscription_updated_at timestamp with time zone,
    newsletter_subscribed_at timestamp with time zone,
    newsletter_unsubscribed_at timestamp with time zone
);

CREATE TABLE public.family_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_id uuid NOT NULL,
    action text NOT NULL,
    actor_id uuid,
    prior_state jsonb,
    new_state jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT family_audit_log_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'activate'::text, 'deactivate'::text, 'add_child'::text, 'remove_child'::text])))
);

CREATE TABLE public.family_enrollment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_id uuid NOT NULL,
    parent_id uuid,
    relationship character varying(20) NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now(),
    student_id uuid,
    CONSTRAINT family_enrollment_relationship_check CHECK (((relationship)::text = ANY ((ARRAY['father'::character varying, 'mother'::character varying, 'guardian'::character varying, 'child'::character varying, 'student'::character varying])::text[]))),
    CONSTRAINT family_member_check CHECK ((((parent_id IS NOT NULL) AND (student_id IS NULL)) OR ((parent_id IS NULL) AND (student_id IS NOT NULL))))
);

CREATE TABLE public.media_deletion_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_id uuid NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text NOT NULL,
    preflight_usage_count integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT media_deletion_audit_preflight_usage_count_check CHECK ((preflight_usage_count >= 0))
);

CREATE TABLE public.media_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    filename text NOT NULL,
    file_type public.media_file_type NOT NULL,
    mime_type text NOT NULL,
    file_size bigint NOT NULL,
    storage_path text NOT NULL,
    storage_provider public.storage_provider_type DEFAULT 'supabase'::public.storage_provider_type NOT NULL,
    public_url text NOT NULL,
    width integer,
    height integer,
    alt_text text,
    caption text,
    duration numeric,
    usage_count integer DEFAULT 0 NOT NULL,
    referenced_articles uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_files_duration_check CHECK ((duration > (0)::numeric)),
    CONSTRAINT media_files_file_size_check CHECK ((file_size > 0)),
    CONSTRAINT media_files_height_check CHECK ((height > 0)),
    CONSTRAINT media_files_usage_count_check CHECK ((usage_count >= 0)),
    CONSTRAINT media_files_width_check CHECK ((width > 0))
);

CREATE TABLE public.media_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    context_key text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone
);

CREATE TABLE public.media_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_id uuid NOT NULL,
    variant_type public.media_variant_type NOT NULL,
    format text NOT NULL,
    storage_path text,
    file_size bigint,
    width integer DEFAULT 0 NOT NULL,
    height integer DEFAULT 0 NOT NULL,
    duration numeric,
    status public.media_variant_status DEFAULT 'pending'::public.media_variant_status NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    error_message text,
    last_processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_variants_duration_check CHECK (((duration IS NULL) OR (duration > (0)::numeric))),
    CONSTRAINT media_variants_file_size_check CHECK (((file_size IS NULL) OR (file_size > 0))),
    CONSTRAINT media_variants_height_check CHECK ((height >= 0)),
    CONSTRAINT media_variants_retry_count_check CHECK ((retry_count >= 0)),
    CONSTRAINT media_variants_width_check CHECK ((width >= 0))
);

CREATE TABLE public.newsletter_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    newsletter_id uuid NOT NULL,
    article_id uuid NOT NULL,
    article_order integer NOT NULL,
    added_at timestamp with time zone DEFAULT now(),
    added_by uuid,
    targeting_mode text DEFAULT 'shared'::text NOT NULL,
    target_class_ids text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT newsletter_articles_targeting_consistency_check CHECK ((((targeting_mode = 'shared'::text) AND (cardinality(target_class_ids) = 0)) OR ((targeting_mode = 'targeted'::text) AND (cardinality(target_class_ids) > 0)))),
    CONSTRAINT newsletter_articles_targeting_mode_check CHECK ((targeting_mode = ANY (ARRAY['shared'::text, 'targeted'::text])))
);

COMMENT ON TABLE public.newsletter_articles IS 'Junction table enabling many-to-many relationship between newsletters and articles. Allows the same article to appear in multiple newsletters with different order positions.';

COMMENT ON COLUMN public.newsletter_articles.article_order IS 'Position of the article within this specific newsletter (1-based)';

CREATE TABLE public.newsletter_delivery_batch_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    family_id uuid NOT NULL,
    guardian_email text,
    eligibility_status public.newsletter_delivery_eligibility_status DEFAULT 'eligible'::public.newsletter_delivery_eligibility_status NOT NULL,
    preparation_status public.newsletter_delivery_preparation_status DEFAULT 'pending'::public.newsletter_delivery_preparation_status NOT NULL,
    send_status public.newsletter_delivery_send_status DEFAULT 'pending'::public.newsletter_delivery_send_status NOT NULL,
    failure_reason text,
    prepared_payload jsonb,
    provider_message_id text,
    provider_error text,
    last_attempted_at timestamp with time zone,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id uuid,
    parent_email text,
    journey_correlation_id text NOT NULL,
    preparation_findings jsonb DEFAULT '[]'::jsonb NOT NULL,
    kit_merge_sync_status text DEFAULT 'pending'::text NOT NULL,
    kit_merge_payload jsonb,
    kit_merge_payload_fingerprint text,
    kit_merge_provider_field_ids jsonb DEFAULT '{}'::jsonb NOT NULL,
    kit_merge_last_synced_at timestamp with time zone,
    kit_merge_provider_error text,
    campaign_ready boolean DEFAULT false NOT NULL,
    CONSTRAINT newsletter_delivery_batch_recipient_kit_merge_sync_status_check CHECK ((kit_merge_sync_status = ANY (ARRAY['pending'::text, 'skipped'::text, 'syncing'::text, 'synced'::text, 'failed'::text, 'drifted'::text])))
);

CREATE TABLE public.newsletter_delivery_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    newsletter_id uuid NOT NULL,
    trigger public.newsletter_delivery_trigger DEFAULT 'publish'::public.newsletter_delivery_trigger NOT NULL,
    audience_mode public.newsletter_delivery_audience_mode DEFAULT 'all'::public.newsletter_delivery_audience_mode NOT NULL,
    selected_class_ids text[] DEFAULT ARRAY[]::text[] NOT NULL,
    selected_family_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
    parent_batch_id uuid,
    state public.newsletter_delivery_batch_state DEFAULT 'queued'::public.newsletter_delivery_batch_state NOT NULL,
    pinned_newsletter_revision_id text NOT NULL,
    pinned_template_id uuid,
    pinned_template_revision_id uuid,
    recipient_snapshot_captured_at timestamp with time zone DEFAULT now() NOT NULL,
    rules_version text DEFAULT 'v1'::text NOT NULL,
    preparation_job_id text,
    total_recipients integer DEFAULT 0 NOT NULL,
    eligible_recipients integer DEFAULT 0 NOT NULL,
    ready_recipients integer DEFAULT 0 NOT NULL,
    sent_recipients integer DEFAULT 0 NOT NULL,
    failed_recipients integer DEFAULT 0 NOT NULL,
    invalid_recipients integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.newsletter_delivery_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    job_type text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    run_after timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    last_error text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT newsletter_delivery_jobs_job_type_check CHECK ((job_type = 'prepare_batch'::text)),
    CONSTRAINT newsletter_delivery_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text])))
);

CREATE TABLE public.newsletters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    week_number character varying(10),
    title text,
    description text,
    release_date date NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_template boolean DEFAULT false NOT NULL,
    CONSTRAINT newsletters_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT valid_week_number CHECK (((week_number IS NULL) OR ((week_number)::text ~ '^\d{4}-W\d{2}$'::text)))
);

CREATE TABLE public.permission_mutation_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    target_user_id uuid NOT NULL,
    action character varying(40) NOT NULL,
    before_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    after_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT permission_mutation_audit_log_action_check CHECK (((action)::text = ANY ((ARRAY['single_update'::character varying, 'bulk_update'::character varying, 'class_scope_update'::character varying])::text[])))
);

CREATE TABLE public.student_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    action text NOT NULL,
    actor_id uuid,
    prior_state jsonb,
    new_state jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_audit_log_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'activate'::text, 'deactivate'::text, 'add_class'::text, 'remove_class'::text, 'add_family'::text, 'remove_family'::text])))
);

CREATE TABLE public.student_class_enrollment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    family_id uuid NOT NULL,
    class_id character varying(10) NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now(),
    graduated_at timestamp with time zone,
    CONSTRAINT valid_enrollment_dates CHECK (((enrolled_at <= graduated_at) OR (graduated_at IS NULL)))
);

COMMENT ON TABLE public.student_class_enrollment IS 'Student class enrollment tracking with partial indexes optimized for active enrollments (graduated_at IS NULL) to reduce query scope.';

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    student_code text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deactivated_at timestamp with time zone
);

CREATE TABLE public.teacher_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    action character varying(20) NOT NULL,
    actor_id uuid,
    prior_state jsonb,
    new_state jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teacher_audit_log_action_check CHECK (((action)::text = ANY ((ARRAY['create'::character varying, 'update'::character varying, 'activate'::character varying, 'deactivate'::character varying])::text[])))
);

CREATE TABLE public.teacher_class_assignment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    class_id character varying(10) NOT NULL,
    assigned_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.teacher_profiles (
    user_id uuid NOT NULL,
    display_name text NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deactivated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teacher_profiles_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'disabled'::character varying])::text[])))
);

CREATE TABLE public.tracking_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    token_hash text NOT NULL,
    token_payload jsonb NOT NULL,
    is_revoked boolean DEFAULT false,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.tracking_tokens IS 'Stores JWT hashes/identifiers for validating email tracking links and magic entry.';

CREATE TABLE public.user_role_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_role_assignments_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'teacher'::character varying, 'parent'::character varying, 'student'::character varying])::text[])))
);

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_snapshot_date_newsletter_id_article_id__key UNIQUE (snapshot_date, newsletter_id, article_id, class_id, metric_name);

ALTER TABLE ONLY public.article_audit_log
    ADD CONSTRAINT article_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.article_categories
    ADD CONSTRAINT article_categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.article_category_assignments
    ADD CONSTRAINT article_category_assignments_pkey PRIMARY KEY (article_id, category_id);

ALTER TABLE ONLY public.article_media_references
    ADD CONSTRAINT article_media_references_pkey PRIMARY KEY (article_id, media_id);

ALTER TABLE ONLY public.article_tag_assignments
    ADD CONSTRAINT article_tag_assignments_pkey PRIMARY KEY (article_id, tag_id);

ALTER TABLE ONLY public.article_tags
    ADD CONSTRAINT article_tags_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_short_id_key UNIQUE (short_id);

ALTER TABLE ONLY public.auth_events
    ADD CONSTRAINT auth_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.authorization_decision_trace
    ADD CONSTRAINT authorization_decision_trace_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.student_class_enrollment
    ADD CONSTRAINT child_class_enrollment_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.class_audit_log
    ADD CONSTRAINT class_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_platform_subscriber_mappings
    ADD CONSTRAINT email_platform_subscriber_mappings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_platform_subscription_audit
    ADD CONSTRAINT email_platform_subscription_audit_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_platform_sync_jobs
    ADD CONSTRAINT email_platform_sync_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_platform_webhook_events
    ADD CONSTRAINT email_platform_webhook_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_template_revisions
    ADD CONSTRAINT email_template_revisions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_template_revisions
    ADD CONSTRAINT email_template_revisions_template_id_revision_number_key UNIQUE (template_id, revision_number);

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_family_code_key UNIQUE (family_code);

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.family_audit_log
    ADD CONSTRAINT family_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.family_enrollment
    ADD CONSTRAINT family_enrollment_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.media_deletion_audit
    ADD CONSTRAINT media_deletion_audit_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_storage_path_key UNIQUE (storage_path);

ALTER TABLE ONLY public.media_usage
    ADD CONSTRAINT media_usage_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.media_variants
    ADD CONSTRAINT media_variants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.newsletter_articles
    ADD CONSTRAINT newsletter_articles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.newsletter_delivery_batch_recipients
    ADD CONSTRAINT newsletter_delivery_batch_recipients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.newsletter_delivery_batches
    ADD CONSTRAINT newsletter_delivery_batches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.newsletter_delivery_jobs
    ADD CONSTRAINT newsletter_delivery_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.newsletters
    ADD CONSTRAINT newsletters_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.permission_mutation_audit_log
    ADD CONSTRAINT permission_mutation_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.student_audit_log
    ADD CONSTRAINT student_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.teacher_audit_log
    ADD CONSTRAINT teacher_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.teacher_class_assignment
    ADD CONSTRAINT teacher_class_assignment_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.teacher_profiles
    ADD CONSTRAINT teacher_profiles_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.tracking_tokens
    ADD CONSTRAINT tracking_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tracking_tokens
    ADD CONSTRAINT tracking_tokens_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.student_class_enrollment
    ADD CONSTRAINT unique_active_enrollment UNIQUE (student_id, class_id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.newsletter_articles
    ADD CONSTRAINT unique_article_per_newsletter UNIQUE (newsletter_id, article_id);

ALTER TABLE ONLY public.newsletter_articles
    ADD CONSTRAINT unique_order_per_newsletter UNIQUE (newsletter_id, article_order);

ALTER TABLE ONLY public.family_enrollment
    ADD CONSTRAINT unique_parent_per_family UNIQUE (family_id, parent_id);

ALTER TABLE ONLY public.teacher_class_assignment
    ADD CONSTRAINT unique_teacher_per_class UNIQUE (teacher_id, class_id);

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT unique_user_role_assignment UNIQUE (user_id, role);

ALTER TABLE ONLY public.newsletters
    ADD CONSTRAINT unique_week_number UNIQUE (week_number);

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_email_key UNIQUE (email);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_auth_identities
    ADD CONSTRAINT user_auth_identities_pkey PRIMARY KEY (issuer, subject);

ALTER TABLE ONLY public.user_auth_identities
    ADD CONSTRAINT user_auth_identities_user_issuer_key UNIQUE (user_id, issuer);

CREATE UNIQUE INDEX email_templates_single_active_idx ON public.email_templates USING btree (state) WHERE (state = 'active'::text);

CREATE INDEX idx_analytics_events_article ON public.analytics_events USING btree (article_id);

CREATE INDEX idx_analytics_events_created_at ON public.analytics_events USING btree (created_at DESC);

CREATE INDEX idx_analytics_events_newsletter ON public.analytics_events USING btree (newsletter_id);

CREATE INDEX idx_analytics_events_session ON public.analytics_events USING btree (session_id);

CREATE INDEX idx_analytics_events_type_time ON public.analytics_events USING btree (event_type, created_at DESC);

CREATE INDEX idx_analytics_events_user ON public.analytics_events USING btree (user_id);

CREATE INDEX idx_analytics_snapshots_class ON public.analytics_snapshots USING btree (class_id);

CREATE INDEX idx_analytics_snapshots_date ON public.analytics_snapshots USING btree (snapshot_date);

CREATE INDEX idx_analytics_snapshots_newsletter ON public.analytics_snapshots USING btree (newsletter_id);

CREATE UNIQUE INDEX idx_article_categories_active_name_unique ON public.article_categories USING btree (lower(name)) WHERE (is_active = true);

CREATE INDEX idx_article_category_assignments_article ON public.article_category_assignments USING btree (article_id);

CREATE INDEX idx_article_category_assignments_category ON public.article_category_assignments USING btree (category_id);

CREATE INDEX idx_article_media_article_id ON public.article_media_references USING btree (article_id);

CREATE INDEX idx_article_media_media_id ON public.article_media_references USING btree (media_id);

CREATE INDEX idx_article_tag_assignments_article ON public.article_tag_assignments USING btree (article_id);

CREATE INDEX idx_article_tag_assignments_tag ON public.article_tag_assignments USING btree (tag_id);

CREATE UNIQUE INDEX idx_article_tags_active_name_unique ON public.article_tags USING btree (lower(name)) WHERE (is_active = true);

CREATE INDEX idx_articles_author ON public.articles USING btree (author_id);

CREATE INDEX idx_articles_created_by ON public.articles USING btree (created_by);

CREATE INDEX idx_articles_created_by_status ON public.articles USING btree (created_by, status) WHERE (deleted_at IS NULL);

COMMENT ON INDEX public.idx_articles_created_by_status IS 'Optimizes queries for fetching articles created by a specific user, filtered by status (article editor, teacher dashboard).';

CREATE INDEX idx_articles_recycle_bin_schedule ON public.articles USING btree (deleted_at DESC, purge_scheduled_at) WHERE (deleted_at IS NOT NULL);

CREATE INDEX idx_articles_short_id ON public.articles USING btree (short_id);

CREATE INDEX idx_articles_status ON public.articles USING btree (status, deleted_at, visibility_type);

CREATE INDEX idx_audit_article_date ON public.article_audit_log USING btree (article_id, changed_at DESC);

CREATE INDEX idx_auth_events_failures ON public.auth_events USING btree (user_id, created_at DESC) WHERE ((event_type)::text = 'login_failure'::text);

CREATE INDEX idx_auth_events_magic_link_user ON public.auth_events USING btree (user_id, created_at DESC) WHERE ((event_type)::text = ANY ((ARRAY['magic_link_sent'::character varying, 'magic_link_verified'::character varying])::text[]));

COMMENT ON INDEX public.idx_auth_events_magic_link_user IS 'Filtered index for magic link auth flow tracking. Supports audit log queries for users who authenticated via magic link.';

CREATE INDEX idx_auth_events_method ON public.auth_events USING btree (auth_method, created_at DESC);

CREATE INDEX idx_auth_events_type ON public.auth_events USING btree (event_type, created_at DESC);

CREATE INDEX idx_auth_events_user_failures_time ON public.auth_events USING btree (user_id, created_at DESC) WHERE ((event_type)::text = 'login_failure'::text);

COMMENT ON INDEX public.idx_auth_events_user_failures_time IS 'Filtered index for efficient detection of failed login attempts. Used for rate limiting and suspicious activity detection.';

CREATE INDEX idx_auth_events_user_time ON public.auth_events USING btree (user_id, created_at DESC);

CREATE INDEX idx_authorization_decision_action_created_at ON public.authorization_decision_trace USING btree (action, created_at DESC);

CREATE INDEX idx_authorization_decision_created_at ON public.authorization_decision_trace USING btree (created_at DESC);

CREATE INDEX idx_class_audit_log_class_changed_at ON public.class_audit_log USING btree (class_id, changed_at DESC);

CREATE UNIQUE INDEX idx_classes_class_code_unique ON public.classes USING btree (lower(btrim(class_code)));

CREATE UNIQUE INDEX idx_classes_class_name_unique ON public.classes USING btree (lower(btrim(class_name)));

CREATE INDEX idx_classes_grade_year ON public.classes USING btree (class_grade_year DESC);

CREATE INDEX idx_classes_is_active ON public.classes USING btree (is_active, class_grade_year DESC, class_name);

CREATE INDEX idx_delivery_batches_newsletter_created ON public.newsletter_delivery_batches USING btree (newsletter_id, created_at DESC);

CREATE INDEX idx_delivery_batches_parent ON public.newsletter_delivery_batches USING btree (parent_batch_id);

CREATE INDEX idx_delivery_recipients_batch ON public.newsletter_delivery_batch_recipients USING btree (batch_id);

CREATE INDEX idx_delivery_recipients_batch_parent_email ON public.newsletter_delivery_batch_recipients USING btree (batch_id, COALESCE((parent_id)::text, ''::text), COALESCE(parent_email, ''::text));

CREATE INDEX idx_delivery_recipients_family ON public.newsletter_delivery_batch_recipients USING btree (family_id, created_at DESC);

CREATE INDEX idx_delivery_recipients_journey_correlation ON public.newsletter_delivery_batch_recipients USING btree (journey_correlation_id);

CREATE INDEX idx_delivery_recipients_kit_merge_fingerprint ON public.newsletter_delivery_batch_recipients USING btree (batch_id, kit_merge_payload_fingerprint) WHERE (kit_merge_payload_fingerprint IS NOT NULL);

CREATE INDEX idx_delivery_recipients_kit_merge_status ON public.newsletter_delivery_batch_recipients USING btree (batch_id, kit_merge_sync_status, campaign_ready);

CREATE UNIQUE INDEX idx_email_platform_mappings_external_identity ON public.email_platform_subscriber_mappings USING btree (provider, external_identity_key);

CREATE UNIQUE INDEX idx_email_platform_mappings_external_subscriber ON public.email_platform_subscriber_mappings USING btree (provider, external_subscriber_id) WHERE (external_subscriber_id IS NOT NULL);

CREATE UNIQUE INDEX idx_email_platform_mappings_family_provider ON public.email_platform_subscriber_mappings USING btree (provider, family_id);

CREATE INDEX idx_email_platform_mappings_reconciliation ON public.email_platform_subscriber_mappings USING btree (provider, last_reconciled_at, last_synced_at);

CREATE INDEX idx_email_platform_subscription_audit_family ON public.email_platform_subscription_audit USING btree (family_id, created_at DESC);

CREATE INDEX idx_email_platform_sync_jobs_family ON public.email_platform_sync_jobs USING btree (family_id, created_at DESC);

CREATE UNIQUE INDEX idx_email_platform_sync_jobs_pending_dedupe ON public.email_platform_sync_jobs USING btree (provider, COALESCE((family_id)::text, 'unknown-family'::text), job_type, COALESCE(payload_fingerprint, ''::text), status) WHERE (status = ANY (ARRAY['pending'::public.email_platform_sync_job_status, 'processing'::public.email_platform_sync_job_status, 'retryable'::public.email_platform_sync_job_status]));

CREATE INDEX idx_email_platform_sync_jobs_status_retry ON public.email_platform_sync_jobs USING btree (provider, status, next_retry_at);

CREATE UNIQUE INDEX idx_email_platform_webhook_delivery ON public.email_platform_webhook_events USING btree (provider, delivery_key);

CREATE INDEX idx_email_platform_webhooks_resolved_family ON public.email_platform_webhook_events USING btree (resolved_family_id, received_at DESC);

CREATE INDEX idx_email_platform_webhooks_status_retry ON public.email_platform_webhook_events USING btree (provider, status, next_retry_at);

CREATE INDEX idx_email_template_revisions_blocks_gin ON public.email_template_revisions USING gin (blocks);

CREATE INDEX idx_email_template_revisions_template_id ON public.email_template_revisions USING btree (template_id, revision_number DESC);

CREATE INDEX idx_email_templates_state ON public.email_templates USING btree (state);

CREATE UNIQUE INDEX idx_families_active_code_unique ON public.families USING btree (lower((family_code)::text)) WHERE (is_active = true);

CREATE UNIQUE INDEX idx_families_active_guardian_email_unique ON public.families USING btree (lower(guardian_email)) WHERE (is_active = true);

CREATE INDEX idx_families_code ON public.families USING btree (family_code);

CREATE INDEX idx_family_audit_log_family_changed_at ON public.family_audit_log USING btree (family_id, changed_at DESC);

CREATE INDEX idx_media_deletion_audit_media_id ON public.media_deletion_audit USING btree (media_id, deleted_at DESC);

CREATE INDEX idx_media_files_file_type ON public.media_files USING btree (file_type);

CREATE INDEX idx_media_files_storage_path ON public.media_files USING btree (storage_path);

CREATE INDEX idx_media_files_uploaded_at ON public.media_files USING btree (uploaded_at DESC);

CREATE INDEX idx_media_files_uploaded_by ON public.media_files USING btree (uploaded_by);

CREATE INDEX idx_media_usage_media_active ON public.media_usage USING btree (media_id, active);

CREATE INDEX idx_media_usage_target_active ON public.media_usage USING btree (target_type, target_id, active);

CREATE UNIQUE INDEX idx_media_usage_unique ON public.media_usage USING btree (media_id, target_type, target_id, context_key);

CREATE INDEX idx_media_variants_media_status ON public.media_variants USING btree (media_id, status);

CREATE UNIQUE INDEX idx_media_variants_unique_variant ON public.media_variants USING btree (media_id, variant_type, format, width, height);

CREATE INDEX idx_newsletter_articles_article ON public.newsletter_articles USING btree (article_id);

CREATE INDEX idx_newsletter_articles_newsletter ON public.newsletter_articles USING btree (newsletter_id);

CREATE INDEX idx_newsletter_articles_order ON public.newsletter_articles USING btree (newsletter_id, article_order);

CREATE INDEX idx_newsletter_articles_target_class_ids ON public.newsletter_articles USING gin (target_class_ids);

CREATE INDEX idx_newsletter_articles_targeting_mode ON public.newsletter_articles USING btree (newsletter_id, targeting_mode);

CREATE INDEX idx_newsletter_delivery_jobs_batch ON public.newsletter_delivery_jobs USING btree (batch_id);

CREATE INDEX idx_newsletter_delivery_jobs_status_run_after ON public.newsletter_delivery_jobs USING btree (status, run_after, created_at);

CREATE INDEX idx_newsletters_is_template ON public.newsletters USING btree (is_template, release_date DESC);

CREATE INDEX idx_permission_mutation_action_changed_at ON public.permission_mutation_audit_log USING btree (action, changed_at DESC);

CREATE INDEX idx_permission_mutation_target_changed_at ON public.permission_mutation_audit_log USING btree (target_user_id, changed_at DESC);

CREATE INDEX idx_student_enrollment_family ON public.student_class_enrollment USING btree (family_id);

CREATE INDEX idx_student_enrollment_family_active ON public.student_class_enrollment USING btree (family_id, class_id) WHERE (graduated_at IS NULL);

COMMENT ON INDEX public.idx_student_enrollment_family_active IS 'Partial index for active enrollments only. Optimizes family view queries and RLS policy evaluation for parents.';

CREATE INDEX idx_student_enrollment_student ON public.student_class_enrollment USING btree (student_id, graduated_at);

CREATE UNIQUE INDEX idx_students_code_active_unique ON public.students USING btree (student_code) WHERE (is_active = true);

CREATE UNIQUE INDEX idx_students_name_active_unique ON public.students USING btree (lower(btrim(name))) WHERE (is_active = true);

CREATE INDEX idx_teacher_assignment_teacher ON public.teacher_class_assignment USING btree (teacher_id);

CREATE INDEX idx_teacher_assignment_teacher_class ON public.teacher_class_assignment USING btree (teacher_id, class_id);

COMMENT ON INDEX public.idx_teacher_assignment_teacher_class IS 'Composite index for RLS policy evaluation when checking if teacher can access class-restricted articles.';

CREATE INDEX idx_teacher_audit_log_teacher_changed_at ON public.teacher_audit_log USING btree (teacher_id, changed_at DESC);

CREATE INDEX idx_teacher_profiles_status ON public.teacher_profiles USING btree (status, is_active, display_name);

CREATE INDEX idx_tracking_tokens_expiry ON public.tracking_tokens USING btree (expires_at);

CREATE INDEX idx_tracking_tokens_hash ON public.tracking_tokens USING btree (token_hash);

CREATE INDEX idx_tracking_tokens_user ON public.tracking_tokens USING btree (user_id);

CREATE INDEX idx_user_role_assignments_user_id ON public.user_role_assignments USING btree (user_id, role);

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);

CREATE INDEX idx_user_auth_identities_user_id ON public.user_auth_identities USING btree (user_id);

COMMENT ON INDEX public.idx_user_roles_role IS 'Optimizes RLS policy evaluation for role-based access control. Supports fast admin/teacher role lookups when filtering articles.';

CREATE TRIGGER trg_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.set_email_templates_updated_at();

CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_students_updated_at();

CREATE TRIGGER trigger_article_categories_lifecycle_timestamps BEFORE UPDATE ON public.article_categories FOR EACH ROW EXECUTE FUNCTION public.sync_article_taxonomy_lifecycle_timestamps();

CREATE TRIGGER trigger_article_categories_updated_at BEFORE UPDATE ON public.article_categories FOR EACH ROW EXECUTE FUNCTION public.update_article_taxonomy_updated_at();

CREATE TRIGGER trigger_article_tags_lifecycle_timestamps BEFORE UPDATE ON public.article_tags FOR EACH ROW EXECUTE FUNCTION public.sync_article_taxonomy_lifecycle_timestamps();

CREATE TRIGGER trigger_article_tags_updated_at BEFORE UPDATE ON public.article_tags FOR EACH ROW EXECUTE FUNCTION public.update_article_taxonomy_updated_at();

CREATE TRIGGER trigger_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_articles_updated_at();

CREATE TRIGGER trigger_audit_article_changes AFTER INSERT OR DELETE OR UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.audit_article_changes();

CREATE TRIGGER trigger_classes_lifecycle_timestamps BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.sync_class_lifecycle_timestamps();

CREATE TRIGGER trigger_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_classes_updated_at();

CREATE TRIGGER trigger_families_lifecycle_timestamps BEFORE UPDATE ON public.families FOR EACH ROW EXECUTE FUNCTION public.sync_family_lifecycle_timestamps();

CREATE TRIGGER trigger_families_updated_at BEFORE UPDATE ON public.families FOR EACH ROW EXECUTE FUNCTION public.update_families_updated_at();

CREATE TRIGGER trigger_newsletters_updated_at BEFORE UPDATE ON public.newsletters FOR EACH ROW EXECUTE FUNCTION public.update_newsletters_updated_at();

CREATE TRIGGER trigger_set_article_short_id BEFORE INSERT ON public.articles FOR EACH ROW EXECUTE FUNCTION public.set_article_short_id();

CREATE TRIGGER trigger_sync_primary_role_from_assignments AFTER INSERT OR DELETE OR UPDATE ON public.user_role_assignments FOR EACH ROW EXECUTE FUNCTION public.sync_primary_role_from_assignments();

CREATE TRIGGER trigger_teacher_profile_lifecycle BEFORE UPDATE ON public.teacher_profiles FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_profile_lifecycle();

CREATE TRIGGER trigger_teacher_profiles_updated_at BEFORE UPDATE ON public.teacher_profiles FOR EACH ROW EXECUTE FUNCTION public.update_teacher_profiles_updated_at();

CREATE TRIGGER trigger_update_media_usage_count AFTER INSERT OR DELETE ON public.article_media_references FOR EACH ROW EXECUTE FUNCTION public.update_media_usage_count();

CREATE TRIGGER trigger_user_role_assignments_updated_at BEFORE UPDATE ON public.user_role_assignments FOR EACH ROW EXECUTE FUNCTION public.update_user_role_assignments_updated_at();

CREATE TRIGGER update_email_platform_subscriber_mappings_updated_at BEFORE UPDATE ON public.email_platform_subscriber_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_platform_sync_jobs_updated_at BEFORE UPDATE ON public.email_platform_sync_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_platform_webhook_events_updated_at BEFORE UPDATE ON public.email_platform_webhook_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_media_files_updated_at BEFORE UPDATE ON public.media_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_media_usage_updated_at BEFORE UPDATE ON public.media_usage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_media_variants_updated_at BEFORE UPDATE ON public.media_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_newsletter_delivery_batch_recipients_updated_at BEFORE UPDATE ON public.newsletter_delivery_batch_recipients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_newsletter_delivery_batches_updated_at BEFORE UPDATE ON public.newsletter_delivery_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_newsletter_delivery_jobs_updated_at BEFORE UPDATE ON public.newsletter_delivery_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_newsletter_id_fkey FOREIGN KEY (newsletter_id) REFERENCES public.newsletters(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_newsletter_id_fkey FOREIGN KEY (newsletter_id) REFERENCES public.newsletters(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.article_category_assignments
    ADD CONSTRAINT article_category_assignments_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.article_category_assignments
    ADD CONSTRAINT article_category_assignments_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.article_categories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.article_media_references
    ADD CONSTRAINT article_media_references_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.article_media_references
    ADD CONSTRAINT article_media_references_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_files(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.article_tag_assignments
    ADD CONSTRAINT article_tag_assignments_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.article_tag_assignments
    ADD CONSTRAINT article_tag_assignments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.article_tags(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.user_roles(id);

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.user_roles(id);

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_last_edited_by_fkey FOREIGN KEY (last_edited_by) REFERENCES public.user_roles(id);

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_week_number_fkey FOREIGN KEY (week_number) REFERENCES public.newsletters(week_number) ON DELETE CASCADE;

ALTER TABLE ONLY public.auth_events
    ADD CONSTRAINT auth_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.authorization_decision_trace
    ADD CONSTRAINT authorization_decision_trace_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.student_class_enrollment
    ADD CONSTRAINT child_class_enrollment_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.student_class_enrollment
    ADD CONSTRAINT child_class_enrollment_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.class_audit_log
    ADD CONSTRAINT class_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.class_audit_log
    ADD CONSTRAINT class_audit_log_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_platform_subscriber_mappings
    ADD CONSTRAINT email_platform_subscriber_mappings_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_platform_subscription_audit
    ADD CONSTRAINT email_platform_subscription_audit_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_platform_subscription_audit
    ADD CONSTRAINT email_platform_subscription_audit_mapping_id_fkey FOREIGN KEY (mapping_id) REFERENCES public.email_platform_subscriber_mappings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_platform_subscription_audit
    ADD CONSTRAINT email_platform_subscription_audit_webhook_event_id_fkey FOREIGN KEY (webhook_event_id) REFERENCES public.email_platform_webhook_events(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_platform_sync_jobs
    ADD CONSTRAINT email_platform_sync_jobs_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_platform_sync_jobs
    ADD CONSTRAINT email_platform_sync_jobs_mapping_id_fkey FOREIGN KEY (mapping_id) REFERENCES public.email_platform_subscriber_mappings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_platform_webhook_events
    ADD CONSTRAINT email_platform_webhook_events_resolved_family_id_fkey FOREIGN KEY (resolved_family_id) REFERENCES public.families(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_platform_webhook_events
    ADD CONSTRAINT email_platform_webhook_events_resolved_mapping_id_fkey FOREIGN KEY (resolved_mapping_id) REFERENCES public.email_platform_subscriber_mappings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_template_revisions
    ADD CONSTRAINT email_template_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_template_revisions
    ADD CONSTRAINT email_template_revisions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_current_revision_fk FOREIGN KEY (current_revision_id) REFERENCES public.email_template_revisions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.family_audit_log
    ADD CONSTRAINT family_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.user_roles(id);

ALTER TABLE ONLY public.family_audit_log
    ADD CONSTRAINT family_audit_log_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.family_enrollment
    ADD CONSTRAINT family_enrollment_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.family_enrollment
    ADD CONSTRAINT family_enrollment_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.family_enrollment
    ADD CONSTRAINT family_enrollment_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.media_deletion_audit
    ADD CONSTRAINT media_deletion_audit_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.user_roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.media_usage
    ADD CONSTRAINT media_usage_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.media_usage
    ADD CONSTRAINT media_usage_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_files(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.media_variants
    ADD CONSTRAINT media_variants_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_files(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.newsletter_articles
    ADD CONSTRAINT newsletter_articles_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.user_roles(id);

ALTER TABLE ONLY public.newsletter_articles
    ADD CONSTRAINT newsletter_articles_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.newsletter_articles
    ADD CONSTRAINT newsletter_articles_newsletter_id_fkey FOREIGN KEY (newsletter_id) REFERENCES public.newsletters(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.newsletter_delivery_batch_recipients
    ADD CONSTRAINT newsletter_delivery_batch_recipients_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.newsletter_delivery_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.newsletter_delivery_batch_recipients
    ADD CONSTRAINT newsletter_delivery_batch_recipients_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.newsletter_delivery_batch_recipients
    ADD CONSTRAINT newsletter_delivery_batch_recipients_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.newsletter_delivery_batches
    ADD CONSTRAINT newsletter_delivery_batches_newsletter_id_fkey FOREIGN KEY (newsletter_id) REFERENCES public.newsletters(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.newsletter_delivery_batches
    ADD CONSTRAINT newsletter_delivery_batches_parent_batch_id_fkey FOREIGN KEY (parent_batch_id) REFERENCES public.newsletter_delivery_batches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.newsletter_delivery_jobs
    ADD CONSTRAINT newsletter_delivery_jobs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.newsletter_delivery_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.permission_mutation_audit_log
    ADD CONSTRAINT permission_mutation_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.permission_mutation_audit_log
    ADD CONSTRAINT permission_mutation_audit_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_audit_log
    ADD CONSTRAINT student_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.student_audit_log
    ADD CONSTRAINT student_audit_log_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_class_enrollment
    ADD CONSTRAINT student_class_enrollment_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.teacher_audit_log
    ADD CONSTRAINT teacher_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.teacher_audit_log
    ADD CONSTRAINT teacher_audit_log_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.teacher_class_assignment
    ADD CONSTRAINT teacher_class_assignment_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.teacher_class_assignment
    ADD CONSTRAINT teacher_class_assignment_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.teacher_profiles
    ADD CONSTRAINT teacher_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tracking_tokens
    ADD CONSTRAINT tracking_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_auth_identities
    ADD CONSTRAINT user_auth_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;
