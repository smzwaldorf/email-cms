-- ===================================================================
-- 富文本編輯器與多媒體支援遷移
-- Rich Text Editor and Media Support Migration
-- ===================================================================
-- 建立媒體檔案表、文章媒體參考、RLS 政策等
-- Creates media_files table, article_media_references, RLS policies, etc.

-- ===================================================================
-- 1. 建立媒體檔案表
-- 1. Create media_files table
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.media_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'audio', 'video', 'document')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'processing', 'ready', 'error', 'deleted')),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- 公開 URL 與簽署 URL
  -- Public and signed URLs
  public_url TEXT,
  signed_url TEXT,

  -- 圖片特定欄位
  -- Image-specific fields
  width INTEGER,
  height INTEGER,

  -- 音訊特定欄位
  -- Audio-specific fields
  duration NUMERIC,

  -- 自訂元資料 JSON
  -- Custom metadata in JSON
  metadata JSONB DEFAULT '{}'::JSONB,

  -- 軟刪除標誌
  -- Soft delete flag
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT media_size_positive CHECK (file_size > 0)
);

-- 建立索引以提升查詢效能
-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by ON public.media_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_files_media_type ON public.media_files(media_type);
CREATE INDEX IF NOT EXISTS idx_media_files_status ON public.media_files(status);
CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON public.media_files(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_files_deleted_at ON public.media_files(deleted_at) WHERE deleted_at IS NULL;

-- ===================================================================
-- 2. 建立文章媒體參考表
-- 2. Create article_media_references table
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.article_media_references (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES public.media_files(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('image', 'audio', 'video')),
  position INTEGER,
  properties JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_article_media UNIQUE(article_id, media_id)
);

-- 建立索引
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_article_media_refs_article_id ON public.article_media_references(article_id);
CREATE INDEX IF NOT EXISTS idx_article_media_refs_media_id ON public.article_media_references(media_id);
CREATE INDEX IF NOT EXISTS idx_article_media_refs_type ON public.article_media_references(reference_type);

-- ===================================================================
-- 3. 啟用 RLS（Row Level Security）
-- 3. Enable RLS (Row Level Security)
-- ===================================================================
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_media_references ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- 4. media_files RLS 政策
-- 4. media_files RLS Policies
-- ===================================================================

-- 政策 1: 已認證使用者可以查看所有媒體檔案
-- Policy 1: Authenticated users can view all media files
CREATE POLICY IF NOT EXISTS "Allow authenticated users to view media files"
  ON public.media_files FOR SELECT
  USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- 政策 2: 使用者可以上傳自己的媒體檔案
-- Policy 2: Users can upload their own media files
CREATE POLICY IF NOT EXISTS "Allow users to upload media files"
  ON public.media_files FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

-- 政策 3: 使用者可以更新自己上傳的媒體檔案
-- Policy 3: Users can update their own media files
CREATE POLICY IF NOT EXISTS "Allow users to update their media files"
  ON public.media_files FOR UPDATE
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

-- 政策 4: 使用者可以軟刪除自己的媒體檔案
-- Policy 4: Users can soft delete their own media files
CREATE POLICY IF NOT EXISTS "Allow users to delete their media files"
  ON public.media_files FOR DELETE
  USING (auth.uid() = uploaded_by);

-- ===================================================================
-- 5. article_media_references RLS 政策
-- 5. article_media_references RLS Policies
-- ===================================================================

-- 政策 1: 已認證使用者可以查看文章媒體參考
-- Policy 1: Authenticated users can view article media references
CREATE POLICY IF NOT EXISTS "Allow authenticated users to view article media references"
  ON public.article_media_references FOR SELECT
  USING (auth.role() = 'authenticated');

-- 政策 2: 可以編輯文章的使用者可以新增媒體參考
-- Policy 2: Users who can edit articles can add media references
CREATE POLICY IF NOT EXISTS "Allow users to add article media references"
  ON public.article_media_references FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.articles a
      WHERE a.id = article_id
      AND (a.created_by = auth.uid() OR auth.uid() IN (
        SELECT user_id FROM public.user_roles WHERE role = 'teacher'
      ))
    )
  );

