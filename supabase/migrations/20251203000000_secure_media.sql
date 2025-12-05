-- Secure media bucket and set up RLS policies

-- 1. Ensure media bucket exists and is private
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Create comprehensive RLS policies

-- Allow authenticated users to upload files to the media bucket
-- They can upload to any path, but conventionally we use user-specific paths
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'media' );

-- Allow authenticated users to read files in the media bucket
-- This is required for them to generate signed URLs
CREATE POLICY "Authenticated users can read media"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'media' );

-- Allow users to update their own files (e.g. overwrite)
CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'media' AND owner = auth.uid() );

-- Allow users to delete their own files
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'media' AND owner = auth.uid() );
