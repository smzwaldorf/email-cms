-- Email access is an explicit administrator decision, independent of editor links.
BEGIN;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS email_serving_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS email_approved_by UUID;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS email_approved_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS media_email_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION protect_email_media_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.email_serving_enabled THEN
    RAISE EXCEPTION 'Revoke public email access before deleting this asset' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS protect_email_media_deletion ON media_files;
CREATE TRIGGER protect_email_media_deletion BEFORE DELETE ON media_files
FOR EACH ROW EXECUTE FUNCTION protect_email_media_deletion();
COMMIT;
