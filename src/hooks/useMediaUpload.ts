/**
 * 媒體上傳 Hook - 驗證 → 優化 → 上傳三步驟流程
 * Media Upload Hook - Validation → Optimization → Upload three-step flow
 */

import { useState, useCallback } from 'react'
import type { MediaFile, MediaFileType } from '@/types/media'
import { MediaFileStatus } from '@/types/media'
import { mediaService } from '@/services/mediaService'
import { imageOptimizer } from '@/services/imageOptimizer'
import { storageService } from '@/services/storageService'
import { articleMediaManager } from '@/services/articleMediaManager'
import { getSupabaseClient } from '@/lib/supabase'
import { checkRateLimit, recordUploadAttempt } from '@/services/rateLimiter'
import { quotaManager } from '@/services/quotaManager'

/**
 * 媒體上傳狀態
 * Media upload state
 */
export interface UploadState {
  isUploading: boolean
  progress: number // 0-100
  error: string | null
  uploadedFiles: MediaFile[]
}

/**
 * 上傳進度回呼類型
 * Upload progress callback type
 */
export type UploadProgressCallback = (state: UploadState) => void

/**
 * useMediaUpload Hook
 *
 * 支援的功能:
 * 1. 檔案驗證 (類型、大小)
 * 2. 圖片優化 (壓縮、格式轉換)
 * 3. 檔案上傳 (到 Supabase Storage)
 * 4. 進度追蹤
 * 5. 錯誤處理
 */
