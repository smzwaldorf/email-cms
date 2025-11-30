# 技術研究與決策

**功能**: 富文本編輯器與多媒體支援
**日期**: 2025-11-30
**狀態**: Phase 0 完成

## 研究摘要

本文件記錄富文本編輯器功能的關鍵技術決策，包括 WYSIWYG 編輯器選擇、儲存抽象模式、內容轉換策略以及其他技術元件的評估與選擇理由。

---

## 決策 1: WYSIWYG 編輯器選擇

### 決策：選用 **TipTap**

### 理由

1. **優秀的 React 整合**: 提供官方 `@tiptap/react` 套件，與 React 18 原生整合良好
2. **基於 ProseMirror**: 建立在成熟的 ProseMirror 之上，繼承其強大的文檔模型和擴展性
3. **TypeScript 原生支援**: 完整的 TypeScript 類型定義，與專案技術棧匹配
4. **Markdown 支援**: 官方 `@tiptap/extension-markdown` 擴展支援雙向 Markdown 轉換
5. **自訂節點擴展性**: 易於建立自訂節點（YouTube 嵌入、音訊播放器）
6. **合理的 Bundle 大小**: 核心 ~50KB gzipped（可按需載入擴展）
7. **活躍維護**: 由 ueberdosis 公司維護，社群活躍，文件完善
8. **無頭架構**: 不綁定特定 UI，可完全自訂樣式以符合 Waldorf 主題

### 評估的替代方案

| 編輯器 | Bundle 大小 | React 整合 | TypeScript | Markdown | 維護狀態 | 主要缺點 |
|--------|------------|-----------|-----------|----------|---------|---------|
| **TipTap** | ~50KB | ✅ 原生 | ✅ 完整 | ✅ 官方擴展 | ✅ 活躍 | 學習曲線稍陡 |
| **Lexical** | ~80KB | ✅ 原生 | ✅ 完整 | ⚠️ 需自訂 | ✅ Meta 維護 | 社群較小、文件較少 |
| **ProseMirror** | ~40KB | ⚠️ 需包裝 | ✅ 支援 | ⚠️ 需自訂 | ✅ 活躍 | 低階 API、需大量手動實作 |
| **Slate.js** | ~60KB | ✅ 原生 | ✅ 完整 | ⚠️ 需自訂 | ⚠️ API 不穩定 | 頻繁破壞性變更 |
| **Draft.js** | ~100KB | ✅ 原生 | ⚠️ 部分 | ⚠️ 需自訂 | ❌ 停止維護 | Meta 已棄用 |

### 技術實作細節

**核心套件**:
```json
{
  "@tiptap/react": "^2.1.0",
  "@tiptap/starter-kit": "^2.1.0",
  "@tiptap/extension-image": "^2.1.0",
  "@tiptap/extension-link": "^2.1.0",
  "@tiptap/extension-markdown": "^2.1.0"
}
```

**自訂擴展需求**:
- YouTube 嵌入節點（基於 `@tiptap/extension-youtube`）
- 音訊播放器節點（自訂 Node 擴展）
- 圖片上傳處理器（整合 StorageService）

**效能考量**:
- 懶載入擴展以優化初始載入時間
- 使用 `react.lazy()` 延遲載入編輯器元件
- 符合 SC-004 效能目標（<100ms 輸入延遲）

---

## 決策 2: 儲存抽象模式

### 決策：採用 **適配器模式 (Adapter Pattern)**

### 理由

1. **清晰的介面契約**: 定義統一的 `StorageProvider` 介面，所有提供者必須實作
2. **易於測試**: 可輕鬆建立 Mock 適配器進行單元測試
3. **配置驅動**: 透過環境變數切換提供者，無需修改業務邏輯
4. **擴展性**: 未來新增其他提供者（如 Cloudflare R2）只需實作新適配器
5. **符合憲法 V**: 簡潔且務實，避免過度設計

### 介面設計

