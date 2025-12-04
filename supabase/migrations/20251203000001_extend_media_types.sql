-- Add 'video' and 'document' to media_file_type enum
ALTER TYPE media_file_type ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE media_file_type ADD VALUE IF NOT EXISTS 'document';
