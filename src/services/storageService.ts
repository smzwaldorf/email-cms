/**
 * 儲存服務工廠
 * Storage Service Factory
 */

import type { StorageProvider, StorageFactoryOptions, StorageProviderType } from '@/types/storage'
import { SupabaseStorageAdapter } from '@/adapters/SupabaseStorageAdapter'
import { MockStorageAdapter } from '@/adapters/MockStorageAdapter'

/**
 * 全域儲存提供者實例
 * Global storage provider instance
 */
let _storageProvider: StorageProvider | null = null

/**
 * 建立或取得儲存提供者
 * Create or get storage provider
 */
export function createStorageProvider(
  options: StorageFactoryOptions
): StorageProvider {
  // 如果已存在且提供者相同，直接返回
  // Return existing if provider type matches
  if (_storageProvider) {
    const providerName = _storageProvider.getProviderName()
    const expectedName =
      options.provider === 'supabase'
        ? 'SupabaseStorage'
        : options.provider === 'mock'
          ? 'MockStorage'
          : 'S3Storage'

    if (providerName === expectedName) {
      return _storageProvider
    }
  }

  // 建立新的提供者
  // Create new provider
  const provider = _createStorageProvider(options)
  _storageProvider = provider

  return provider
}

/**
 * 內部建立儲存提供者函數
 * Internal storage provider creation function
 */
function _createStorageProvider(
  options: StorageFactoryOptions
): StorageProvider {
  switch (options.provider) {
    case 'supabase': {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey) {
        console.warn(
          'Supabase 環境變數未設定，使用 Mock 適配器 / Supabase env vars not set, using Mock adapter'
        )
        return new MockStorageAdapter()
      }

      return new SupabaseStorageAdapter(supabaseUrl, supabaseKey)
    }

    case 'mock': {
      const simulateDelay = import.meta.env.DEV === true
      return new MockStorageAdapter(simulateDelay, 100)
    }

    case 's3': {
      // S3 適配器（未來實作）
      // S3 Adapter (to be implemented)
      console.warn('S3 適配器尚未實作 / S3 adapter not yet implemented')
      return new MockStorageAdapter()
    }

    default: {
      console.warn(
        `未知的儲存提供者: ${options.provider}，使用 Mock / Unknown provider, using Mock`
      )
      return new MockStorageAdapter()
    }
  }
}

/**
 * 根據環境變數取得預設儲存提供者
 * Get default storage provider from environment
 */
export function getStorageProvider(): StorageProvider {
  if (_storageProvider) {
    return _storageProvider
  }

  const provider = (import.meta.env.VITE_STORAGE_PROVIDER as StorageProviderType) || 'supabase'

  return createStorageProvider({ provider })
}

/**
 * 重置儲存提供者（用於測試）
 * Reset storage provider (for testing)
 */
export function resetStorageProvider(): void {
  _storageProvider = null
}

/**
 * 切換儲存提供者
 * Switch storage provider
 */
export function switchStorageProvider(
  provider: StorageProviderType
): StorageProvider {
  _storageProvider = null // 清除快取
  return createStorageProvider({ provider })
}

/**
 * 取得目前使用的儲存提供者名稱
 * Get current storage provider name
 */
export function getCurrentStorageProviderName(): string {
  const provider = getStorageProvider()
  return provider.getProviderName()
}

/**
 * 驗證儲存提供者連線
 * Verify storage provider connection
 */
export async function verifyStorageConnection(): Promise<boolean> {
  try {
    const provider = getStorageProvider()
    const testBucket = import.meta.env.VITE_SUPABASE_MEDIA_BUCKET || 'media'

    // 嘗試列出檔案以驗證連線
    // Try listing files to verify connection
    await provider.list(testBucket, '', { limit: 1 })

    return true
  } catch (error) {
    console.error('儲存連線驗證失敗 / Storage connection verification failed:', error)
    return false
  }
}

/**
 * 儲存服務 API（便利函數）
 * Storage Service API (convenience functions)
 */
export const storageService = {
  /**
   * 取得提供者實例
   * Get provider instance
   */
  provider: () => getStorageProvider(),

  /**
   * 上傳檔案
   * Upload file
   */
  upload: (
    bucket: string,
    path: string,
    file: File | Blob,
    options?: any,
    onProgress?: any
  ) => {
    return getStorageProvider().upload(bucket, path, file, options, onProgress)
  },

  /**
   * 下載檔案
   * Download file
   */
  download: (bucket: string, path: string) => {
    return getStorageProvider().download(bucket, path)
  },

  /**
   * 刪除檔案
   * Delete file
   */
  delete: (bucket: string, path: string) => {
    return getStorageProvider().delete(bucket, path)
  },

  /**
   * 列出檔案
   * List files
   */
  list: (bucket: string, path: string, options?: any) => {
    return getStorageProvider().list(bucket, path, options)
  },

  /**
   * 取得公開 URL
   * Get public URL
   */
  getPublicUrl: (bucket: string, path: string) => {
    return getStorageProvider().getPublicUrl(bucket, path)
  },

  /**
   * 取得簽署 URL
   * Get signed URL
   */
  getSignedUrl: (bucket: string, path: string, expiresIn?: number) => {
    return getStorageProvider().getSignedUrl(bucket, path, expiresIn)
  },

  /**
   * 檢查檔案是否存在
   * Check if file exists
   */
  exists: (bucket: string, path: string) => {
    return getStorageProvider().exists(bucket, path)
  },

  /**
   * 取得檔案元資料
   * Get file metadata
   */
  getMetadata: (bucket: string, path: string) => {
    return getStorageProvider().getMetadata(bucket, path)
  },

  /**
   * 複製檔案
   * Copy file
   */
  copy: (bucket: string, sourcePath: string, destinationPath: string) => {
    return getStorageProvider().copy(bucket, sourcePath, destinationPath)
  },

  /**
   * 移動檔案
   * Move file
   */
  move: (bucket: string, sourcePath: string, destinationPath: string) => {
    return getStorageProvider().move(bucket, sourcePath, destinationPath)
  },

  /**
   * 取得提供者名稱
   * Get provider name
   */
  getProviderName: () => {
    return getStorageProvider().getProviderName()
  },

  /**
   * 取得儲存統計
   * Get storage statistics
   */
  getStats: () => {
    return getStorageProvider().getStats?.()
  },

  /**
   * 驗證連線
   * Verify connection
   */
  verify: verifyStorageConnection,
}
