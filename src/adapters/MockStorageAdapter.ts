/**
 * Mock 儲存適配器實作（用於測試）
 * Mock Storage Adapter Implementation (for testing)
 */

import type {
  StorageProvider,
  StorageOperationResult,
  UploadOptions,
  UploadProgressCallback,
  FileObject,
  FileMetadata,
  ListOptions,
  StorageStats,
} from '@/types/storage'

interface MockFile {
  name: string
  data: Blob
  metadata: FileMetadata
  uploadedAt: Date
}

/**
 * Mock 儲存實作 - 在記憶體中儲存檔案
 * Mock Storage Implementation - stores files in memory
 */
export class MockStorageAdapter implements StorageProvider {
  private storage: Map<string, Map<string, MockFile>> = new Map()
  private simulateDelay: boolean = false
  private delayMs: number = 100

  constructor(simulateDelay: boolean = false, delayMs: number = 100) {
    this.simulateDelay = simulateDelay
    this.delayMs = delayMs
  }

  /**
   * 延遲輔助函數
   * Delay helper function
   */
  private async delay(): Promise<void> {
    if (this.simulateDelay) {
      return new Promise((resolve) => setTimeout(resolve, this.delayMs))
    }
  }

  /**
   * 上傳檔案
   * Upload a file
   */
  async upload(
    bucket: string,
    path: string,
    file: File | Blob,
    options?: UploadOptions,
    onProgress?: UploadProgressCallback
  ): Promise<StorageOperationResult> {
    try {
      await this.delay()

      // 初始化 bucket（如果不存在）
      // Initialize bucket if not exists
      if (!this.storage.has(bucket)) {
        this.storage.set(bucket, new Map())
      }

      // 報告進度
      // Report progress
      if (onProgress) {
        const size = file instanceof File ? file.size : file.size
        onProgress({
          loaded: 0,
          total: size,
          percentage: 0,
        })

        // 模擬進度
        // Simulate progress
        await this.delay()
        onProgress({
          loaded: Math.floor(size * 0.5),
          total: size,
          percentage: 50,
        })

        await this.delay()
        onProgress({
          loaded: size,
          total: size,
          percentage: 100,
        })
      }

      // 儲存檔案
      // Store file
      const mockFile: MockFile = {
        name: path,
        data: file instanceof File ? new Blob([file]) : file,
        metadata: {
          name: path.split('/').pop() || 'file',
          size: file instanceof File ? file.size : file.size,
          mimeType: file instanceof File ? file.type : 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        uploadedAt: new Date(),
      }

      const bucketFiles = this.storage.get(bucket)!
      bucketFiles.set(path, mockFile)

      return {
        success: true,
        data: { path, id: path },
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
   * 下載檔案
   * Download a file
   */
  async download(bucket: string, path: string): Promise<Blob> {
    await this.delay()

    const bucketFiles = this.storage.get(bucket)
    if (!bucketFiles) {
      throw new Error(`Bucket '${bucket}' not found`)
    }

    const mockFile = bucketFiles.get(path)
    if (!mockFile) {
      throw new Error(`File '${path}' not found`)
    }

    return mockFile.data
  }

  /**
   * 刪除檔案
   * Delete a file
   */
  async delete(bucket: string, path: string): Promise<StorageOperationResult> {
    try {
      await this.delay()

      const bucketFiles = this.storage.get(bucket)
      if (!bucketFiles) {
        throw new Error(`Bucket '${bucket}' not found`)
      }

      const deleted = bucketFiles.delete(path)

      if (!deleted) {
        throw new Error(`File '${path}' not found`)
      }

      return {
        success: true,
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
   * 列出檔案
   * List files
   */
  async list(
    bucket: string,
    path: string,
    options?: ListOptions
  ): Promise<FileObject[]> {
    await this.delay()

    const bucketFiles = this.storage.get(bucket)
    if (!bucketFiles) {
      return []
    }

    // 篩選路徑下的檔案
    // Filter files under the path
    const files = Array.from(bucketFiles.values())
      .filter((f) => f.name.startsWith(path))
      .map((f) => ({
        name: f.name.split('/').pop() || f.name,
        id: f.name,
        updated_at: f.metadata.updatedAt,
        created_at: f.metadata.uploadedAt,
        last_accessed_at: f.uploadedAt.toISOString(),
        metadata: f.metadata,
      }))

    // 排序
    // Sort
    if (options?.sortBy) {
      const sortKey =
        options.sortBy === 'name'
          ? 'name'
          : options.sortBy === 'created_at'
            ? 'created_at'
            : 'updated_at'

      files.sort((a, b) => {
        const aVal = a[sortKey as keyof typeof a] as string
        const bVal = b[sortKey as keyof typeof b] as string
        const comparison = aVal.localeCompare(bVal)
        return options.sortOrder === 'desc' ? -comparison : comparison
      })
    }

    // 分頁
    // Paginate
    const start = options?.offset || 0
    const end = start + (options?.limit || 100)

    return files.slice(start, end)
  }

  /**
   * 取得公開 URL
   * Get public URL
   */
  getPublicUrl(bucket: string, path: string): string {
    // Mock URL format
    return `https://mock-storage.example.com/${bucket}/${path}`
  }

  /**
   * 取得簽署 URL
   * Get signed URL
   */
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600
  ): Promise<string> {
    await this.delay()

    // Mock signed URL with expiration
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    return `https://mock-storage.example.com/${bucket}/${path}?expires=${expiresAt}`
  }

  /**
   * 檢查檔案是否存在
   * Check if file exists
   */
  async exists(bucket: string, path: string): Promise<boolean> {
    await this.delay()

    const bucketFiles = this.storage.get(bucket)
    if (!bucketFiles) {
      return false
    }

    return bucketFiles.has(path)
  }

  /**
   * 取得檔案元資料
   * Get file metadata
   */
  async getMetadata(bucket: string, path: string): Promise<FileMetadata> {
    await this.delay()

    const bucketFiles = this.storage.get(bucket)
    if (!bucketFiles) {
      throw new Error(`Bucket '${bucket}' not found`)
    }

    const mockFile = bucketFiles.get(path)
    if (!mockFile) {
      throw new Error(`File '${path}' not found`)
    }

    return mockFile.metadata
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
      await this.delay()

      const sourceBlob = await this.download(bucket, sourcePath)
      return await this.upload(bucket, destinationPath, sourceBlob)
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
      const copyResult = await this.copy(bucket, sourcePath, destinationPath)

      if (!copyResult.success) {
        return copyResult
      }

      // 再刪除原檔案
      await this.delete(bucket, sourcePath)

      return {
        success: true,
        message: 'File moved successfully',
      }
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
    return 'MockStorage'
  }

  /**
   * 取得儲存統計
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    await this.delay()

    let totalSize = 0
    let fileCount = 0

    this.storage.forEach((bucketFiles) => {
      bucketFiles.forEach((file) => {
        totalSize += file.metadata.size
        fileCount += 1
      })
    })

    return {
      totalSize,
      fileCount,
      buckets: Array.from(this.storage.entries()).map(([name, files]) => ({
        name,
        size: Array.from(files.values()).reduce(
          (sum, f) => sum + f.metadata.size,
          0
        ),
        fileCount: files.size,
      })),
    }
  }

  /**
   * 清空所有儲存（用於測試重置）
   * Clear all storage (for test reset)
   */
  clear(): void {
    this.storage.clear()
  }

  /**
   * 取得特定 bucket 的檔案數量（用於測試驗證）
   * Get file count in bucket (for test verification)
   */
  getBucketFileCount(bucket: string): number {
    return this.storage.get(bucket)?.size || 0
  }
}
