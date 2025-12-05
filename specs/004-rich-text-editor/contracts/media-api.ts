/**
 * 媒體管理 API 契約
 * 定義媒體檔案上傳、管理、優化的統一介面
 */

// ============================================================================
// 媒體服務介面
// ============================================================================

/**
 * 媒體服務
 * 負責媒體檔案的上傳、管理、優化
 */
export interface MediaService {
  /**
   * 上傳媒體檔案
   * @param file - 要上傳的檔案
   * @param options - 上傳選項
   * @returns 媒體檔案記錄
   * @throws MediaError 當上傳失敗時
   */
  upload(file: File, options?: MediaUploadOptions): Promise<MediaFile>

  /**
   * 取得媒體檔案資訊
   * @param mediaId - 媒體 ID
   * @returns 媒體檔案記錄
   * @throws MediaError 當檔案不存在時
   */
  getMedia(mediaId: string): Promise<MediaFile>

  /**
   * 刪除媒體檔案
   * @param mediaId - 媒體 ID
   * @throws MediaError 當刪除失敗或檔案仍被引用時
   */
  deleteMedia(mediaId: string): Promise<void>

  /**
   * 更新媒體檔案元資料
   * @param mediaId - 媒體 ID
   * @param updates - 要更新的欄位
   * @returns 更新後的媒體檔案記錄
   */
  updateMedia(mediaId: string, updates: MediaUpdateInput): Promise<MediaFile>

  /**
   * 列出媒體檔案
   * @param options - 列表選項
   * @returns 媒體檔案列表與分頁資訊
   */
  listMedia(options?: MediaListOptions): Promise<MediaListResult>

  /**
   * 搜尋媒體檔案
   * @param query - 搜尋關鍵字
   * @param options - 搜尋選項
   * @returns 搜尋結果
   */
  searchMedia(query: string, options?: MediaSearchOptions): Promise<MediaListResult>

  /**
   * 取得孤立媒體檔案（未被任何文章引用）
   * @returns 孤立媒體檔案列表
   */
  getOrphanedMedia(): Promise<MediaFile[]>

  /**
   * 批次刪除媒體檔案
   * @param mediaIds - 媒體 ID 陣列
   * @returns 刪除結果
   */
  bulkDelete(mediaIds: string[]): Promise<BulkOperationResult>
}

// ============================================================================
// 媒體檔案類型
// ============================================================================

/**
 * 媒體檔案類型
 */
export type MediaFileType = 'image' | 'audio'

/**
 * 媒體檔案記錄
 */
export interface MediaFile {
  /**
   * 媒體 ID（UUID）
   */
  id: string

  /**
   * 原始檔案名稱
   */
  filename: string

  /**
   * 檔案類型
   */
  fileType: MediaFileType

  /**
   * MIME 類型
   */
  mimeType: string

  /**
   * 檔案大小（bytes）
   */
  fileSize: number

  /**
   * 儲存路徑
   */
  storagePath: string

  /**
   * 儲存提供者
   */
  storageProvider: 'supabase' | 's3'

  /**
   * 公開 URL
   */
  publicUrl: string

  /**
   * 圖片寬度（僅圖片）
   */
  width?: number

  /**
   * 圖片高度（僅圖片）
   */
  height?: number

  /**
   * 替代文字（僅圖片）
   */
  altText?: string

  /**
   * 圖片標題（僅圖片）
   */
  caption?: string

  /**
   * 音訊時長（秒，僅音訊）
   */
  duration?: number

  /**
   * 使用次數
   */
  usageCount: number

  /**
   * 引用此媒體的文章 ID 陣列
   */
  referencedArticles: string[]

  /**
   * 上傳者 user_id
   */
  uploadedBy: string

  /**
   * 上傳時間
   */
  uploadedAt: Date

  /**
   * 最後更新時間
   */
  updatedAt: Date
}

// ============================================================================
// 上傳相關類型
// ============================================================================

/**
 * 媒體上傳選項
 */
export interface MediaUploadOptions {
  /**
   * 替代文字（僅圖片）
   */
  altText?: string

  /**
   * 圖片標題（僅圖片）
   */
  caption?: string

  /**
   * 是否自動優化
   * @default true
   */
  autoOptimize?: boolean

  /**
   * 圖片優化選項（僅圖片）
   */
  imageOptimization?: ImageOptimizationOptions

  /**
   * 上傳進度回呼
   */
  onProgress?: (progress: UploadProgress) => void

  /**
   * 是否公開存取
   * @default true
   */
  isPublic?: boolean
}

/**
 * 上傳進度
 */
export interface UploadProgress {
  /**
   * 進度百分比（0-100）
   */
  percent: number

  /**
   * 已上傳大小（bytes）
   */
  uploaded: number

  /**
   * 總大小（bytes）
   */
  total: number

