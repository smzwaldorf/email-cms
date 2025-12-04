/**
 * 圖片最佳化服務
 * Image Optimization Service
 */

import imageCompression from 'browser-image-compression'
import type { ImageOptimizationOptions } from '@/types/media'

/**
 * 圖片最佳化結果
 * Image optimization result
 */
export interface OptimizationResult {
  originalFile: File
  optimizedFile: File
  originalSize: number
  optimizedSize: number
  compressionRatio: number
  width: number
  height: number
  format: string
}

/**
 * 預定義的最佳化配置
 * Predefined optimization configurations
 */
export const optimizationPresets = {
  /**
   * 高品質 - 最小壓縮
   * High quality - minimal compression
   */
  high: {
    maxWidthOrHeight: 2560,
    maxSizeMB: 5,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.95,
  },

  /**
   * 標準 - 平衡品質與檔案大小
   * Standard - balance quality and file size
   */
  standard: {
    maxWidthOrHeight: 1920,
    maxSizeMB: 2,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8,
  },

  /**
   * 低容量 - 最大壓縮
   * Low bandwidth - maximum compression
   */
  low: {
    maxWidthOrHeight: 1024,
    maxSizeMB: 0.5,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.6,
  },

  /**
   * 縮圖 - 用於預覽
   * Thumbnail - for previews
   */
  thumbnail: {
    maxWidthOrHeight: 256,
    maxSizeMB: 0.1,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.7,
  },
}

/**
 * 圖片最佳化服務
 * Image Optimization Service
 */
