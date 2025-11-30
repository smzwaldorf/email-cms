/**
 * 媒體服務 - 媒體檔案管理與驗證
 * Media Service - Media file management and validation
 */

import type {
  MediaFile,
  MediaValidationResult,
  ImageProperties,
  AudioProperties,
} from '@/types/media'
import { MediaFileType, MediaFileStatus } from '@/types/media'

/**
 * 支援的 MIME 類型
 * Supported MIME types
 */
const SUPPORTED_MIME_TYPES: Record<MediaFileType, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
  document: ['application/pdf', 'text/plain'],
}

/**
 * 檔案大小限制（位元組）
 * File size limits (bytes)
 */
const FILE_SIZE_LIMITS: Record<MediaFileType, number> = {
  image: 10 * 1024 * 1024, // 10MB
  audio: 50 * 1024 * 1024, // 50MB
  video: 500 * 1024 * 1024, // 500MB
  document: 50 * 1024 * 1024, // 50MB
}

/**
 * 媒體服務類
 * Media Service class
 */
export class MediaService {
  /**
   * 驗證媒體檔案
   * Validate media file
   */
  validateFile(
    file: File,
    mediaType: MediaFileType
  ): MediaValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 檔案大小驗證
    // File size validation
    const maxSize = FILE_SIZE_LIMITS[mediaType]
    if (file.size > maxSize) {
      errors.push(
        `檔案大小超過限制。最大: ${this._formatFileSize(maxSize)}, 實際: ${this._formatFileSize(file.size)} / File size exceeds limit. Max: ${this._formatFileSize(maxSize)}, Actual: ${this._formatFileSize(file.size)}`
      )
    }

    // MIME 類型驗證
    // MIME type validation
    const allowedMimes = SUPPORTED_MIME_TYPES[mediaType]
    if (!allowedMimes.includes(file.type)) {
      errors.push(
        `不支援的檔案格式: ${file.type}。支援的格式: ${allowedMimes.join(', ')} / Unsupported file type: ${file.type}. Supported: ${allowedMimes.join(', ')}`
      )
    }

    // 檔案名稱驗證
    // File name validation
    if (!this._isValidFileName(file.name)) {
      errors.push(
        '檔案名稱包含無效字元 / File name contains invalid characters'
      )
    }

