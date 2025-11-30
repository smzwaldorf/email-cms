/**
 * 儲存抽象 API 契約
 * 定義統一的儲存提供者介面，支援 Supabase Storage 和 AWS S3
 */

// ============================================================================
// 核心介面
// ============================================================================

/**
 * 儲存提供者統一介面
 * 所有儲存適配器（Supabase、S3）必須實作此介面
 */
export interface StorageProvider {
  /**
   * 上傳檔案到儲存提供者
   * @param file - 要上傳的檔案
   * @param path - 儲存路徑（相對於 bucket）
   * @param options - 上傳選項
   * @returns 上傳結果包含路徑、URL、大小
   * @throws StorageError 當上傳失敗時
   */
  upload(file: File, path: string, options?: UploadOptions): Promise<UploadResult>

  /**
   * 從儲存提供者下載檔案
   * @param path - 檔案路徑
   * @returns 檔案 Blob
   * @throws StorageError 當檔案不存在或下載失敗時
   */
  download(path: string): Promise<Blob>

  /**
   * 刪除檔案
   * @param path - 要刪除的檔案路徑
   * @throws StorageError 當刪除失敗時
   */
  delete(path: string): Promise<void>

  /**
   * 列出指定前綴的所有檔案
   * @param prefix - 路徑前綴（可選）
   * @param options - 列表選項
   * @returns 檔案元資料陣列
   */
  list(prefix?: string, options?: ListOptions): Promise<FileMetadata[]>

  /**
   * 取得公開存取 URL
   * @param path - 檔案路徑
   * @returns 公開 URL
   */
  getPublicUrl(path: string): string

  /**
   * 取得簽署 URL（限時存取）
   * @param path - 檔案路徑
   * @param expiresIn - 過期時間（秒）
   * @returns 簽署 URL
   * @throws StorageError 當簽署失敗時
   */
  getSignedUrl(path: string, expiresIn: number): Promise<string>

  /**
   * 檢查檔案是否存在
   * @param path - 檔案路徑
   * @returns 是否存在
   */
  exists(path: string): Promise<boolean>

  /**
   * 複製檔案
   * @param sourcePath - 來源路徑
   * @param destPath - 目標路徑
   * @throws StorageError 當複製失敗時
   */
  copy(sourcePath: string, destPath: string): Promise<void>

  /**
   * 移動檔案
   * @param sourcePath - 來源路徑
   * @param destPath - 目標路徑
   * @throws StorageError 當移動失敗時
   */
  move(sourcePath: string, destPath: string): Promise<void>
}

// ============================================================================
// 上傳相關類型
// ============================================================================

/**
 * 上傳選項
 */
export interface UploadOptions {
  /**
   * 內容類型（MIME type）
   * 例如: 'image/jpeg', 'audio/mpeg'
   */
  contentType?: string

  /**
   * 是否為公開存取
   * true: 任何人都可存取
   * false: 需要簽署 URL 才能存取
   * @default false
   */
  isPublic?: boolean

  /**
   * 自訂元資料
   * 可儲存額外資訊如原始檔案名稱、上傳者等
   */
  metadata?: Record<string, string>

  /**
   * 快取控制標頭
   * 例如: 'public, max-age=31536000'
   */
  cacheControl?: string

  /**
   * 是否覆蓋現有檔案
   * @default false
   */
  upsert?: boolean

  /**
   * 上傳進度回呼
   * @param progress - 上傳進度（0-100）
   */
  onProgress?: (progress: number) => void
}

/**
 * 上傳結果
 */
export interface UploadResult {
  /**
   * 儲存路徑（相對於 bucket）
   */
  path: string

  /**
   * 公開存取 URL
   */
  url: string

  /**
   * 檔案大小（bytes）
   */
  size: number

  /**
   * 內容類型（MIME type）
   */
  contentType?: string

  /**
   * ETag（用於快取驗證）
   */
  etag?: string
}

// ============================================================================
// 列表相關類型
// ============================================================================

/**
 * 列表選項
 */
export interface ListOptions {
  /**
   * 最大返回數量
   * @default 100
   */
  limit?: number

  /**
   * 偏移量（分頁）
   * @default 0
   */
  offset?: number

  /**
   * 排序欄位
   * @default 'created_at'
   */
  sortBy?: 'name' | 'size' | 'created_at' | 'updated_at'

