# 資料模型設計

**功能**: 富文本編輯器與多媒體支援
**日期**: 2025-11-30
**狀態**: Phase 1 完成

## 概述

本文件定義富文本編輯器功能所需的資料實體、關係、驗證規則和狀態轉換。資料模型設計遵循現有專案架構（Supabase PostgreSQL），並確保與 002-database-structure 的相容性。

---

## 核心實體

### 1. media_files (媒體檔案)

儲存所有上傳的媒體檔案（圖片、音訊）的元資料和引用。

```typescript
interface MediaFile {
  // 主鍵
  id: string                    // UUID, 主鍵

  // 檔案資訊
  filename: string              // 原始檔案名稱
  file_type: MediaFileType      // 'image' | 'audio'
  mime_type: string             // MIME 類型，例如 'image/webp', 'audio/mpeg'
  file_size: number             // 檔案大小（bytes）
  storage_path: string          // 儲存路徑（不包含 bucket 名稱）
  storage_provider: string      // 'supabase' | 's3'
  public_url: string            // 公開存取 URL

  // 圖片特定屬性（僅當 file_type = 'image'）
  width?: number                // 圖片寬度（pixels）
  height?: number               // 圖片高度（pixels）
  alt_text?: string             // 替代文字（無障礙功能）
  caption?: string              // 圖片標題

  // 音訊特定屬性（僅當 file_type = 'audio'）
  duration?: number             // 音訊時長（秒）

  // 使用追蹤
  usage_count: number           // 引用此媒體的文章數量
  referenced_articles: string[] // 引用此媒體的文章 ID 陣列

  // 稽核欄位
  uploaded_by: string           // 上傳者 user_id (FK: auth.users)
  uploaded_at: Date             // 上傳時間戳
  updated_at: Date              // 最後更新時間戳
}

type MediaFileType = 'image' | 'audio'
```

**資料庫 Schema (SQL)**:
```sql
CREATE TYPE media_file_type AS ENUM ('image', 'audio');
CREATE TYPE storage_provider_type AS ENUM ('supabase', 's3');

CREATE TABLE media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_type media_file_type NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  storage_path TEXT NOT NULL UNIQUE,
  storage_provider storage_provider_type NOT NULL DEFAULT 'supabase',
  public_url TEXT NOT NULL,

  -- 圖片屬性
  width INTEGER CHECK (width > 0),
  height INTEGER CHECK (height > 0),
  alt_text TEXT,
  caption TEXT,

  -- 音訊屬性
  duration NUMERIC CHECK (duration > 0),

  -- 使用追蹤
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  referenced_articles UUID[] NOT NULL DEFAULT '{}',

  -- 稽核
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_media_files_uploaded_by ON media_files(uploaded_by);
CREATE INDEX idx_media_files_file_type ON media_files(file_type);
CREATE INDEX idx_media_files_storage_path ON media_files(storage_path);
CREATE INDEX idx_media_files_uploaded_at ON media_files(uploaded_at DESC);

-- 觸發器：自動更新 updated_at
CREATE TRIGGER update_media_files_updated_at
  BEFORE UPDATE ON media_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**驗證規則**:
- `file_size`: 圖片 ≤ 10MB (10485760 bytes), 音訊 ≤ 50MB (52428800 bytes)
- `mime_type`: 必須在允許清單中（見 FR-018）
  - 圖片: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
  - 音訊: `audio/mpeg`, `audio/wav`
- `width`, `height`: 僅圖片類型必填
- `duration`: 僅音訊類型必填
- `storage_path`: 必須唯一，格式 `{year}/{month}/{uuid}.{ext}`

---

### 2. article_content (增強的文章內容)

擴展現有的 `articles` 表，支援富文本內容格式。

**選項 A: 擴展現有 articles 表**（推薦）

```sql
-- 擴展現有 articles 表
ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'markdown';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_json JSONB;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedded_media UUID[];

-- 檢查約束
ALTER TABLE articles ADD CONSTRAINT content_format_check
  CHECK (content_format IN ('markdown', 'html', 'tiptap_json'));

-- 索引
CREATE INDEX idx_articles_content_format ON articles(content_format);
CREATE INDEX idx_articles_embedded_media ON articles USING GIN(embedded_media);
```

**TypeScript 類型擴展**:
```typescript
// src/types/index.ts (擴展現有 Article 類型)
interface Article {
  // ... 現有欄位
  content: string                      // 原始 Markdown 內容（向後相容）
  content_format: ContentFormat        // 'markdown' | 'html' | 'tiptap_json'
  content_json?: TiptapDocument        // TipTap JSON 格式（可選）
  embedded_media?: string[]            // 嵌入的媒體檔案 ID 陣列
}