```typescript
// src/types/storage.ts
export interface StorageProvider {
  // 上傳檔案
  upload(file: File, path: string, options?: UploadOptions): Promise<UploadResult>

  // 下載檔案
  download(path: string): Promise<Blob>

  // 刪除檔案
  delete(path: string): Promise<void>

  // 列出檔案
  list(prefix?: string, options?: ListOptions): Promise<FileMetadata[]>

  // 取得公開 URL
  getPublicUrl(path: string): string

  // 取得簽署 URL（限時存取）
  getSignedUrl(path: string, expiresIn: number): Promise<string>
}

export interface UploadOptions {
  contentType?: string
  isPublic?: boolean
  metadata?: Record<string, string>
}

export interface UploadResult {
  path: string
  url: string
  size: number
}

export interface FileMetadata {
  path: string
  size: number
  contentType: string
  createdAt: Date
  updatedAt: Date
}
```

### 適配器實作策略

**Supabase Storage 適配器** (預設):
```typescript
// src/adapters/SupabaseStorageAdapter.ts
export class SupabaseStorageAdapter implements StorageProvider {
  constructor(
    private supabase: SupabaseClient,
    private bucketName: string
  ) {}

  async upload(file: File, path: string, options?: UploadOptions): Promise<UploadResult> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, file, {
        contentType: options?.contentType,
        upsert: false,
      })

    if (error) throw new StorageError(error.message)

    return {
      path: data.path,
      url: this.getPublicUrl(data.path),
      size: file.size,
    }
  }

  // ... 其他方法實作
}
```

**AWS S3 適配器** (可選):
```typescript
// src/adapters/S3StorageAdapter.ts
export class S3StorageAdapter implements StorageProvider {
  constructor(
    private s3Client: S3Client,
    private bucketName: string
  ) {}

  async upload(file: File, path: string, options?: UploadOptions): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: path,
      Body: await file.arrayBuffer(),
      ContentType: options?.contentType,
      ACL: options?.isPublic ? 'public-read' : 'private',
    })

    await this.s3Client.send(command)

    return {
      path,
      url: this.getPublicUrl(path),
      size: file.size,
    }
  }

  // ... 其他方法實作
}
```

### 配置管理

**環境變數**:
```env
# .env
VITE_STORAGE_PROVIDER=supabase  # 或 's3'
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_STORAGE_BUCKET=media
VITE_AWS_S3_BUCKET=email-cms-media  # 僅在使用 S3 時需要
```

**提供者工廠**:
```typescript
// src/services/storageService.ts
export function createStorageProvider(): StorageProvider {
  const provider = import.meta.env.VITE_STORAGE_PROVIDER || 'supabase'

  switch (provider) {
    case 'supabase':
      return new SupabaseStorageAdapter(
        supabaseClient,
        import.meta.env.VITE_SUPABASE_STORAGE_BUCKET
      )
    case 's3':
      return new S3StorageAdapter(
        s3Client,
        import.meta.env.VITE_AWS_S3_BUCKET
      )
    default:
      throw new Error(`Unknown storage provider: ${provider}`)
  }
}
```

### 測試策略

```typescript
// tests/unit/adapters/MockStorageAdapter.ts
export class MockStorageAdapter implements StorageProvider {
  private files = new Map<string, { blob: Blob; metadata: FileMetadata }>()

  async upload(file: File, path: string): Promise<UploadResult> {
    this.files.set(path, {
      blob: file,
      metadata: { path, size: file.size, ... }
    })
    return { path, url: `mock://${path}`, size: file.size }
  }

  // ... 簡化的 Mock 實作
}
```

---

## 決策 3: 內容轉換策略

### 決策：**整合 Unified/Remark 生態系統 + TipTap Markdown 擴展**

### 理由

1. **延續現有技術棧**: 專案已使用 `remark` (15.0)、`remark-html` (15.0)、`rehype-sanitize` (5.0)
2. **雙向轉換支援**: TipTap 的 `@tiptap/extension-markdown` 提供編輯器原生轉換
3. **自訂節點處理**: 可擴展 remark 外掛處理 YouTube 嵌入和音訊播放器
4. **資料保真度**: Unified AST 模型確保格式保留
5. **XSS 防護**: `rehype-sanitize` 整合提供 HTML 清理（符合 SC-007）

### 轉換管線架構

```
Markdown (資料庫)
    ↓ [讀取]
