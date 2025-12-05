-- 1. 建立 ENUM 類型
DO $$ BEGIN
    CREATE TYPE media_file_type AS ENUM ('image', 'audio');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE storage_provider_type AS ENUM ('supabase', 's3');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE media_reference_type AS ENUM ('inline', 'embed', 'attachment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. 建立 media_files 表
CREATE TABLE IF NOT EXISTS media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_type media_file_type NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  storage_path TEXT NOT NULL UNIQUE,
  storage_provider storage_provider_type NOT NULL DEFAULT 'supabase',
  public_url TEXT NOT NULL,
  width INTEGER CHECK (width > 0),
  height INTEGER CHECK (height > 0),
  alt_text TEXT,
  caption TEXT,
  duration NUMERIC CHECK (duration > 0),
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  referenced_articles UUID[] NOT NULL DEFAULT '{}',
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 擴展 articles 表
ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'markdown';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_json JSONB;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedded_media UUID[];

DO $$ BEGIN
    ALTER TABLE articles ADD CONSTRAINT content_format_check
    CHECK (content_format IN ('markdown', 'html', 'tiptap_json'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. 建立 article_media_references 表
CREATE TABLE IF NOT EXISTS article_media_references (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media_files(id) ON DELETE RESTRICT,
  reference_type media_reference_type NOT NULL DEFAULT 'inline',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, media_id)
);

-- 5. 建立索引
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by ON media_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_files_file_type ON media_files(file_type);
CREATE INDEX IF NOT EXISTS idx_media_files_storage_path ON media_files(storage_path);
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_at ON media_files(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_content_format ON articles(content_format);
CREATE INDEX IF NOT EXISTS idx_articles_embedded_media ON articles USING GIN(embedded_media);
CREATE INDEX IF NOT EXISTS idx_article_media_article_id ON article_media_references(article_id);
CREATE INDEX IF NOT EXISTS idx_article_media_media_id ON article_media_references(media_id);

-- 6. 建立觸發器函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_media_usage_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- 7. 綁定觸發器
CREATE TRIGGER update_media_files_updated_at
  BEFORE UPDATE ON media_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_media_usage_count
  AFTER INSERT OR DELETE ON article_media_references
  FOR EACH ROW
  EXECUTE FUNCTION update_media_usage_count();

-- 8. RLS Policies

-- media_files
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view media files"
  ON media_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own media files"
  ON media_files FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Users can delete unused media files"
  ON media_files FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() AND usage_count = 0);

CREATE POLICY "Authenticated users can upload media"
  ON media_files FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- article_media_references
ALTER TABLE article_media_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published article media"
  ON article_media_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM articles
      WHERE id = article_id AND is_published = true
    )
  );

CREATE POLICY "Article editors can manage media references"
  ON article_media_references FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM articles a
      JOIN user_roles ur ON ur.id = auth.uid()
      WHERE a.id = article_id
        AND (
          ur.role = 'admin'
          OR (
            ur.role = 'teacher'
            AND EXISTS (
              SELECT 1 FROM teacher_class_assignment tca
              WHERE tca.teacher_id = auth.uid()
              AND (
                  a.visibility_type = 'class_restricted'
                  AND a.restricted_to_classes ? tca.class_id
              )
            )
          )
        )
    )
  );
