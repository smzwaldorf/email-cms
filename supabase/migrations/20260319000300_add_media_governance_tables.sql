-- Media governance contracts for library reuse and safe deletion workflows.

DO $$ BEGIN
  CREATE TYPE media_variant_status AS ENUM ('pending', 'processing', 'ready', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE media_variant_type AS ENUM ('original', 'thumbnail', 'webp', 'audio_optimized');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS media_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  context_key TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS media_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  variant_type media_variant_type NOT NULL,
  format TEXT NOT NULL,
  storage_path TEXT,
  file_size BIGINT CHECK (file_size IS NULL OR file_size > 0),
  width INTEGER NOT NULL DEFAULT 0 CHECK (width >= 0),
  height INTEGER NOT NULL DEFAULT 0 CHECK (height >= 0),
  duration NUMERIC CHECK (duration IS NULL OR duration > 0),
  status media_variant_status NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  error_message TEXT,
  last_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_deletion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL,
  preflight_usage_count INTEGER NOT NULL DEFAULT 0 CHECK (preflight_usage_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_usage_unique
  ON media_usage(media_id, target_type, target_id, context_key);

CREATE INDEX IF NOT EXISTS idx_media_usage_media_active
  ON media_usage(media_id, active);

CREATE INDEX IF NOT EXISTS idx_media_usage_target_active
  ON media_usage(target_type, target_id, active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_variants_unique_variant
  ON media_variants(media_id, variant_type, format, width, height);

CREATE INDEX IF NOT EXISTS idx_media_variants_media_status
  ON media_variants(media_id, status);

CREATE INDEX IF NOT EXISTS idx_media_deletion_audit_media_id
  ON media_deletion_audit(media_id, deleted_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'media_files'
      AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_media_variants_updated_at ON media_variants;
    CREATE TRIGGER update_media_variants_updated_at
      BEFORE UPDATE ON media_variants
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_media_usage_updated_at ON media_usage;
    CREATE TRIGGER update_media_usage_updated_at
      BEFORE UPDATE ON media_usage
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