type ContentFormat = 'markdown' | 'html' | 'tiptap_json'

interface TiptapDocument {
  type: 'doc'
  content: TiptapNode[]
}

interface TiptapNode {
  type: string
  attrs?: Record<string, any>
  content?: TiptapNode[]
  marks?: TiptapMark[]
  text?: string
}

interface TiptapMark {
  type: string
  attrs?: Record<string, any>
}
```

**資料遷移策略**:
```typescript
// 遷移現有 Markdown 文章到新格式
async function migrateArticleToRichText(articleId: string) {
  const article = await ArticleService.getArticleById(articleId)

  if (article.content_format === 'markdown') {
    const tiptapDoc = await contentConverter.markdownToTiptap(article.content)

    await supabase
      .from('articles')
      .update({
        content_json: tiptapDoc,
        content_format: 'tiptap_json',
        updated_at: new Date(),
      })
      .eq('id', articleId)
  }
}
```

---

### 3. editor_preferences (編輯器偏好設定)

儲存使用者的編輯器偏好（富文本 vs Markdown）。

```typescript
interface EditorPreference {
  user_id: string               // FK: auth.users, 主鍵
  preferred_editor: EditorType  // 'rich_text' | 'markdown'
  auto_save_enabled: boolean    // 是否啟用自動儲存
  auto_save_interval: number    // 自動儲存間隔（秒）
  created_at: Date
  updated_at: Date
}

type EditorType = 'rich_text' | 'markdown'
```

**資料庫 Schema (SQL)**:
```sql
CREATE TYPE editor_type AS ENUM ('rich_text', 'markdown');

