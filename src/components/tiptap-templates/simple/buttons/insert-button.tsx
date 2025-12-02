/**
 * InsertButton Component
 * Enhanced button for inserting images with full upload workflow
 * Integrates ImageUploader component with useMediaUpload hook
 */

import { Editor } from '@tiptap/react'
import { Image as ImageIcon } from 'lucide-react'
import { useState, useRef } from 'react'
import { useMediaUpload } from '@/hooks/useMediaUpload'
import ImageUploader from '@/components/ImageUploader'
import type { UploadState } from '@/hooks/useMediaUpload'

interface InsertButtonProps {
  editor: Editor
  articleId?: string
}

export function InsertButton({ editor, articleId }: InsertButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showUploader, setShowUploader] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    uploadedFiles: [],
  })
  const { uploadFiles } = useMediaUpload()

  /**
   * 處理基本圖片插入 (仍保留後向相容性)
   * Handle basic image insertion (keep for backward compatibility)
   */
  const handleBasicImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      // 使用新的上傳流程
      // Use new upload flow
      handleFilesSelected(files)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * 處理檔案選擇 (來自 ImageUploader 或檔案輸入)
   * Handle file selection (from ImageUploader or file input)
   */
  const handleFilesSelected = async (files: File[]) => {
    if (!editor) return

    try {
      // 使用 useMediaUpload hook 上傳檔案
      // Use useMediaUpload hook to upload files
      const uploadedFiles = await uploadFiles(files, articleId, (state) => {
        setUploadState(state)
      })

      // 將上傳的圖片插入到編輯器
      // Insert uploaded images into editor
      uploadedFiles.forEach((file) => {
        if (file.mediaType === 'image' && file.publicUrl) {
          editor.chain().focus().setImage({
            src: file.publicUrl,
            alt: file.fileName,
            title: file.fileName,
          }).run()
        }
      })

      // 關閉上傳器
      // Close uploader
      setShowUploader(false)
      setUploadState({
        isUploading: false,
        progress: 0,
        error: null,
        uploadedFiles: [],
      })
    } catch (error) {
      console.error('Image upload failed:', error)
      // 錯誤已通過 uploadState 顯示
      // Error already shown via uploadState
    }
  }

  if (showUploader) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">上傳圖片 / Upload Images</h3>
            <button
              onClick={() => setShowUploader(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {uploadState.error ? (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {uploadState.error}
            </div>
          ) : null}

          {uploadState.isUploading ? (
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 text-center">
                上傳進度: {uploadState.progress}% / Upload progress: {uploadState.progress}%
              </p>
            </div>
          ) : (
            <ImageUploader
              onFilesSelected={handleFilesSelected}
              disabled={uploadState.isUploading}
              maxFiles={5}
              className="mb-4"
            />
          )}

          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={() => setShowUploader(false)}
              disabled={uploadState.isUploading}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              取消 / Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleBasicImageUpload}
        style={{ display: 'none' }}
        multiple
      />
      <button
        onClick={() => setShowUploader(true)}
        className="toolbar-button"
        title="Insert Image (上傳圖片)"
        type="button"
      >
        <ImageIcon size={18} />
      </button>
    </>
  )
}
