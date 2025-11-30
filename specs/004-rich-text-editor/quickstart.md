# 開發快速入門

**功能**: 富文本編輯器與多媒體支援
**日期**: 2025-11-30
**適用對象**: 開發者

## 概述

本文件提供富文本編輯器功能的快速開發指南，包括環境設置、核心概念、常見開發模式和故障排除。

---

## 環境準備

### 1. 安裝依賴

```bash
# 安裝 TipTap 相關套件
npm install @tiptap/react@^2.1.0 \
  @tiptap/starter-kit@^2.1.0 \
  @tiptap/extension-image@^2.1.0 \
  @tiptap/extension-link@^2.1.0 \
  @tiptap/extension-youtube@^2.1.0 \
  @tiptap/extension-markdown@^2.1.0

# 安裝圖片優化套件
npm install browser-image-compression@^2.0.2

# 安裝 HTML 清理套件
npm install dompurify@^3.0.6

# 安裝工具函數
npm install lodash-es@^4.17.21 remark-gfm@^4.0.0 unist-util-visit@^5.0.0

# 安裝類型定義
npm install --save-dev @types/dompurify@^3.0.5 @types/lodash-es@^4.17.12
```

### 2. 設置環境變數

```env
# .env.local
VITE_STORAGE_PROVIDER=supabase  # 或 's3'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_STORAGE_BUCKET=media

# 僅使用 AWS S3 時需要
# VITE_AWS_S3_BUCKET=email-cms-media
# VITE_AWS_S3_REGION=us-east-1
```

### 3. 資料庫遷移

```bash
# 執行資料庫遷移腳本
# 位於 specs/004-rich-text-editor/data-model.md 的 SQL 腳本
cd supabase
supabase migration new rich_text_editor
# 將 data-model.md 中的 SQL 複製到遷移檔案
supabase db push
```

---

## 核心概念

### 1. 儲存架構

```
StorageProvider (介面)
    ↓
┌───────────────────┬───────────────────┐
│                   │                   │
SupabaseStorageAdapter   S3StorageAdapter   MockStorageAdapter
(生產環境預設)            (可選)              (測試用)
```

**使用方式**:
```typescript
import { createStorageProvider } from '@/services/storageService'

const storage = createStorageProvider()
const result = await storage.upload(file, path)
```

### 2. 編輯器架構

```
EditorSwitcher (切換器)
    ↓
┌────────────────────────────┬────────────────────────────┐
│                            │                            │
RichTextEditor (TipTap)      ArticleEditor (@uiw/react-md-editor)
    ↓                            ↓
ContentConverter (雙向轉換)
    ↓
TipTap JSON ↔ Markdown
```

**使用方式**:
```tsx
import { EditorSwitcher } from '@/components/EditorSwitcher'

<EditorSwitcher
  initialMode="rich_text"
  content={article.content}
  onChange={handleContentChange}
/>
```

### 3. 內容轉換流程

```
資料庫 (Markdown)
    ↓ 讀取
ContentConverter.markdownToTiptap()
    ↓
TipTap 編輯器 (ProseMirror JSON)
    ↓ 使用者編輯
TipTap 編輯器
    ↓ 儲存
ContentConverter.tiptapToMarkdown()
    ↓
資料庫 (Markdown) + content_json (TipTap JSON)
```

---

## 常見開發模式

### 模式 1: 建立基本富文本編輯器

```tsx
// src/components/MyEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'

export function MyEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link,
    ],
    content: '<p>Hello World!</p>',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      console.log(html)
    },
  })

  return (
    <div className="editor">
      <EditorContent editor={editor} />
    </div>
  )
}
```

### 模式 2: 上傳圖片並優化

