/**
 * Supabase Storage 適配器實作
 * Supabase Storage Adapter Implementation
 */

import { createClient } from '@supabase/supabase-js'
import type {
  StorageProvider,
  StorageOperationResult,
  UploadOptions,
  UploadProgressCallback,
  FileObject,
  FileMetadata,
  ListOptions,
  StorageError,
  StorageStats,
} from '@/types/storage'

export class SupabaseStorageAdapter implements StorageProvider {
  private supabaseUrl: string
  private supabaseKey: string

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseUrl = supabaseUrl
    this.supabaseKey = supabaseKey
  }

  /**
   * 上傳檔案到 Supabase Storage
   * Upload a file to Supabase Storage
   */
  async upload(
    bucket: string,
    path: string,
    file: File | Blob,
    options?: UploadOptions,
    onProgress?: UploadProgressCallback
  ): Promise<StorageOperationResult> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey)

      // 模擬進度回呼（Supabase JS 不直接支援進度）
      // Simulate progress callback (Supabase JS doesn't directly support progress)
      if (onProgress && file instanceof File) {
        onProgress({
          loaded: 0,
          total: file.size,
          percentage: 0,
        })
      }

      // 執行上傳
      // Execute upload
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: options?.upsert || false,
          contentType: options?.contentType || file.type,
        })

      if (error) {
        throw new Error(`Supabase upload error: ${error.message}`)
      }

      // 模擬完成進度
      // Simulate completion progress
      if (onProgress) {
        const size = file instanceof File ? file.size : file.size
        onProgress({
          loaded: size,
          total: size,
          percentage: 100,
        })
      }

      return {
        success: true,
        data,
        message: 'File uploaded successfully',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        message: 'Upload failed',
      }
    }
  }

  /**
   * 從 Supabase Storage 下載檔案
   * Download a file from Supabase Storage
   */
  async download(bucket: string, path: string): Promise<Blob> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey)

      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path)

      if (error) {
        throw new Error(`Supabase download error: ${error.message}`)
      }

      return data
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 從 Supabase Storage 刪除檔案
   * Delete a file from Supabase Storage
   */
  async delete(bucket: string, path: string): Promise<StorageOperationResult> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey)

      const { data, error } = await supabase.storage
        .from(bucket)
        .remove([path])

      if (error) {
        throw new Error(`Supabase delete error: ${error.message}`)
      }

      return {
        success: true,
        data,
        message: 'File deleted successfully',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        message: 'Delete failed',
      }
    }
  }

  /**
   * 列出 Supabase Storage 中的檔案
   * List files in Supabase Storage
   */
  async list(
    bucket: string,
    path: string,
    options?: ListOptions
  ): Promise<FileObject[]> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey)

      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path, {
          limit: options?.limit || 100,
          offset: options?.offset || 0,
          sortBy: {
            column: options?.sortBy || 'name',
            order: options?.sortOrder || 'asc',
          },
          search: options?.search,
        })

      if (error) {
        throw new Error(`Supabase list error: ${error.message}`)
      }

      return data || []
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 取得 Supabase 中檔案的公開 URL
   * Get public URL for a file in Supabase Storage
   */
  getPublicUrl(bucket: string, path: string): string {
    const supabase = createClient(this.supabaseUrl, this.supabaseKey)
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  /**
   * 取得 Supabase 中檔案的簽署 URL
   * Get signed URL for a file in Supabase Storage (with expiration)
   */
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey)

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn)

      if (error) {
        throw new Error(`Supabase signed URL error: ${error.message}`)
      }

      return data.signedUrl
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 檢查檔案是否存在
   * Check if a file exists
   */
  async exists(bucket: string, path: string): Promise<boolean> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey)

      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path.substring(0, path.lastIndexOf('/')))

      if (error) return false

      return (data || []).some((file) => file.name === path.split('/').pop())
    } catch {
      return false
    }
  }

  /**
   * 取得檔案元資料
   * Get file metadata
   */
  async getMetadata(bucket: string, path: string): Promise<FileMetadata> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey)

      // Supabase doesn't provide direct metadata, we'll use info method
      const { data: list } = await supabase.storage
        .from(bucket)
        .list(path.substring(0, path.lastIndexOf('/')))

      const file = (list || []).find((f) => f.name === path.split('/').pop())

      if (!file) {
        throw new Error('File not found')
      }

      return {
        name: file.name,
        size: file.metadata?.size || 0,
        mimeType: file.metadata?.mimetype || 'unknown',
        uploadedAt: file.created_at,
        updatedAt: file.updated_at,
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 複製檔案
   * Copy a file
   */
  async copy(
    bucket: string,
    sourcePath: string,
    destinationPath: string
  ): Promise<StorageOperationResult> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey)

      // 下載來源檔案
      // Download source file
      const sourceBlob = await this.download(bucket, sourcePath)

      // 上傳到目標路徑
      // Upload to destination path
      const uploadResult = await this.upload(bucket, destinationPath, sourceBlob)

      return uploadResult
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        message: 'Copy failed',
      }
    }
  }

  /**
   * 移動檔案
   * Move a file
   */
  async move(
    bucket: string,
    sourcePath: string,
    destinationPath: string
  ): Promise<StorageOperationResult> {
    try {
      // 先複製
      // Copy first
      const copyResult = await this.copy(bucket, sourcePath, destinationPath)

      if (!copyResult.success) {
        return copyResult
      }

      // 再刪除原檔案
      // Then delete source
      const deleteResult = await this.delete(bucket, sourcePath)

      return deleteResult
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        message: 'Move failed',
      }
    }
  }

  /**
   * 取得提供者名稱
   * Get provider name
   */
  getProviderName(): string {
    return 'SupabaseStorage'
  }

  /**
   * 取得儲存統計
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey)

      // 此功能需要管理 API，暫時返回預設值
      // This feature requires admin API, return default for now
      return {
        totalSize: 0,
        fileCount: 0,
        buckets: [],
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }
}