    // 警告檢查
    // Warning checks
    if (file.size > maxSize * 0.8) {
      warnings.push('檔案大小接近限制 / File size approaching limit')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * 檢測媒體檔案的實際類型
   * Detect actual media file type
   */
  async detectMediaType(
    file: File
  ): Promise<{ type: MediaFileType; confidence: number }> {
    const mimeType = file.type.split('/')[0]

    switch (mimeType) {
      case 'image':
        return { type: MediaFileType.IMAGE, confidence: 1.0 }
      case 'audio':
        return { type: MediaFileType.AUDIO, confidence: 1.0 }
      case 'video':
        return { type: MediaFileType.VIDEO, confidence: 1.0 }
      default:
        return { type: MediaFileType.DOCUMENT, confidence: 0.8 }
    }
  }

  /**
   * 取得圖片尺寸
   * Get image dimensions
   */
  async getImageDimensions(
    file: File
  ): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(null)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          resolve({
            width: img.width,
            height: img.height,
          })
        }
        img.onerror = () => {
          resolve(null)
        }
        img.src = e.target?.result as string
      }
      reader.onerror = () => {
        resolve(null)
      }
      reader.readAsDataURL(file)
    })
  }

  /**
   * 取得音訊時長
   * Get audio duration
   */
  async getAudioDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      if (!file.type.startsWith('audio/')) {
        resolve(null)
        return
      }

      const audio = new Audio()
      audio.onloadedmetadata = () => {
        resolve(audio.duration)
      }
      audio.onerror = () => {
        resolve(null)
      }
      audio.src = URL.createObjectURL(file)
    })
  }

  /**
   * 生成唯一的媒體檔案 ID
   * Generate unique media file ID
   */
  generateMediaId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 生成媒體檔案的儲存路徑
   * Generate storage path for media file
   */
  generateStoragePath(
    mediaId: string,
    originalFileName: string,
    userId: string
  ): string {
    const extension = originalFileName.split('.').pop() || 'bin'
    return `media/${userId}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${mediaId}.${extension}`
  }

  /**
   * 建立媒體檔案元資料
   * Create media file metadata
   */
  async createMediaMetadata(
    file: File,
    mediaId: string,
    userId: string,
    mediaType: MediaFileType
  ): Promise<Partial<MediaFile>> {
    const metadata: Partial<MediaFile> = {
      id: mediaId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      mediaType,
      status: MediaFileStatus.PENDING,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 取得圖片尺寸
    // Get image dimensions
    if (mediaType === MediaFileType.IMAGE) {
      const dimensions = await this.getImageDimensions(file)
      if (dimensions) {
        metadata.width = dimensions.width
        metadata.height = dimensions.height
      }
    }

    // 取得音訊時長
    // Get audio duration
    if (mediaType === MediaFileType.AUDIO) {
      const duration = await this.getAudioDuration(file)
      if (duration !== null) {
        metadata.duration = duration
      }
    }

    return metadata
  }

  /**
   * 驗證圖片屬性
   * Validate image properties
   */
  validateImageProperties(props: ImageProperties): MediaValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 驗證替代文字
    // Validate alt text
    if (!props.alt || props.alt.trim().length === 0) {
      warnings.push(
        '建議新增替代文字以改善無障礙性 / Recommended to add alt text for accessibility'
      )
    }

    // 驗證對齊方式
    // Validate alignment
    const validAlignments = ['left', 'center', 'right']
    if (props.align && !validAlignments.includes(props.align)) {
      errors.push(
        `無效的對齊方式: ${props.align} / Invalid alignment: ${props.align}`
      )
    }

    // 驗證寬高
    // Validate dimensions
    if (props.width && props.width < 0) {
      errors.push('寬度不能為負數 / Width cannot be negative')
    }
    if (props.height && props.height < 0) {
      errors.push('高度不能為負數 / Height cannot be negative')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * 驗證音訊屬性
   * Validate audio properties
   */
  validateAudioProperties(props: AudioProperties): MediaValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!props.mediaId) {
      errors.push('缺少媒體檔案 mediaId / Missing media file mediaId')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * 檢查檔案是否重複（簡單實現）
   * Check if file is duplicate (simple implementation)
   */
  async checkDuplicate(file: File): Promise<{ isDuplicate: boolean; hash: string }> {
    try {
      // 計算檔案雜湊值
      // Calculate file hash
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      // 實際應用中應查詢資料庫
      // In real application, should query database
      return {
        isDuplicate: false,
        hash,
      }
    } catch (error) {
      console.error('Hash calculation error:', error)
      // Fallback: generate simple hash from file size only (content-based)
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let hash = ''
      for (let i = 0; i < bytes.length; i++) {
        hash += bytes[i].toString(16).padStart(2, '0')
        if (i > 100) break // Only use first 100 bytes for speed
      }
      return {
        isDuplicate: false,
        hash: hash || `fallback-${file.size}`,
      }
    }
  }

  // ===== 私有輔助方法 / Private helper methods =====

  /**
   * 格式化檔案大小
   * Format file size
   */
  _formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 檢查檔案名稱是否有效
   * Check if file name is valid
   */
  _isValidFileName(fileName: string): boolean {
    // 檢查無效字元
    // Check invalid characters
    const invalidChars = /[<>:"|?*\x00-\x1f]/g
    return !invalidChars.test(fileName)
  }

  /**
   * 取得環境變數中的檔案大小限制
   * Get file size limits from environment variables
   */
  getFileSizeLimit(mediaType: MediaFileType): number {
    const envLimit = import.meta.env[`VITE_MEDIA_MAX_${mediaType.toUpperCase()}_SIZE`]
    return envLimit ? parseInt(envLimit) : FILE_SIZE_LIMITS[mediaType]
  }
}

/**
 * 全域媒體服務實例
 * Global media service instance
 */
export const mediaService = new MediaService()

/**
 * 媒體服務工廠函數
 * Media service factory function
 */
export function createMediaService(): MediaService {
  return new MediaService()
}