```typescript
// src/hooks/useMediaUpload.ts
import { useState } from 'react'
import imageCompression from 'browser-image-compression'
import { MediaService } from '@/services/mediaService'

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadImage = async (file: File) => {
    setUploading(true)
    setProgress(0)

    try {
      // 1. 驗證檔案
      const validation = MediaService.validateImage(file)
      if (!validation.valid) {
        throw new Error(validation.errors[0])
      }

      // 2. 優化圖片
      setProgress(30)
      const optimized = await MediaService.optimizeImage(file)

      // 3. 上傳到儲存
      setProgress(60)
      const media = await MediaService.upload(optimized, {
        onProgress: (p) => setProgress(60 + p.percent * 0.4),
      })

      setProgress(100)
      return media
    } finally {
      setUploading(false)
    }
  }

  return { uploadImage, uploading, progress }
}
```

**在元件中使用**:
```tsx
function ImageUploader() {
  const { uploadImage, uploading, progress } = useMediaUpload()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const media = await uploadImage(file)
    console.log('上傳成功:', media.publicUrl)
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {uploading && <progress value={progress} max={100} />}
    </div>
  )
}
```

### 模式 3: 內容轉換與驗證

```typescript
// src/services/contentConverter.ts
import { ContentConverter } from '@/services/contentConverter'

// Markdown → TipTap
const markdown = '# Hello\n\n**Bold** text'
const tiptapDoc = await ContentConverter.markdownToTiptap(markdown)

// TipTap → Markdown
const backToMarkdown = ContentConverter.tiptapToMarkdown(tiptapDoc)

// 驗證保真度
const fidelity = ContentConverter.validateFidelity(markdown, 'markdown')
console.log('保真度:', fidelity.similarity)  // 應為 1.0 (100%)
```

### 模式 4: 自訂 TipTap 節點（YouTube 嵌入）

```typescript
// src/components/RichTextEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Youtube from '@tiptap/extension-youtube'

export function RichTextEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Youtube.configure({
        width: 640,
        height: 480,
        modestBranding: true,
      }),
    ],
  })

  const addYouTube = () => {
    const url = prompt('輸入 YouTube URL:')
    if (url) {
      editor?.commands.setYoutubeVideo({ src: url })
    }
  }

  return (
    <div>
      <button onClick={addYouTube}>插入 YouTube 影片</button>
      <EditorContent editor={editor} />
    </div>
  )
}
```

### 模式 5: 自動儲存

```typescript
// src/hooks/useAutoSave.ts
import { useEffect, useCallback } from 'react'
import { debounce } from 'lodash-es'

export function useAutoSave(
  content: string,
  articleId: string,
  onSave: (content: string) => Promise<void>
) {
  // Local Storage 即時備份
  useEffect(() => {
    localStorage.setItem(`draft-${articleId}`, content)
  }, [content, articleId])

  // Debounced 自動儲存
  const debouncedSave = useCallback(
    debounce(async (value: string) => {
      try {
        await onSave(value)
        console.log('✓ 自動儲存成功')
      } catch (error) {
        console.error('⚠️ 自動儲存失敗:', error)
      }
    }, 2000),
    [onSave]
  )

  useEffect(() => {
    if (content) {
      debouncedSave(content)
    }
    return () => debouncedSave.cancel()
  }, [content, debouncedSave])

  // 恢復草稿
  const restoreDraft = useCallback(() => {
    return localStorage.getItem(`draft-${articleId}`) || ''
  }, [articleId])

  return { restoreDraft }
}
```

**在元件中使用**:
```tsx
function ArticleEditor({ article }: { article: Article }) {
  const [content, setContent] = useState(article.content)

  const handleSave = async (newContent: string) => {
    await ArticleService.updateArticle(article.id, { content: newContent })
  }

  const { restoreDraft } = useAutoSave(content, article.id, handleSave)

  useEffect(() => {
    // 載入時檢查是否有草稿
    const draft = restoreDraft()
    if (draft && draft !== article.content) {
      if (confirm('發現未儲存的草稿，是否恢復？')) {
        setContent(draft)
      }
    }
  }, [])

  return <Editor content={content} onChange={setContent} />
}
```

### 模式 6: 編輯器模式切換

