/**
 * 儲存提供者相關型別定義
 * Storage provider related type definitions
 */

/**
 * 儲存提供者類型
 * Storage provider type
 */
export enum StorageProviderType {
  SUPABASE = 'supabase',
  S3 = 's3',
  MOCK = 'mock',
}

/**
 * 儲存操作結果
 * Storage operation result
 */
export interface StorageOperationResult {
  success: boolean;
  data?: any;
  error?: Error;
  message?: string;
}

/**
 * 儲存配置選項
 * Storage configuration options
 */
export interface StorageConfig {
  provider: StorageProviderType;
  bucket?: string;
  region?: string;
  publicUrl?: string;
  credentials?: Record<string, any>;
}

/**
 * 上傳選項
 * Upload options
 */
export interface UploadOptions {
  public?: boolean; // 公開存取權限 Public access
  metadata?: Record<string, any>; // 自訂元資料 Custom metadata
  upsert?: boolean; // 覆蓋現有檔案 Overwrite existing
  cacheControl?: string; // 快取控制 Cache control header
  contentType?: string; // MIME 類型 MIME type
}

/**
 * 上傳進度回呼
 * Upload progress callback
 */
export interface UploadProgressCallback {
  (progress: {
    loaded: number; // 已上傳位元組 Uploaded bytes
    total: number; // 總位元組 Total bytes
    percentage: number; // 進度百分比 Progress percentage
  }): void;
}

/**
 * 儲存提供者介面
 * Storage provider interface (契約)
 */
export interface StorageProvider {
  /**
   * 上傳檔案
   * Upload a file
   */
  upload(
    bucket: string,
    path: string,
    file: File | Blob,
    options?: UploadOptions,
    onProgress?: UploadProgressCallback
  ): Promise<StorageOperationResult>;

  /**
   * 下載檔案
   * Download a file
   */
  download(bucket: string, path: string): Promise<Blob>;

  /**
   * 刪除檔案
   * Delete a file
   */
  delete(bucket: string, path: string): Promise<StorageOperationResult>;

  /**
   * 列出檔案
   * List files in a directory
   */
  list(
    bucket: string,
    path: string,
    options?: ListOptions
  ): Promise<FileObject[]>;

  /**
   * 取得公開 URL
   * Get public URL
   */
  getPublicUrl(bucket: string, path: string): string;

  /**
   * 取得簽署 URL（臨時存取）
   * Get signed URL for temporary access
   */
  getSignedUrl(
    bucket: string,
    path: string,
    expiresIn?: number
  ): Promise<string>;

  /**
   * 檢查檔案是否存在
   * Check if file exists
   */
  exists(bucket: string, path: string): Promise<boolean>;

  /**
   * 取得檔案元資料
   * Get file metadata
   */
  getMetadata(bucket: string, path: string): Promise<FileMetadata>;

  /**
   * 複製檔案
   * Copy a file
   */
  copy(
    bucket: string,
    sourcePath: string,
    destinationPath: string
  ): Promise<StorageOperationResult>;

  /**
   * 移動檔案
   * Move a file
   */
  move(
    bucket: string,
    sourcePath: string,
    destinationPath: string
  ): Promise<StorageOperationResult>;

  /**
   * 取得儲存提供者名稱
   * Get provider name
   */
  getProviderName(): string;

  /**
   * 取得儲存統計
   * Get storage statistics
   */
  getStats?(): Promise<StorageStats>;
}

/**
 * 儲存檔案物件
 * File object from storage
 */
export interface FileObject {
  name: string; // 檔案名稱 File name
  id: string; // 檔案 ID File ID
  updated_at: string; // 最後更新時間 ISO 8601
  created_at: string; // 建立時間 ISO 8601
  last_accessed_at: string; // 最後存取時間 ISO 8601
  metadata?: Record<string, any>; // 元資料 Metadata
  buckets?: {
    id: string;
    name: string;
  };
}

/**
 * 檔案元資料
 * File metadata
 */
export interface FileMetadata {
  name: string;
  size: number; // 位元組 Bytes
  mimeType: string;
  uploadedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  contentHash?: string;
  customMetadata?: Record<string, any>;
}

/**
 * 列表選項
 * List options
 */
export interface ListOptions {
  limit?: number; // 返回數量限制 Result limit
  offset?: number; // 分頁偏移 Pagination offset
  sortBy?: 'name' | 'updated_at' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  search?: string; // 搜尋檔案名稱 Search filename
}

/**
 * 儲存統計
 * Storage statistics
 */
export interface StorageStats {
  totalSize: number; // 總儲存大小 Total size in bytes
  fileCount: number; // 檔案總數 Total file count
  buckets: {
    name: string;
    size: number;
    fileCount: number;
  }[];
}

/**
 * 儲存服務錯誤
 * Storage service error
 */
export class StorageError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * 儲存服務工廠選項
 * Storage service factory options
 */
export interface StorageFactoryOptions {
  provider: StorageProviderType;
  config?: StorageConfig;
  fallback?: StorageProvider; // 備用提供者 Fallback provider
}

/**
 * 批量上傳請求
 * Batch upload request
 */
export interface BatchUploadRequest {
  bucket: string;
  files: Array<{
    file: File | Blob;
    path: string;
    options?: UploadOptions;
  }>;
  onProgress?: (results: BatchUploadProgress) => void;
}

/**
 * 批量上傳進度
 * Batch upload progress
 */
export interface BatchUploadProgress {
  completed: number; // 完成數量 Completed count
  failed: number; // 失敗數量 Failed count
  total: number; // 總數量 Total count
  percentage: number;
  currentFile?: string;
}

/**
 * 批量上傳結果
 * Batch upload result
 */
export interface BatchUploadResult {
  successful: Array<{
    path: string;
    url: string;
  }>;
  failed: Array<{
    path: string;
    error: Error;
  }>;
}