  /**
   * 當前階段
   */
  stage: 'validating' | 'optimizing' | 'uploading' | 'finalizing'
}

// ============================================================================
// 圖片優化
// ============================================================================

/**
 * 圖片優化選項
 */
export interface ImageOptimizationOptions {
  /**
   * 最大寬度（pixels）
   * @default 1920
   */
  maxWidth?: number

  /**
   * 最大高度（pixels）
   * @default 1920
   */
  maxHeight?: number

  /**
   * 最大檔案大小（bytes）
   * @default 1048576 (1MB)
   */
  maxSizeMB?: number

  /**
   * 輸出格式
   * @default 'webp'
   */
  format?: 'webp' | 'jpeg' | 'png'

  /**
   * 圖片品質（0-1）
   * @default 0.85
   */
  quality?: number

  /**
   * 是否使用 Web Worker
   * @default true
   */
  useWebWorker?: boolean

  /**
   * 是否保留 EXIF 資料
   * @default false
   */
  preserveExif?: boolean
}

/**
 * 圖片優化器
 */
export interface ImageOptimizer {
  /**
   * 優化圖片
   * @param file - 原始圖片檔案
   * @param options - 優化選項
   * @returns 優化後的圖片檔案
   * @throws OptimizationError 當優化失敗時
   */
  optimize(file: File, options?: ImageOptimizationOptions): Promise<File>

  /**
   * 取得圖片尺寸
   * @param file - 圖片檔案
   * @returns 圖片寬度與高度
   */
  getImageDimensions(file: File): Promise<{ width: number; height: number }>

  /**
   * 估算壓縮率
   * @param file - 圖片檔案
   * @param options - 優化選項
   * @returns 預估壓縮後大小（bytes）
   */
  estimateCompressedSize(file: File, options?: ImageOptimizationOptions): Promise<number>
}

// ============================================================================
// 媒體驗證
// ============================================================================

/**
 * 媒體驗證器
 */
export interface MediaValidator {
  /**
   * 驗證圖片檔案
   * @param file - 圖片檔案
   * @returns 驗證結果
   */
  validateImage(file: File): Promise<MediaValidationResult>

  /**
   * 驗證音訊檔案
   * @param file - 音訊檔案
   * @returns 驗證結果
   */
  validateAudio(file: File): Promise<MediaValidationResult>

  /**
   * 檢查檔案類型
   * @param file - 檔案
   * @param allowedTypes - 允許的 MIME 類型
   * @returns 是否允許
   */
  checkFileType(file: File, allowedTypes: string[]): boolean

  /**
   * 檢查檔案大小
   * @param file - 檔案
   * @param maxSize - 最大大小（bytes）
   * @returns 是否符合限制
   */
  checkFileSize(file: File, maxSize: number): boolean
}

/**
 * 媒體驗證結果
 */
export interface MediaValidationResult {
  /**
   * 是否有效
   */
  valid: boolean

  /**
   * 錯誤訊息（如果無效）
   */
  errors?: string[]

  /**
   * 警告訊息
   */
  warnings?: string[]

  /**
   * 檔案資訊
   */
  fileInfo?: {
    type: MediaFileType
    mimeType: string
    size: number
    width?: number
    height?: number
    duration?: number
  }
}

// ============================================================================
// 媒體列表與搜尋
// ============================================================================

/**
 * 媒體列表選項
 */
export interface MediaListOptions {
  /**
   * 檔案類型過濾
   */
  fileType?: MediaFileType

  /**
   * 僅顯示已使用的媒體
   */
  onlyUsed?: boolean

  /**
   * 僅顯示未使用的媒體
   */
  onlyUnused?: boolean

  /**
   * 上傳者過濾
   */
  uploadedBy?: string

  /**
   * 分頁：每頁數量
   * @default 20
   */
  limit?: number

  /**
   * 分頁：偏移量
   * @default 0
   */
  offset?: number

  /**
   * 排序欄位
   * @default 'uploadedAt'
   */
  sortBy?: 'filename' | 'fileSize' | 'uploadedAt' | 'usageCount'

  /**
   * 排序方向
   * @default 'desc'
   */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 媒體搜尋選項
 */
export interface MediaSearchOptions extends MediaListOptions {
  /**
   * 搜尋欄位
   * @default ['filename', 'altText', 'caption']
   */
  searchFields?: ('filename' | 'altText' | 'caption')[]

  /**
   * 是否模糊搜尋
   * @default true
   */
  fuzzy?: boolean
}

/**
 * 媒體列表結果
 */
export interface MediaListResult {
  /**
   * 媒體檔案列表
   */
  items: MediaFile[]

  /**
   * 總數量
   */
  total: number

  /**
   * 當前頁數
   */
  page: number

  /**
   * 每頁數量
   */
  pageSize: number

