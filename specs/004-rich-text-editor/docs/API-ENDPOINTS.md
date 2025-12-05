# Rich Text Editor API 文檔

**功能**: 富文本編輯器與多媒體支援 (`004-rich-text-editor`)
**日期**: 2025-12-03
**版本**: 1.0

---

## 目錄

1. [儲存 API](#儲存-api)
2. [編輯器 API](#編輯器-api)
3. [媒體管理 API](#媒體管理-api)
4. [內容轉換 API](#內容轉換-api)
5. [錯誤處理](#錯誤處理)

---

## 儲存 API

### StorageProvider 介面

存儲抽象層支援可切換的後端（Supabase Storage / AWS S3）。

```typescript
interface StorageProvider {
  upload(file: File, options: UploadOptions): Promise<UploadResult>
  download(path: string): Promise<Blob>
  delete(path: string): Promise<void>
  list(prefix: string): Promise<FileInfo[]>
  getPublicUrl(path: string): string
  getSignedUrl(path: string, expiresIn: number): Promise<string>
}

interface UploadOptions {
  path: string
  contentType?: string
  metadata?: Record<string, string>
}

interface UploadResult {
  path: string
  url: string
  mediaId: string
}
```

### 使用示例

```typescript
import { storageService } from '@/services/storageService'

// 上傳檔案
const result = await storageService.upload(file, {
  path: `media/${articleId}/image-${Date.now()}.jpg`,
  contentType: 'image/jpeg'
})

// 取得簽署 URL（用於內聯播放音訊）
const signedUrl = await storageService.getSignedUrl(
  `media/${articleId}/audio.mp3`,
  3600 // 1 小時過期
)

// 刪除檔案
await storageService.delete(`media/${articleId}/image.jpg`)

// 列出媒體檔案
const files = await storageService.list(`media/${articleId}/`)
```

### 支援的儲存提供者

1. **SupabaseStorageAdapter** (預設)
   - 使用環境變數: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`
   - Bucket 名稱: `media`
   - RLS 政策: 公開讀取，認證使用者寫入

2. **MockStorageAdapter** (測試)
   - 內存模擬，無外部依賴
   - 用於單元測試和開發

---

## 編輯器 API

### RichTextEditor 元件

主要 WYSIWYG 編輯器元件，基於 TipTap。

```typescript
interface RichTextEditorProps {
  initialContent: string  // HTML 內容
  onChange?: (content: string) => void  // 內容變更回呼
  onImageUpload?: (file: File) => Promise<string>  // 圖片上傳
  onAudioUpload?: (file: File) => Promise<string>  // 音訊上傳
  disabled?: boolean  // 禁用編輯
  placeholder?: string  // 預留位置文字
}

interface EditorState {
  content: string
  isModified: boolean
  lastSavedAt?: Date
}
```

### 使用示例

```typescript
import RichTextEditor from '@/components/RichTextEditor'

<RichTextEditor
  initialContent={article.content}
  onChange={(content) => {
    // 更新文章內容
    setArticle({ ...article, content })
  }}
  onImageUpload={async (file) => {
    // 上傳圖片並回傳 URL
    const result = await storageService.upload(file, {
      path: `media/${articleId}/image-${Date.now()}.jpg`
    })
    return result.url
  }}
/>
```

### 支援的格式

**文字格式**:
- 粗體
- 斜體
- 底線
- 刪除線
- 上標和下標
- 色彩
- 螢光筆

**區塊格式**:
- 標題 (H1-H6)
- 段落
- 有序清單
- 無序清單
- 程式碼區塊
- 引用塊

**多媒體**:
- 圖片（JPEG、PNG、WebP、GIF）
- YouTube 影片（URL 自動識別）
- 音訊播放器（MP3、WAV、OGG、M4A、AAC、FLAC）
- 超連結

---

## 媒體管理 API

### useMediaUpload Hook

管理媒體上傳流程。

```typescript
const { upload, isUploading, progress, error } = useMediaUpload({
  articleId,
  mediaType: 'image',
  onProgress: (percent) => setUploadProgress(percent),
  onSuccess: (url, mediaId) => {
    // 插入編輯器
  }
})

await upload(file)
```

### MediaService

媒體驗證和優化。

```typescript
// 驗證檔案
const validation = mediaService.validateFile(file, 'image')

// 生成唯一識別碼
const mediaId = mediaService.generateMediaId()
```

### ImageOptimizer

圖片自動優化。

```typescript
const optimized = await imageOptimizer.optimizeImage(file, {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8,
  targetFormat: 'webp'
})
```

---

## 內容轉換 API

### ContentConverter

在 Markdown、HTML 和 TipTap 格式之間轉換。

```typescript
// Markdown → TipTap
const tiptapJson = contentConverter.markdownToTiptap(markdownText)

// TipTap → Markdown
const markdown = contentConverter.tiptapToMarkdown(tiptapJson)

// HTML → TipTap
const tiptapJson = contentConverter.htmlToTiptap(htmlString)
```

### HtmlSanitizer

XSS 防護清理。

```typescript
const cleanHtml = htmlSanitizer.sanitize(userProvidedHtml)
const isValid = htmlSanitizer.validate(html)
```

---

## 錯誤處理

### 檔案大小限制

| 媒體類型 | 最大大小 |
|---------|--------|
| 圖片    | 10 MB  |
| 音訊    | 50 MB  |

### 支援的檔案格式

| 媒體類型 | 格式 |
|---------|-----|
| 圖片    | JPEG, PNG, WebP, GIF |
| 音訊    | MP3, WAV, OGG, M4A, AAC, FLAC |
| 影片    | YouTube URL |

---

## 性能指標

- **圖片上傳**: 5MB 以下 <5 秒
- **編輯器輸入延遲**: <100ms
- **頁面載入時間**: <2 秒
- **媒體庫搜尋**: <1 秒（1000+ 檔案）

---

## 相關文件

- [plan.md](../plan.md) - 技術架構
- [research.md](../research.md) - 技術研究
- [data-model.md](../data-model.md) - 資料庫設計
- [quickstart.md](../quickstart.md) - 快速入門