remark.parse() → MDAST (Markdown AST)
    ↓
remark plugins (自訂節點轉換)
    ↓
rehype (轉為 HTML AST)
    ↓
TipTap Document (ProseMirror JSON)
    ↓ [編輯]
TipTap Editor (使用者互動)
    ↓ [儲存]
TipTap Markdown Extension (序列化)
    ↓
Markdown (儲存回資料庫)
```

### 技術實作

**核心套件**:
```json
{
  "remark": "^15.0.0",
  "remark-html": "^15.0.0",
  "remark-gfm": "^4.0.0",
  "rehype-sanitize": "^5.0.0",
  "unified": "^11.0.0",
  "@tiptap/extension-markdown": "^2.1.0"
}
```

**自訂 Remark 外掛**（處理 YouTube 嵌入）:
```typescript
// src/services/contentConverter.ts
import { visit } from 'unist-util-visit'

export function remarkYoutubeEmbed() {
  return (tree: any) => {
    visit(tree, 'link', (node) => {
      if (isYouTubeUrl(node.url)) {
        node.type = 'youtubeEmbed'
        node.data = {
          hName: 'div',
          hProperties: {
            className: 'youtube-embed',
            'data-video-id': extractVideoId(node.url)
          }
        }
      }
    })
  }
}

export function remarkAudioPlayer() {
  return (tree: any) => {
    visit(tree, 'link', (node) => {
      if (isAudioFile(node.url)) {
        node.type = 'audioPlayer'
        node.data = {
          hName: 'audio',
          hProperties: {
            controls: true,
            src: node.url
          }
        }
      }
    })
  }
}
```

**轉換服務**:
```typescript
// src/services/contentConverter.ts
export class ContentConverter {
  // Markdown → TipTap Document
  async markdownToTiptap(markdown: string): Promise<JSONContent> {
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkYoutubeEmbed)
      .use(remarkAudioPlayer)
      .use(remarkRehype)
      .use(rehypeSanitize)

    const vfile = await processor.process(markdown)
    // 轉換為 TipTap JSON 格式
    return htmlToTiptapJson(String(vfile))
  }

  // TipTap Document → Markdown
  tiptapToMarkdown(doc: JSONContent): string {
    // 使用 TipTap Markdown 擴展的序列化器
    return getMarkdownSerializer().serialize(doc)
  }
}
```

### 資料保真度測試

```typescript
// tests/integration/content-preservation.test.tsx
describe('Content Fidelity (SC-010)', () => {
  it('preserves 100% fidelity for common formats', () => {
    const markdown = `
# 標題 1
## 標題 2

**粗體** 和 *斜體*

- 項目 1
- 項目 2

[連結](https://example.com)
    `

    const tiptap = converter.markdownToTiptap(markdown)
    const result = converter.tiptapToMarkdown(tiptap)

    expect(normalizeMarkdown(result)).toBe(normalizeMarkdown(markdown))
  })

  it('preserves custom nodes (YouTube, audio)', () => {
    const markdown = `
[YouTube](https://youtube.com/watch?v=xxx)
[音訊](https://example.com/audio.mp3)
    `
    // ... 驗證自訂節點保留
  })
})
```

---

## 決策 4: 圖片最佳化策略

### 決策：**客戶端壓縮 + 伺服器端驗證**

### 理由

1. **減少上傳時間**: 在上傳前於瀏覽器端壓縮，符合 SC-002（<5 秒上傳）
2. **節省儲存空間**: 自動調整大小和格式轉換
3. **安全性**: 伺服器端驗證檔案類型和大小（FR-018, FR-019）
4. **使用者體驗**: 即時預覽壓縮後的圖片

### 技術選擇

**客戶端壓縮**:
- **函式庫**: `browser-image-compression` (2.0+)
- **功能**: 調整大小、格式轉換（WebP）、品質壓縮
- **Bundle 大小**: ~15KB gzipped

```typescript
// src/services/mediaService.ts
import imageCompression from 'browser-image-compression'