  /**
   * 排序方向
   * @default 'desc'
   */
  sortOrder?: 'asc' | 'desc'

  /**
   * 搜尋關鍵字（檔案名稱）
   */
  search?: string
}

/**
 * 檔案元資料
 */
export interface FileMetadata {
  /**
   * 檔案路徑
   */
  path: string

  /**
   * 檔案名稱
   */
  name: string

  /**
   * 檔案大小（bytes）
   */
  size: number

  /**
   * 內容類型（MIME type）
   */
  contentType: string

  /**
   * 建立時間
   */
  createdAt: Date

  /**
   * 最後修改時間
   */
  updatedAt: Date

  /**
   * ETag
   */
  etag?: string

  /**
   * 自訂元資料
   */
  metadata?: Record<string, string>

  /**
   * 公開 URL（如果是公開檔案）
   */
  publicUrl?: string
}

// ============================================================================
// 錯誤處理
// ============================================================================

/**
 * 儲存錯誤類型
 */
export enum StorageErrorType {
  /** 檔案不存在 */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  /** 權限不足 */
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  /** 檔案已存在 */
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',

  /** 檔案大小超過限制 */
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  /** 不支援的檔案類型 */
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',

  /** 網路錯誤 */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** 儲存配額不足 */
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  /** 未知錯誤 */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 儲存錯誤類別
 */
export class StorageError extends Error {
  constructor(
    public readonly type: StorageErrorType,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'StorageError'
  }

  /**
   * 是否為可重試的錯誤
   */
  get isRetryable(): boolean {
    return [
      StorageErrorType.NETWORK_ERROR,
      StorageErrorType.UNKNOWN_ERROR,
    ].includes(this.type)
  }
}

// ============================================================================
// 工廠函數與配置
// ============================================================================

/**
 * 儲存提供者類型
 */
export type StorageProviderType = 'supabase' | 's3'

/**
 * 儲存配置
 */
export interface StorageConfig {
  /**
   * 提供者類型
   */
  provider: StorageProviderType

  /**
   * Bucket 名稱
   */
  bucket: string

  /**
   * 區域（僅 S3）
   */
  region?: string

  /**
   * 端點 URL（可選）
   */
  endpoint?: string

  /**
   * 存取金鑰 ID（僅 S3）
   */
  accessKeyId?: string

  /**
   * 秘密存取金鑰（僅 S3）
   */
  secretAccessKey?: string

  /**
   * Supabase URL（僅 Supabase）
   */
  supabaseUrl?: string

  /**
   * Supabase 匿名金鑰（僅 Supabase）
   */
  supabaseAnonKey?: string
}

/**
 * 建立儲存提供者實例
 * @param config - 儲存配置
 * @returns 儲存提供者實例
 * @throws Error 當配置無效時
 */
export function createStorageProvider(config: StorageConfig): StorageProvider {
  // 實作將在 src/services/storageService.ts 中提供
  throw new Error('Not implemented - use storageService.createStorageProvider()')
}

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 生成唯一檔案路徑
 * 格式: {year}/{month}/{uuid}.{extension}
 * 例如: 2025/11/a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp
 *
 * @param filename - 原始檔案名稱
 * @returns 唯一路徑
 */
export function generateUniqueFilePath(filename: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const uuid = crypto.randomUUID()
  const extension = filename.split('.').pop()?.toLowerCase() || 'bin'

  return `${year}/${month}/${uuid}.${extension}`
}

/**
 * 從 URL 提取檔案路徑
 * @param url - 完整 URL
 * @param bucket - Bucket 名稱
 * @returns 檔案路徑
 */
export function extractPathFromUrl(url: string, bucket: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathMatch = urlObj.pathname.match(new RegExp(`${bucket}/(.+)`))
    return pathMatch ? pathMatch[1] : null
  } catch {
    return null
  }
}

/**
 * 驗證檔案路徑格式
 * @param path - 檔案路徑
 * @returns 是否有效
 */
export function isValidFilePath(path: string): boolean {
  // 不允許 .., /, \\ 等危險字元
  const dangerousPatterns = /(\.\.|\/{2,}|\\)/
  return !dangerousPatterns.test(path) && path.length > 0 && path.length < 1024
}