```tsx
// src/components/EditorSwitcher.tsx
import { useState } from 'react'
import { RichTextEditor } from './RichTextEditor'
import { ArticleEditor } from './ArticleEditor'  // @uiw/react-md-editor
import { ContentConverter } from '@/services/contentConverter'

export function EditorSwitcher({ initialContent }: { initialContent: string }) {
  const [mode, setMode] = useState<'rich' | 'markdown'>('rich')
  const [content, setContent] = useState(initialContent)
  const [tiptapDoc, setTiptapDoc] = useState<JSONContent>()

  const switchToMarkdown = () => {
    if (tiptapDoc) {
      const markdown = ContentConverter.tiptapToMarkdown(tiptapDoc)
      setContent(markdown)
    }
    setMode('markdown')
  }

  const switchToRich = async () => {
    const doc = await ContentConverter.markdownToTiptap(content)
    setTiptapDoc(doc)
    setMode('rich')
  }

  return (
    <div>
      <div className="mode-switcher">
        <button onClick={switchToRich} disabled={mode === 'rich'}>
          富文本模式
        </button>
        <button onClick={switchToMarkdown} disabled={mode === 'markdown'}>
          Markdown 模式
        </button>
      </div>

      {mode === 'rich' ? (
        <RichTextEditor
          content={tiptapDoc}
          onChange={setTiptapDoc}
        />
      ) : (
        <ArticleEditor
          value={content}
          onChange={setContent}
        />
      )}
    </div>
  )
}
```

---

## 測試指南

### 單元測試範例

```typescript
// tests/unit/services/contentConverter.test.ts
import { describe, it, expect } from 'vitest'
import { ContentConverter } from '@/services/contentConverter'

describe('ContentConverter', () => {
  it('should convert markdown to TipTap JSON', async () => {
    const markdown = '# Hello\n\n**Bold** text'
    const tiptap = await ContentConverter.markdownToTiptap(markdown)

    expect(tiptap.type).toBe('doc')
    expect(tiptap.content).toHaveLength(2)  // heading + paragraph
  })

  it('should maintain 100% fidelity for common formats', async () => {
    const markdown = '# Title\n\n- Item 1\n- Item 2\n\n[Link](https://example.com)'
    const tiptap = await ContentConverter.markdownToTiptap(markdown)
    const result = ContentConverter.tiptapToMarkdown(tiptap)

    const fidelity = ContentConverter.validateFidelity(markdown, 'markdown')
    expect(fidelity.isPerfect).toBe(true)
  })
})
```

### 元件測試範例

```typescript
// tests/components/RichTextEditor.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RichTextEditor } from '@/components/RichTextEditor'

describe('RichTextEditor', () => {
  it('should render editor with initial content', () => {
    render(<RichTextEditor content="<p>Test</p>" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('should call onChange when content changes', async () => {
    const onChange = vi.fn()
    render(<RichTextEditor onChange={onChange} />)

    const editor = screen.getByRole('textbox')
    fireEvent.input(editor, { target: { textContent: 'New content' } })

    expect(onChange).toHaveBeenCalled()
  })
})
```

### 整合測試範例

```typescript
// tests/integration/media-upload-flow.test.tsx
import { describe, it, expect } from 'vitest'
import { MediaService } from '@/services/mediaService'

describe('Media Upload Flow', () => {
  it('should upload, optimize, and store image', async () => {
    // 建立測試檔案
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    // 上傳
    const media = await MediaService.upload(file, {
      autoOptimize: true,
      altText: 'Test image',
    })

    // 驗證
    expect(media.id).toBeDefined()
    expect(media.publicUrl).toContain('http')
    expect(media.fileSize).toBeLessThan(file.size)  // 應已優化
    expect(media.altText).toBe('Test image')
  })
})
```

---

## 故障排除

### 問題 1: TipTap 編輯器無法載入

**症狀**: 編輯器區域顯示空白