export class MediaService {
  async optimizeImage(file: File): Promise<File> {
    const options = {
      maxSizeMB: 1,              // 壓縮到 1MB 以下
      maxWidthOrHeight: 1920,    // 最大尺寸 1920px
      useWebWorker: true,        // 使用 Web Worker 避免阻塞 UI
      fileType: 'image/webp',    // 轉為 WebP 格式
    }

    try {
      const compressed = await imageCompression(file, options)
      return new File([compressed], file.name, { type: 'image/webp' })
    } catch (error) {
      console.error('Image compression failed:', error)
      return file  // 失敗時返回原始檔案
    }
  }

  validateImageFile(file: File): ValidationResult {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const maxSize = 10 * 1024 * 1024  // 10MB (FR-019)

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: '不支援的圖片格式' }
    }

    if (file.size > maxSize) {
      return { valid: false, error: '圖片檔案超過 10MB 限制' }
    }

    return { valid: true }
  }
}
```

**伺服器端驗證** (Supabase Edge Function):
```typescript
// supabase/functions/validate-upload/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { fileType, fileSize } = await req.json()

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/wav']
  const maxSizes = {
    image: 10 * 1024 * 1024,  // 10MB
    audio: 50 * 1024 * 1024,  // 50MB
  }

  const category = fileType.startsWith('image/') ? 'image' : 'audio'

  if (!allowedTypes.includes(fileType) || fileSize > maxSizes[category]) {
    return new Response(JSON.stringify({ valid: false }), { status: 400 })
  }

  return new Response(JSON.stringify({ valid: true }))
})
```

---

## 決策 5: 自動儲存機制

### 決策：**Debounced Auto-Save + Local Storage 備份**

### 理由

1. **防止資料遺失**: 符合 SC-008（100% 防止內容遺失）
2. **效能優化**: 使用 debounce 避免頻繁 API 呼叫
3. **離線支援**: Local Storage 提供臨時備份
4. **使用者體驗**: 無需手動儲存，減少認知負擔

### 技術實作

```typescript
// src/hooks/useAutoSave.ts
import { useEffect, useCallback } from 'react'
import { debounce } from 'lodash-es'

export function useAutoSave(
  content: string,
  articleId: string,
  onSave: (content: string) => Promise<void>
) {
  // Local Storage 備份
  useEffect(() => {
    localStorage.setItem(`article-draft-${articleId}`, content)
  }, [content, articleId])

  // Debounced 自動儲存（2 秒延遲）
  const debouncedSave = useCallback(
    debounce(async (value: string) => {
      try {
        await onSave(value)
        console.log('Auto-saved at', new Date().toISOString())
      } catch (error) {
        console.error('Auto-save failed:', error)
        // 保留在 Local Storage 中，使用者可稍後重試
      }
    }, 2000),
    [onSave]
  )

  useEffect(() => {
    if (content) {
      debouncedSave(content)
    }

    return () => {
      debouncedSave.cancel()
    }
  }, [content, debouncedSave])

  // 恢復草稿
  const restoreDraft = useCallback(() => {
    const draft = localStorage.getItem(`article-draft-${articleId}`)
    return draft || ''
  }, [articleId])

  return { restoreDraft }
}
```

**視覺指示器**:
```tsx
// src/components/RichTextEditor.tsx
export function RichTextEditor() {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')

  return (
    <div>
      <div className="save-indicator">
        {saveStatus === 'saved' && <span>✓ 已儲存</span>}
        {saveStatus === 'saving' && <span>⟳ 儲存中...</span>}
        {saveStatus === 'error' && <span>⚠️ 儲存失敗</span>}
      </div>
      {/* 編輯器內容 */}
    </div>
  )
}
```

---

## 決策 6: HTML 清理（XSS 防護）

### 決策：**DOMPurify + rehype-sanitize 雙重防護**

### 理由

1. **零 XSS 漏洞**: 符合 SC-007 要求
2. **深度防禦**: 客戶端和伺服器端雙重驗證
3. **白名單策略**: 只允許安全的 HTML 標籤和屬性
4. **自訂節點支援**: 配置允許 YouTube iframe 和 audio 標籤

### 技術實作

**客戶端清理**:
```typescript
// src/services/htmlSanitizer.ts
import DOMPurify from 'dompurify'