  /**
   * 是否還有下一頁
   */
  hasMore: boolean
}

// ============================================================================
// 媒體更新
// ============================================================================

/**
 * 媒體更新輸入
 */
export interface MediaUpdateInput {
  /**
   * 替代文字（僅圖片）
   */
  altText?: string

  /**
   * 圖片標題（僅圖片）
   */
  caption?: string

  /**
   * 檔案名稱
   */
  filename?: string
}

// ============================================================================
// 批次操作
// ============================================================================

/**
 * 批次操作結果
 */
export interface BulkOperationResult {
  /**
   * 成功數量
   */
  successCount: number

  /**
   * 失敗數量
   */
  failureCount: number

  /**
   * 失敗的項目與原因
   */
  failures: Array<{
    id: string
    reason: string
  }>
}

// ============================================================================
// 文章媒體關聯
// ============================================================================

/**
 * 文章媒體引用類型
 */
export type MediaReferenceType = 'inline' | 'embed' | 'attachment'

/**
 * 文章媒體引用
 */
export interface ArticleMediaReference {
  /**
   * 文章 ID
   */
  articleId: string

  /**
   * 媒體 ID
   */
  mediaId: string

  /**
   * 引用類型
   */
  referenceType: MediaReferenceType

  /**
   * 在文章中的位置順序
   */
  position: number

  /**
   * 建立時間
   */
  createdAt: Date
}

/**
 * 文章媒體管理
 */
export interface ArticleMediaManager {
  /**
   * 將媒體加入文章
   * @param articleId - 文章 ID
   * @param mediaId - 媒體 ID
   * @param referenceType - 引用類型
   * @param position - 位置
   */
  addMediaToArticle(
    articleId: string,
    mediaId: string,
    referenceType: MediaReferenceType,
    position: number
  ): Promise<void>

  /**
   * 從文章移除媒體
   * @param articleId - 文章 ID
   * @param mediaId - 媒體 ID
   */
  removeMediaFromArticle(articleId: string, mediaId: string): Promise<void>

  /**
   * 取得文章使用的所有媒體
   * @param articleId - 文章 ID
   * @returns 媒體檔案列表
   */
  getArticleMedia(articleId: string): Promise<MediaFile[]>

  /**
   * 同步文章內容中的媒體引用
   * 掃描文章內容，自動建立/刪除媒體引用記錄
   * @param articleId - 文章 ID
   * @param content - 文章內容
   */
  syncMediaReferences(articleId: string, content: string | object): Promise<void>
}

// ============================================================================
// 錯誤處理
// ============================================================================

/**
 * 媒體錯誤類型
 */
export enum MediaErrorType {
  /** 檔案類型不支援 */
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',

  /** 檔案大小超過限制 */
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  /** 檔案已存在 */
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',

  /** 媒體不存在 */
  MEDIA_NOT_FOUND = 'MEDIA_NOT_FOUND',

  /** 媒體仍被引用，無法刪除 */
  MEDIA_IN_USE = 'MEDIA_IN_USE',

  /** 優化失敗 */
  OPTIMIZATION_FAILED = 'OPTIMIZATION_FAILED',

  /** 上傳失敗 */
  UPLOAD_FAILED = 'UPLOAD_FAILED',

  /** 權限不足 */
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  /** 儲存配額不足 */
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  /** 未知錯誤 */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 媒體錯誤類別
 */
export class MediaError extends Error {
  constructor(
    public readonly type: MediaErrorType,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'MediaError'
  }

  /**
   * 是否為可重試的錯誤
   */
  get isRetryable(): boolean {
    return [
      MediaErrorType.UPLOAD_FAILED,
      MediaErrorType.OPTIMIZATION_FAILED,
      MediaErrorType.UNKNOWN_ERROR,
    ].includes(this.type)
  }
}

/**
 * 優化錯誤類別
 */
export class OptimizationError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'OptimizationError'
  }
}

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 允許的圖片 MIME 類型
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

/**
 * 允許的音訊 MIME 類型
 */
export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',  // MP3
  'audio/wav',   // WAV
  'audio/ogg',   // OGG
  'audio/mp4',   // M4A
] as const

/**
 * 檔案大小限制（bytes）
 */
export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,  // 10MB
  audio: 50 * 1024 * 1024,  // 50MB
} as const

/**
 * 格式化檔案大小
 * @param bytes - 檔案大小（bytes）
 * @returns 格式化後的字串（例如: "1.5 MB"）
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 從 MIME 類型判斷檔案類型
 * @param mimeType - MIME 類型
 * @returns 媒體檔案類型
 */
export function getFileTypeFromMime(mimeType: string): MediaFileType | null {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  return null
}

/**
 * 格式化音訊時長
 * @param seconds - 秒數
 * @returns 格式化後的時長（例如: "3:45"）
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
