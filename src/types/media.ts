/**
 * 媒體檔案相關型別定義
 * Media file related type definitions
 */

/**
 * 支援的媒體檔案類型
 * Supported media file types
 */
export enum MediaFileType {
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

/**
 * 支援的圖片格式
 * Supported image formats
 */
export enum ImageFormat {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
  GIF = 'image/gif',
}

/**
 * 支援的音訊格式
 * Supported audio formats
 */
export enum AudioFormat {
  MP3 = 'audio/mpeg',
  WAV = 'audio/wav',
  OGG = 'audio/ogg',
  M4A = 'audio/mp4',
}

/**
 * 媒體檔案狀態
 * Media file status
 */
export enum MediaFileStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error',
  DELETED = 'deleted',
}

/**
 * 媒體檔案元資料
 * Media file metadata
 */
export interface MediaFile {
  id: string; // UUID
  fileName: string; // 原始檔案名稱 Original file name
  fileSize: number; // 檔案大小（位元組） File size in bytes
  mimeType: string; // MIME 類型 MIME type
  mediaType: MediaFileType; // 媒體類型分類
  status: MediaFileStatus; // 檔案狀態
  uploadedAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  uploadedBy: string; // 使用者 ID User ID
  publicUrl?: string; // 公開 URL（如適用）Public URL if applicable
  signedUrl?: string; // 簽署 URL（臨時存取）Signed URL for temporary access
  storageUrl?: string; // 儲存路徑 URI Storage URI (storage://...)
  // 圖片專用欄位
  width?: number; // 圖片寬度（像素）
  height?: number; // 圖片高度（像素）
  // 音訊專用欄位
  duration?: number; // 音訊時長（秒）Duration in seconds
}

/**
 * 媒體檔案上傳進度
 * Media upload progress tracking
 */
export interface MediaUploadProgress {
  fileId: string;
  fileName: string;
  progress: number; // 0-100
  loaded: number; // 已上傳位元組 Uploaded bytes
  total: number; // 總位元組 Total bytes
  status: MediaFileStatus;
  error?: string;
}

/**
 * 圖片最佳化選項
 * Image optimization options
 */
export interface ImageOptimizationOptions {
  maxWidth?: number; // 最大寬度 Max width in pixels
  maxHeight?: number; // 最大高度 Max height in pixels
  quality?: number; // 品質 0-100
  convertToWebP?: boolean; // 轉換為 WebP
  preserveAspectRatio?: boolean; // 保持寬高比 Preserve aspect ratio
}

/**
 * 圖片屬性
 * Image properties in content
 */
export interface ImageProperties {
  mediaId: string; // 參考媒體檔案 ID
  alt: string; // 替代文字 Alternative text
  caption?: string; // 圖片標題 Image caption
  width?: number; // 顯示寬度 Display width
  height?: number; // 顯示高度 Display height
  align?: 'left' | 'center' | 'right'; // 對齊方式 Alignment
}

/**
 * 音訊屬性
 * Audio properties in content
 */
export interface AudioProperties {
  mediaId: string; // 參考媒體檔案 ID
  title?: string; // 音訊標題 Audio title
  autoplay?: boolean;
  controls?: boolean; // 顯示控制項 Show controls
  loop?: boolean;
}

/**
 * YouTube 影片嵌入屬性
 * YouTube video embed properties
 */
export interface YoutubeEmbedProperties {
  videoId: string;
  startTime?: number; // 開始時間（秒）Start time in seconds
  width?: number;
  height?: number;
  aspectRatio?: 'auto' | '16:9' | '4:3'; // 寬高比 Aspect ratio
}

/**
 * 文章媒體參考
 * Article media reference
 */
export interface ArticleMediaReference {
  id: string; // UUID
  articleId: string; // 文章 ID Article ID
  mediaId: string; // 媒體檔案 ID Media file ID
  referenceType: 'image' | 'audio' | 'video'; // 參考類型 Reference type
  position?: number; // 在內容中的位置 Position in content
  properties?: ImageProperties | AudioProperties | YoutubeEmbedProperties;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * 媒體庫過濾選項
 * Media library filter options
 */
export interface MediaLibraryFilter {
  mediaTypes?: MediaFileType[]; // 篩選類型
  search?: string; // 搜尋關鍵字 Search keyword
  sortBy?: 'name' | 'size' | 'date'; // 排序方式 Sort by
  sortOrder?: 'asc' | 'desc'; // 排序順序 Sort order
  pageSize?: number; // 每頁項目數 Items per page
  offset?: number; // 分頁偏移 Pagination offset
}

/**
 * 媒體庫查詢結果
 * Media library query results
 */
export interface MediaLibraryResult {
  items: MediaFile[];
  total: number;
  hasMore: boolean;
  offset: number;
  pageSize: number;
}

/**
 * 媒體驗證結果
 * Media validation result
 */
export interface MediaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 媒體上傳請求選項
 * Media upload request options
 */
export interface MediaUploadOptions {
  file: File;
  mediaType: MediaFileType;
  optimize?: boolean; // 是否最佳化 Whether to optimize
  optimizationOptions?: ImageOptimizationOptions;
  onProgress?: (progress: MediaUploadProgress) => void;
  onError?: (error: Error) => void;
  onSuccess?: (mediaFile: MediaFile) => void;
}