export class HtmlSanitizer {
  private static config = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'blockquote', 'code', 'pre',
      'div', 'span',
      'iframe', 'audio',  // 自訂多媒體
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title',
      'class', 'id',
      'width', 'height',
      'controls', 'data-*',  // audio 控制項和自訂屬性
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder'],
  }

  static sanitize(html: string): string {
    return DOMPurify.sanitize(html, this.config)
  }

  static sanitizeAttribute(attr: string, value: string): string {
    // 額外驗證 YouTube iframe src
    if (attr === 'src' && value.includes('youtube.com')) {
      const videoId = this.extractYouTubeId(value)
      return `https://www.youtube.com/embed/${videoId}`
    }
    return value
  }
}
```

**伺服器端清理** (rehype-sanitize):
```typescript
// src/services/contentConverter.ts (伺服器端渲染時)
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...defaultSchema.tagNames,
    'iframe', 'audio',
  ],
  attributes: {
    ...defaultSchema.attributes,
    iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen'],
    audio: ['src', 'controls'],
  },
}

export async function sanitizeHtml(html: string): Promise<string> {
  const file = await unified()
    .use(rehypeParse)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .process(html)

  return String(file)
}
```

---

## 額外套件需求

### 新增依賴

```json
{
  "dependencies": {
    "@tiptap/react": "^2.1.0",
    "@tiptap/starter-kit": "^2.1.0",
    "@tiptap/extension-image": "^2.1.0",
    "@tiptap/extension-link": "^2.1.0",
    "@tiptap/extension-youtube": "^2.1.0",
    "@tiptap/extension-markdown": "^2.1.0",
    "browser-image-compression": "^2.0.2",
    "dompurify": "^3.0.6",
    "lodash-es": "^4.17.21",
    "remark-gfm": "^4.0.0",
    "unist-util-visit": "^5.0.0"
  },
  "devDependencies": {
    "@types/dompurify": "^3.0.5",
    "@types/lodash-es": "^4.17.12"
  }
}
```

### Bundle 大小影響分析

| 套件 | 大小 (gzipped) | 理由 |
|------|---------------|------|
| TipTap 核心 + 基礎擴展 | ~50KB | WYSIWYG 編輯器核心 |
| TipTap Markdown 擴展 | ~10KB | Markdown 雙向轉換 |
| browser-image-compression | ~15KB | 圖片最佳化 |
| DOMPurify | ~20KB | XSS 防護 |
| lodash-es (debounce) | ~2KB | 自動儲存 debounce |
| **總計** | **~97KB** | 符合效能目標 |

**優化策略**:
- 使用動態 import 懶載入 TipTap 編輯器
- 僅在需要時載入 S3StorageAdapter
- Tree-shaking 移除未使用的 TipTap 擴展

---

## 風險評估

| 風險 | 嚴重度 | 緩解策略 |
|------|-------|---------|
| TipTap 學習曲線 | 中 | 建立詳細的開發文件和範例程式碼 |
| Markdown 轉換資料損失 | 高 | 完整的測試覆蓋（SC-010），edge case 測試 |
| 圖片壓縮效能 | 中 | 使用 Web Worker，顯示進度指示器 |
| 儲存提供者切換複雜度 | 低 | 適配器模式提供清晰抽象 |
| XSS 攻擊 | 高 | 雙重清理（客戶端 + 伺服器端），白名單策略 |
| 向後相容性破壞 | 中 | 保留 @uiw/react-md-editor，雙向編輯器切換 |

---

## 下一步行動

Phase 0 研究完成，已解決所有 "NEEDS CLARIFICATION" 項目。準備進入 Phase 1：

1. ✅ WYSIWYG 編輯器選擇 → TipTap
2. ✅ 儲存抽象模式 → 適配器模式
3. ✅ 內容轉換策略 → Unified + TipTap Markdown
4. ✅ 圖片最佳化 → browser-image-compression
5. ✅ 自動儲存 → Debounced + Local Storage
6. ✅ XSS 防護 → DOMPurify + rehype-sanitize

**Phase 1 任務**:
- 定義資料模型（data-model.md）
- 建立 API 契約（contracts/）
- 撰寫開發快速入門（quickstart.md）
- 更新代理上下文