CREATE TABLE editor_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_editor editor_type NOT NULL DEFAULT 'rich_text',
  auto_save_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_save_interval INTEGER NOT NULL DEFAULT 2 CHECK (auto_save_interval > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 觸發器
CREATE TRIGGER update_editor_preferences_updated_at
  BEFORE UPDATE ON editor_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### 4. article_media_references (文章媒體引用關聯)

多對多關聯表，追蹤文章中使用的媒體檔案。

```typescript
interface ArticleMediaReference {
  article_id: string            // FK: articles
  media_id: string              // FK: media_files
  reference_type: ReferenceType // 'inline' | 'embed' | 'attachment'
  position: number              // 在文章中的順序位置
  created_at: Date
}

type ReferenceType = 'inline' | 'embed' | 'attachment'
```

**資料庫 Schema (SQL)**:
```sql
CREATE TYPE media_reference_type AS ENUM ('inline', 'embed', 'attachment');

CREATE TABLE article_media_references (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media_files(id) ON DELETE RESTRICT,
  reference_type media_reference_type NOT NULL DEFAULT 'inline',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (article_id, media_id)
);

-- 索引
CREATE INDEX idx_article_media_article_id ON article_media_references(article_id);
CREATE INDEX idx_article_media_media_id ON article_media_references(media_id);

-- 觸發器：更新 media_files.usage_count
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

CREATE TRIGGER trigger_update_media_usage_count
  AFTER INSERT OR DELETE ON article_media_references
  FOR EACH ROW
  EXECUTE FUNCTION update_media_usage_count();
```

---

## 實體關係圖 (ERD)

```
┌─────────────────┐
│   auth.users    │
│  (Supabase)     │
└────────┬────────┘
         │
         │ 1:N (uploaded_by)
         │
         ▼
┌─────────────────────────────┐
│      media_files            │
├─────────────────────────────┤
│ id (PK)                     │
│ filename                    │
│ file_type                   │
│ storage_path                │
│ usage_count                 │
│ referenced_articles[]       │
│ uploaded_by (FK)            │
└──────────┬──────────────────┘
           │
           │ N:M
           │
┌──────────▼──────────────────┐      ┌─────────────────────┐
│ article_media_references    │◄─────┤     articles        │
├─────────────────────────────┤      ├─────────────────────┤
│ article_id (FK, PK)         │ N:1  │ id (PK)             │
│ media_id (FK, PK)           │      │ content             │
│ reference_type              │      │ content_format      │
│ position                    │      │ content_json        │
└─────────────────────────────┘      │ embedded_media[]    │
                                      └─────────────────────┘

┌─────────────────────────────┐
│   editor_preferences        │
├─────────────────────────────┤
│ user_id (PK, FK)            │
│ preferred_editor            │
│ auto_save_enabled           │
└─────────────────────────────┘
         ▲
         │ 1:1
         │
┌────────┴────────┐
│   auth.users    │
└─────────────────┘
```

---

## 狀態轉換

### 文章內容格式遷移

```
[現有 Markdown 文章]
      │
      │ 使用者選擇「切換到富文本編輯器」
      ▼
[Markdown → TipTap 轉換]
      │
      ├─→ content_format = 'tiptap_json'
      ├─→ content_json = {...}
      └─→ content 保留（向後相容）
      │
      │ 使用者編輯
      ▼
[儲存時雙向同步]
      │
      ├─→ TipTap JSON → Markdown (更新 content)
      └─→ Markdown → TipTap JSON (更新 content_json)
      │
      │ 使用者選擇「切換到 Markdown 編輯器」
      ▼
[Markdown 編輯模式]
      │
      └─→ 編輯 content 欄位
```

### 媒體檔案生命週期

```
[使用者上傳檔案]
      │
      │ 客戶端驗證（檔案類型、大小）
      ▼
[客戶端壓縮（圖片）]
      │
      │ browser-image-compression
      ▼
[上傳到 StorageProvider]
      │
      ├─→ Supabase Storage (預設)
      └─→ AWS S3 (可選)
      │
      ▼
[建立 media_files 記錄]
      │
      ├─→ storage_path 儲存
      ├─→ public_url 生成
      └─→ usage_count = 0
      │
      │ 插入文章中
      ▼
[建立 article_media_references]
      │
      ├─→ 觸發器更新 usage_count
      └─→ referenced_articles 新增 article_id
      │
      │ 文章刪除或媒體移除
      ▼
[usage_count 遞減]
      │
      │ usage_count = 0?
      ├─ YES → [標記為孤立檔案]
      │         │
      │         └─→ 管理員可清理
      │
      └─ NO → [保留在儲存中]
```

---

## Row-Level Security (RLS) 政策

### media_files 表

```sql
-- 啟用 RLS
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- 政策 1: 所有認證使用者可讀取
CREATE POLICY "Authenticated users can view media files"
  ON media_files FOR SELECT
  TO authenticated
  USING (true);

-- 政策 2: 上傳者可編輯自己的檔案
CREATE POLICY "Users can update their own media files"
  ON media_files FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- 政策 3: 上傳者可刪除未使用的檔案
CREATE POLICY "Users can delete unused media files"
  ON media_files FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() AND usage_count = 0);

-- 政策 4: 認證使用者可上傳
CREATE POLICY "Authenticated users can upload media"
  ON media_files FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
```

### article_media_references 表

```sql
-- 啟用 RLS
ALTER TABLE article_media_references ENABLE ROW LEVEL SECURITY;

-- 政策 1: 所有人可讀取已發布文章的媒體引用
CREATE POLICY "Anyone can view published article media"
  ON article_media_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM articles
      WHERE id = article_id AND is_published = true
    )
  );

-- 政策 2: 文章編輯者可管理媒體引用
CREATE POLICY "Article editors can manage media references"
  ON article_media_references FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM articles a
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE a.id = article_id
        AND (
          ur.role = 'admin'
          OR (ur.role = 'teacher' AND a.class_id = ur.class_id)
        )
    )
  );
```

### editor_preferences 表

```sql
-- 啟用 RLS
ALTER TABLE editor_preferences ENABLE ROW LEVEL SECURITY;

-- 政策 1: 使用者只能讀取和修改自己的偏好
CREATE POLICY "Users manage their own editor preferences"
  ON editor_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## 資料驗證規則

### 媒體檔案驗證

```typescript
// src/services/mediaService.ts
export class MediaService {
  private static readonly VALIDATION_RULES = {
    image: {
      maxSize: 10 * 1024 * 1024,  // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      maxWidth: 4000,
      maxHeight: 4000,
    },
    audio: {
      maxSize: 50 * 1024 * 1024,  // 50MB
      allowedMimeTypes: ['audio/mpeg', 'audio/wav'],
      maxDuration: 3600,  // 1小時
    },
  }

  static validateFile(file: File, type: MediaFileType): ValidationResult {
    const rules = this.VALIDATION_RULES[type]

    if (!rules.allowedMimeTypes.includes(file.type)) {
      return {
        valid: false,
        error: `不支援的檔案類型: ${file.type}`,
      }
    }

    if (file.size > rules.maxSize) {
      return {
        valid: false,
        error: `檔案大小超過限制 (${rules.maxSize / 1024 / 1024}MB)`,
      }
    }

    return { valid: true }
  }
}
```

### 內容格式驗證

```typescript
// src/services/contentValidator.ts
export class ContentValidator {
  static validateTiptapDocument(doc: unknown): boolean {
    if (typeof doc !== 'object' || doc === null) return false

    const tiptapDoc = doc as any

    // 必須有 type: 'doc'
    if (tiptapDoc.type !== 'doc') return false

    // 必須有 content 陣列
    if (!Array.isArray(tiptapDoc.content)) return false

    // 遞迴驗證所有節點
    return this.validateNodes(tiptapDoc.content)
  }

  private static validateNodes(nodes: unknown[]): boolean {
    return nodes.every(node => {
      if (typeof node !== 'object' || node === null) return false

      const n = node as any

      // 每個節點必須有 type
      if (typeof n.type !== 'string') return false

      // 如果有 content，必須是陣列且遞迴驗證
      if (n.content && !this.validateNodes(n.content)) return false

      return true
    })
  }
}
```

---

## 資料庫初始化腳本

```sql
-- 完整初始化腳本
-- 執行順序：先執行 002-database-structure，再執行此腳本

-- 1. 建立 ENUM 類型
CREATE TYPE media_file_type AS ENUM ('image', 'audio');
CREATE TYPE storage_provider_type AS ENUM ('supabase', 's3');
CREATE TYPE editor_type AS ENUM ('rich_text', 'markdown');
CREATE TYPE media_reference_type AS ENUM ('inline', 'embed', 'attachment');

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
ALTER TABLE articles ADD CONSTRAINT content_format_check
  CHECK (content_format IN ('markdown', 'html', 'tiptap_json'));

-- 4. 建立 editor_preferences 表
CREATE TABLE IF NOT EXISTS editor_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_editor editor_type NOT NULL DEFAULT 'rich_text',
  auto_save_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_save_interval INTEGER NOT NULL DEFAULT 2 CHECK (auto_save_interval > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 建立 article_media_references 表
CREATE TABLE IF NOT EXISTS article_media_references (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media_files(id) ON DELETE RESTRICT,
  reference_type media_reference_type NOT NULL DEFAULT 'inline',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, media_id)
);

-- 6. 建立索引
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by ON media_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_files_file_type ON media_files(file_type);
CREATE INDEX IF NOT EXISTS idx_media_files_storage_path ON media_files(storage_path);
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_at ON media_files(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_content_format ON articles(content_format);
CREATE INDEX IF NOT EXISTS idx_articles_embedded_media ON articles USING GIN(embedded_media);
CREATE INDEX IF NOT EXISTS idx_article_media_article_id ON article_media_references(article_id);
CREATE INDEX IF NOT EXISTS idx_article_media_media_id ON article_media_references(media_id);

-- 7. 建立觸發器函數
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

-- 8. 綁定觸發器
CREATE TRIGGER IF NOT EXISTS update_media_files_updated_at
  BEFORE UPDATE ON media_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_editor_preferences_updated_at
  BEFORE UPDATE ON editor_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trigger_update_media_usage_count
  AFTER INSERT OR DELETE ON article_media_references
  FOR EACH ROW
  EXECUTE FUNCTION update_media_usage_count();

-- 9. 啟用 RLS（已包含在上方政策部分）
```

---

## 測試資料

```sql
-- 插入測試資料（僅用於開發環境）
-- 假設 user_id '00000000-0000-0000-0000-000000000001' 存在

-- 測試圖片
INSERT INTO media_files (
  id,
  filename,
  file_type,
  mime_type,
  file_size,
  storage_path,
  public_url,
  width,
  height,
  alt_text,
  uploaded_by
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'test-image.webp',
  'image',
  'image/webp',
  102400,
  '2025/11/test-image.webp',
  'https://example.com/storage/test-image.webp',
  1920,
  1080,
  '測試圖片',
  '00000000-0000-0000-0000-000000000001'
);

-- 測試音訊
INSERT INTO media_files (
  id,
  filename,
  file_type,
  mime_type,
  file_size,
  storage_path,
  public_url,
  duration,
  uploaded_by
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'test-audio.mp3',
  'audio',
  'audio/mpeg',
  2048000,
  '2025/11/test-audio.mp3',
  'https://example.com/storage/test-audio.mp3',
  180.5,
  '00000000-0000-0000-0000-000000000001'
);
```