export const imageOptimizer = {
  /**
   * 最佳化圖片檔案
   * Optimize image file
   */
  async optimize(
    file: File,
    options?: ImageOptimizationOptions
  ): Promise<OptimizationResult> {
    try {
      // 驗證檔案類型
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error(`無效的圖片類型: ${file.type} / Invalid image type: ${file.type}`)
      }

      // 取得原始圖片尺寸
      // Get original dimensions
      const originalDimensions = await this._getImageDimensions(file)

      // 計算目標尺寸
      // Calculate target dimensions
      const targetDimensions = this._calculateDimensions(
        originalDimensions.width,
        originalDimensions.height,
        options?.maxWidth,
        options?.maxHeight
      )

      // 建立壓縮選項
      // Create compression options
      const compressionOptions = {
        maxSizeMB: options?.quality ? (5 * options.quality) / 100 : 2,
        maxWidthOrHeight: Math.max(
          targetDimensions.width,
          targetDimensions.height
        ),
        useWebWorker: true,
        fileType: options?.convertToWebP ? 'image/webp' : file.type,
      }

      // 執行壓縮
      // Execute compression
      const optimizedFile = await imageCompression(file, compressionOptions)

      // 取得最佳化後的尺寸
      // Get optimized dimensions
      const optimizedDimensions = await this._getImageDimensions(optimizedFile)

      return {
        originalFile: file,
        optimizedFile,
        originalSize: file.size,
        optimizedSize: optimizedFile.size,
        compressionRatio: (optimizedFile.size / file.size) * 100,
        width: optimizedDimensions.width,
        height: optimizedDimensions.height,
        format: optimizedFile.type,
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  },

  /**
   * 批量最佳化圖片
   * Optimize multiple images
   */
  async optimizeBatch(
    files: File[],
    options?: ImageOptimizationOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = []

    for (let i = 0; i < files.length; i++) {
      try {
        const result = await this.optimize(files[i], options)
        results.push(result)
        onProgress?.(i + 1, files.length)
      } catch (error) {
        console.error(`最佳化圖片 ${files[i].name} 失敗 / Failed to optimize ${files[i].name}:`, error)
        // 繼續處理其他檔案
        // Continue with next file
        onProgress?.(i + 1, files.length)
      }
    }

    return results
  },

  /**
   * 調整圖片大小
   * Resize image
   */
  async resize(
    file: File,
    targetWidth: number,
    targetHeight: number
  ): Promise<File> {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => {
          const img = new Image()

          img.onload = () => {
            // 建立 canvas 元素
            // Create canvas element
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')

            if (!ctx) {
              reject(new Error('無法取得 canvas context / Unable to get canvas context'))
              return
            }

            // 計算新尺寸（保持寬高比）
            // Calculate new size (preserve aspect ratio)
            const ratio = Math.min(
              targetWidth / img.width,
              targetHeight / img.height
            )
            const newWidth = img.width * ratio
            const newHeight = img.height * ratio

            canvas.width = targetWidth
            canvas.height = targetHeight

            // 在中心繪製圖片
            // Draw image in center
            const x = (targetWidth - newWidth) / 2
            const y = (targetHeight - newHeight) / 2
            ctx.drawImage(img, x, y, newWidth, newHeight)

            // 轉換為 File
            // Convert to File
            canvas.toBlob((blob) => {
              if (blob) {
                const resizedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                })
                resolve(resizedFile)
              } else {
                reject(new Error('無法建立調整後的圖片 / Unable to create resized image'))
              }
            }, 'image/jpeg', 0.95)
          }

          img.onerror = () => {
            reject(new Error('無法載入圖片 / Unable to load image'))
          }

          img.src = e.target?.result as string
        }

        reader.onerror = () => {
          reject(new Error('無法讀取檔案 / Unable to read file'))
        }

        reader.readAsDataURL(file)
      })
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  },

  /**
   * 轉換圖片格式
   * Convert image format
   */
  async convertFormat(
    file: File,
    targetFormat: 'image/webp' | 'image/jpeg' | 'image/png'
  ): Promise<File> {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => {
          const img = new Image()

          img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height

            const ctx = canvas.getContext('2d')
            if (!ctx) {
              reject(new Error('無法取得 canvas context'))
              return
            }

            ctx.drawImage(img, 0, 0)

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const extension = targetFormat.split('/')[1]
                  const newName = `${file.name.split('.')[0]}.${extension}`
                  const convertedFile = new File([blob], newName, {
                    type: targetFormat,
                  })
                  resolve(convertedFile)
                } else {
                  reject(new Error('無法轉換圖片格式'))
                }
              },
              targetFormat,
              0.95
            )
          }

          img.onerror = () => {
            reject(new Error('無法載入圖片'))
          }

          img.src = e.target?.result as string
        }

        reader.onerror = () => {
          reject(new Error('無法讀取檔案'))
        }

        reader.readAsDataURL(file)
      })
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  },

  /**
   * 生成圖片預覽 URL
   * Generate image preview URL
   */
  generatePreviewUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        resolve(e.target?.result as string)
      }

      reader.onerror = () => {
        reject(new Error('無法讀取檔案 / Unable to read file'))
      }

      reader.readAsDataURL(file)
    })
  },

  /**
   * 取得最佳化建議
   * Get optimization recommendations
   */
  async getRecommendations(file: File): Promise<string[]> {
    const recommendations: string[] = []

    try {
      const dimensions = await this._getImageDimensions(file)
      const maxDimension = Math.max(dimensions.width, dimensions.height)

      // 檢查尺寸
      // Check dimensions
      if (maxDimension > 2560) {
        recommendations.push(
          `圖片過大 (${maxDimension}px)，建議縮小到 2560px / Image too large (${maxDimension}px), recommend resize to 2560px`
        )
      }

      // 檢查檔案大小
      // Check file size
      if (file.size > 5 * 1024 * 1024) {
        recommendations.push(
          `檔案大小過大 (${this._formatFileSize(file.size)})，建議壓縮 / File size too large, recommend compression`
        )
      }

      // 檢查格式
      // Check format
      if (!['image/webp', 'image/jpeg', 'image/png'].includes(file.type)) {
        recommendations.push(
          `建議轉換為 WebP 格式以減少檔案大小 / Recommend converting to WebP format`
        )
      }

      // 檢查長寬比
      // Check aspect ratio
      const aspectRatio = dimensions.width / dimensions.height
      if (aspectRatio > 5 || aspectRatio < 0.2) {
        recommendations.push(
          `圖片長寬比極端 (${aspectRatio.toFixed(2)}:1)，可能需要調整 / Extreme aspect ratio, may need adjustment`
        )
      }
    } catch (error) {
      console.error('獲取建議時出錯 / Error getting recommendations:', error)
    }

    return recommendations
  },

  // ===== 私有輔助方法 / Private helper methods =====

  /**
   * 取得圖片尺寸
   * Get image dimensions
   */
  _getImageDimensions(
    file: File | Blob
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
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
          reject(new Error('無法載入圖片 / Unable to load image'))
        }

        img.src = e.target?.result as string
      }

      reader.onerror = () => {
        reject(new Error('無法讀取檔案 / Unable to read file'))
      }

      reader.readAsDataURL(file)
    })
  },

  /**
   * 計算目標尺寸
   * Calculate target dimensions
   */
  _calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth?: number,
    maxHeight?: number
  ): { width: number; height: number } {
    if (!maxWidth && !maxHeight) {
      return { width: originalWidth, height: originalHeight }
    }

    const max = Math.max(maxWidth || originalWidth, maxHeight || originalHeight)
    const ratio = Math.min(
      (maxWidth || originalWidth) / originalWidth,
      (maxHeight || originalHeight) / originalHeight
    )

    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio),
    }
  },

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
  },
}
