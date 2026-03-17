-- Relax Foreign Key on article_audit_log to allow deletion logs
-- When an article is deleted, the trigger tries to insert a log entry.
-- If the FK exists, it fails because the referenced article is gone.

ALTER TABLE public.article_audit_log DROP CONSTRAINT IF EXISTS article_audit_log_article_id_fkey;