-- 政策 3: 可以編輯文章的使用者可以更新媒體參考
-- Policy 3: Users who can edit articles can update media references
CREATE POLICY IF NOT EXISTS "Allow users to update article media references"
  ON public.article_media_references FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.articles a
      WHERE a.id = article_id
      AND (a.created_by = auth.uid() OR auth.uid() IN (
        SELECT user_id FROM public.user_roles WHERE role = 'teacher'
      ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.articles a
      WHERE a.id = article_id
      AND (a.created_by = auth.uid() OR auth.uid() IN (
        SELECT user_id FROM public.user_roles WHERE role = 'teacher'
      ))
    )
  );

-- 政策 4: 可以編輯文章的使用者可以刪除媒體參考
-- Policy 4: Users who can edit articles can delete media references
CREATE POLICY IF NOT EXISTS "Allow users to delete article media references"
  ON public.article_media_references FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.articles a
      WHERE a.id = article_id
      AND (a.created_by = auth.uid() OR auth.uid() IN (
        SELECT user_id FROM public.user_roles WHERE role = 'teacher'
      ))
    )
  );

-- ===================================================================
-- 6. 建立觸發器用於更新時間戳記
-- 6. Create triggers for updating timestamps
-- ===================================================================

-- 建立更新時間戳記的函數（如果不存在）
-- Create function to update timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 為 media_files 表建立觸發器
-- Create trigger for media_files
DROP TRIGGER IF EXISTS update_media_files_updated_at ON public.media_files;
CREATE TRIGGER update_media_files_updated_at
  BEFORE UPDATE ON public.media_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 為 article_media_references 表建立觸發器
-- Create trigger for article_media_references
DROP TRIGGER IF EXISTS update_article_media_references_updated_at ON public.article_media_references;
CREATE TRIGGER update_article_media_references_updated_at
  BEFORE UPDATE ON public.article_media_references
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- 7. 建立視圖用於查詢孤立媒體檔案
-- 7. Create view for identifying orphaned media files
-- ===================================================================

CREATE OR REPLACE VIEW orphaned_media_files AS
SELECT m.*
FROM public.media_files m
LEFT JOIN public.article_media_references amr ON m.id = amr.media_id
WHERE amr.id IS NULL
  AND m.deleted_at IS NULL;

-- ===================================================================
-- 8. 建立視圖用於查詢文章的完整媒體
-- 8. Create view for article media with details
-- ===================================================================

CREATE OR REPLACE VIEW article_media_details AS
SELECT
  amr.id as reference_id,
  amr.article_id,
  mf.id as media_id,
  mf.file_name,
  mf.file_size,
  mf.mime_type,
  mf.media_type,
  mf.status,
  mf.public_url,
  mf.width,
  mf.height,
  mf.duration,
  amr.reference_type,
  amr.position,
  amr.properties,
  mf.uploaded_at,
  mf.updated_at
FROM public.article_media_references amr
JOIN public.media_files mf ON amr.media_id = mf.id
WHERE mf.deleted_at IS NULL
ORDER BY amr.position;

-- ===================================================================
-- 9. 授予權限
-- 9. Grant permissions
-- ===================================================================

-- 授予 anon 角色查看許可
-- Grant select to anon for public media
GRANT SELECT ON public.media_files TO anon;
GRANT SELECT ON public.article_media_references TO anon;

-- 授予 authenticated 角色完整權限
-- Grant full permissions to authenticated
GRANT ALL ON public.media_files TO authenticated;
GRANT ALL ON public.article_media_references TO authenticated;

-- 授予視圖查看許可
-- Grant view access
GRANT SELECT ON public.orphaned_media_files TO authenticated;
GRANT SELECT ON public.article_media_details TO authenticated;

-- ===================================================================
-- 10. 遷移記錄
-- 10. Migration notes
-- ===================================================================
-- 此遷移建立：
-- This migration creates:
-- - media_files 表用於儲存媒體檔案元資料
-- - article_media_references 表用於建立文章與媒體的關係
-- - RLS 政策以確保適當的存取控制
-- - 視圖用於查詢孤立檔案和文章媒體詳情
--
-- 注意：Supabase Storage bucket 需要在應用程式初始化時手動建立
-- Note: Supabase Storage bucket needs to be created manually during app init