**解決方案**:
```typescript
// 確認所有必要的擴展都已安裝
import StarterKit from '@tiptap/starter-kit'

const editor = useEditor({
  extensions: [StarterKit],  // 至少需要 StarterKit
  content: '<p>Test</p>',
})

// 檢查 editor 是否為 null
if (!editor) {
  return <div>Loading...</div>
}
```

### 問題 2: 圖片上傳後無法顯示

**症狀**: 圖片上傳成功但無法在編輯器中顯示

**解決方案**:
```typescript
// 檢查 Supabase Storage bucket 政策
// 確保 bucket 為公開存取或已設定正確的 RLS 政策

// 在 Supabase Dashboard:
// Storage > Policies > New Policy
// 選擇 "Allow public read access"
```

### 問題 3: Markdown 轉換遺失格式

**症狀**: 從 Markdown 切換到富文本後，部分格式消失

**解決方案**:
```typescript
// 確認使用 remark-gfm 擴展以支援 GitHub Flavored Markdown
import remarkGfm from 'remark-gfm'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)  // 支援表格、刪除線等
  .use(remarkRehype)
```

### 問題 4: 自動儲存頻繁觸發 API 呼叫

**症狀**: 網路面板顯示每次輸入都觸發 API 請求

**解決方案**:
```typescript
// 增加 debounce 延遲時間
const debouncedSave = debounce(async (value: string) => {
  await onSave(value)
}, 3000)  // 從 2000ms 增加到 3000ms
```

### 問題 5: 大圖片上傳超時

**症狀**: 上傳大於 5MB 的圖片時超時

**解決方案**:
```typescript
// 調整圖片優化設定
const optimized = await MediaService.optimizeImage(file, {
  maxSizeMB: 0.5,  // 壓縮到 500KB
  maxWidthOrHeight: 1280,  // 降低尺寸
})
```

---

## 效能優化建議

### 1. 懶載入編輯器

```typescript
// src/pages/ArticleEditPage.tsx
import { lazy, Suspense } from 'react'

const RichTextEditor = lazy(() => import('@/components/RichTextEditor'))

export function ArticleEditPage() {
  return (
    <Suspense fallback={<div>載入編輯器中...</div>}>
      <RichTextEditor />
    </Suspense>
  )
}
```

### 2. 使用 React.memo 避免重新渲染

```typescript
// src/components/MediaLibrary.tsx
import { memo } from 'react'

export const MediaLibrary = memo(function MediaLibrary({ files }: Props) {
  return <div>{/* ... */}</div>
}, (prev, next) => {
  return prev.files.length === next.files.length
})
```

### 3. 優化圖片載入

```tsx
// 使用 loading="lazy" 屬性
<img
  src={media.publicUrl}
  alt={media.altText}
  loading="lazy"
  decoding="async"
/>
```

### 4. 快取媒體列表

```typescript
// src/services/mediaService.ts
const mediaCache = new Map<string, MediaFile[]>()

export async function listMedia(options: MediaListOptions) {
  const cacheKey = JSON.stringify(options)

  if (mediaCache.has(cacheKey)) {
    return mediaCache.get(cacheKey)!
  }

  const result = await fetchMediaList(options)
  mediaCache.set(cacheKey, result.items)

  return result
}
```

---

## 下一步

完成開發設置後，建議按照以下順序進行：

1. ✅ 閱讀 [research.md](./research.md) 了解技術決策
2. ✅ 查看 [data-model.md](./data-model.md) 熟悉資料結構
3. ✅ 檢閱 [contracts/](./contracts/) 目錄中的 API 介面定義
4. 📝 執行 `/speckit.tasks` 生成實作任務清單
5. 🚀 開始實作（遵循 tasks.md 中的任務順序）

---

## 參考資源

- **TipTap 文件**: https://tiptap.dev/
- **Supabase Storage 指南**: https://supabase.com/docs/guides/storage
- **browser-image-compression**: https://github.com/Donaldcwl/browser-image-compression
- **DOMPurify**: https://github.com/cure53/DOMPurify
- **專案憲法**: `/.specify/memory/constitution.md`