export function useMediaUpload() {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    uploadedFiles: [],
  })

  /**
   * 上傳媒體檔案
   * Upload media files
   */
  const uploadFiles = useCallback(
    async (
      files: File[],
      articleId?: string,
      onProgress?: UploadProgressCallback
    ): Promise<MediaFile[]> => {
      setState((prev) => ({
        ...prev,
        isUploading: true,
        error: null,
        uploadedFiles: [],
      }))

      const uploadedFiles: MediaFile[] = []
      const totalSteps = files.length * 3 // 驗證、優化、上傳各 1 步
      let currentStep = 0

      try {
        // 檢查速率限制
        // Check rate limit before proceeding
        const supabaseClient = getSupabaseClient()
        const userId = (await supabaseClient.auth.getUser()).data.user?.id
        if (!userId) {
          throw new Error('User not authenticated')
        }

        const rateLimitStatus = checkRateLimit(userId)
        if (!rateLimitStatus.allowed) {
          const errorMsg = rateLimitStatus.message
          setState((prev) => ({
            ...prev,
            isUploading: false,
            error: errorMsg,
          }))
          throw new Error(errorMsg)
        }

        // 記錄上傳嘗試
        // Record upload attempt
        recordUploadAttempt(userId)

        // 檢查儲存配額
        // Check storage quota
        const totalFilesSize = files.reduce((sum, f) => sum + f.size, 0)
        const quotaCheck = await quotaManager.checkQuota(userId, totalFilesSize)
        if (!quotaCheck.allowed) {
          const errorMsg = quotaCheck.message
          setState((prev) => ({
            ...prev,
            isUploading: false,
            error: errorMsg,
          }))
          throw new Error(errorMsg)
        }

        // 如果接近限制，記錄警告
        // If near limit, log warning
        if (quotaCheck.stats.isNearLimit && !quotaCheck.stats.isAtLimit) {
          const isDev = process.env.NODE_ENV === 'development'
          if (isDev) {
            console.warn(
              `%c⚠️ Storage quota warning: ${quotaCheck.message}`,
              'color: orange; font-weight: bold'
            )
          } else {
            console.warn('Storage quota warning:', quotaCheck.message)
          }
        }

        for (const file of files) {
          // 步驟 1: 驗證
          // Step 1: Validation
          const mediaTypeDetection = await mediaService.detectMediaType(file)
          const mediaType = mediaTypeDetection.type as MediaFileType

          const validationResult = mediaService.validateFile(file, mediaType)
          if (!validationResult.valid) {
            throw new Error(validationResult.errors[0])
          }

          currentStep++
          const progress = Math.round((currentStep / totalSteps) * 100)
          setState((prev) => ({ ...prev, progress }))
          onProgress?.({ ...state, progress, isUploading: true, error: null })

          // 步驟 2: 優化（如果是圖片）
          // Step 2: Optimization (if image)
          let optimizedFile = file
          if (mediaType === 'image') {
            try {
              const result = await imageOptimizer.optimize(file)
              optimizedFile = result.optimizedFile
            } catch (error) {
              console.warn('Image optimization failed, using original:', error)
              // Fallback to original file
              optimizedFile = file
            }
          }

          currentStep++
          setState((prev) => ({
            ...prev,
            progress: Math.round((currentStep / totalSteps) * 100),
          }))
          const progress2 = Math.round((currentStep / totalSteps) * 100)
          onProgress?.({ ...state, progress: progress2, isUploading: true, error: null })

          // 步驟 3: 上傳
          // Step 3: Upload
          const mediaId = mediaService.generateMediaId()
          const storagePath = mediaService.generateStoragePath(
            mediaId,
            file.name,
            userId
          )

          const metadata = await mediaService.createMediaMetadata(
            optimizedFile,
            mediaId,
            userId,
            mediaType
          )

          // 上傳到儲存提供者
          // Upload to storage provider
          const storageProvider = storageService.provider()
          const { success: uploadSuccess, data: uploadData, error: uploadError } = await storageProvider.upload(
            'media',
            storagePath,
            optimizedFile,
            {
              contentType: optimizedFile.type,
              metadata: {
                original_filename: file.name,
                media_type: mediaType,
              },
            }
          )

          if (!uploadSuccess) {
            console.error('Storage upload error:', uploadError)
            throw new Error(`Failed to upload ${file.name}: ${uploadError?.message || 'Unknown error'}`)
          }

          // Construct storage URL
          const finalPath = uploadData?.path || storagePath
          const storageUrl = `storage://media/${finalPath}`

          // 將元資料保存到資料庫
          // Save metadata to database
          const { data: dbFile, error: dbError } = await supabaseClient
            .from('media_files')
            .insert({
              id: mediaId,
              filename: file.name,
              file_size: optimizedFile.size,
              mime_type: optimizedFile.type,
              file_type: mediaType,
              public_url: storageUrl, // Store storage:// URI in public_url column
              storage_path: storagePath,
              width: metadata.width,
              height: metadata.height,
              duration: metadata.duration,
              uploaded_by: userId,
              uploaded_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (dbError) throw dbError

          // 如果指定了文章 ID，將媒體添加到文章
          // If article ID specified, add media to article
          if (articleId && dbFile) {
            await articleMediaManager.addMediaToArticle(articleId, mediaId)
          }

          const mediaFile: MediaFile = {
            id: dbFile.id,
            fileName: dbFile.filename,
            fileSize: dbFile.file_size,
            mimeType: dbFile.mime_type,
            mediaType: dbFile.file_type,
            status: MediaFileStatus.READY,
            uploadedBy: dbFile.uploaded_by,
            uploadedAt: dbFile.uploaded_at,
            updatedAt: dbFile.updated_at,
            publicUrl: dbFile.public_url,
            storageUrl: dbFile.public_url,
            width: dbFile.width,
            height: dbFile.height,
            duration: dbFile.duration,
          }

          uploadedFiles.push(mediaFile)

          currentStep++
          const finalProgress = Math.round((currentStep / totalSteps) * 100)
          setState((prev) => ({ ...prev, progress: finalProgress }))
          onProgress?.({
            uploadedFiles,
            progress: finalProgress,
            isUploading: true,
            error: null,
          })
        }

        setState((prev) => ({
          ...prev,
          isUploading: false,
          progress: 100,
          uploadedFiles,
        }))

        onProgress?.({
          uploadedFiles,
          progress: 100,
          isUploading: false,
          error: null,
        })

        return uploadedFiles
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        setState((prev) => ({
          ...prev,
          isUploading: false,
          error: errorMessage,
          uploadedFiles,
        }))

        onProgress?.({
          uploadedFiles,
          progress: Math.round((currentStep / totalSteps) * 100),
          isUploading: false,
          error: errorMessage,
        })

        throw error
      }
    },
    [state]
  )

  /**
   * 重置上傳狀態
   * Reset upload state
   */
  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null,
      uploadedFiles: [],
    })
  }, [])

  return {
    state,
    uploadFiles,
    reset,
  }
}

export type { UploadState, UploadProgressCallback }
