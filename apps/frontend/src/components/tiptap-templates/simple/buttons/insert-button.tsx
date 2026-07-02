/**
 * InsertButton Component
 * Enhanced button for inserting images with full upload workflow
 * Integrates ImageUploader component with useMediaUpload hook
 */

import { Editor } from '@tiptap/react'
import { Image as ImageIcon } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMediaUpload } from '@/hooks/useMediaUpload'
import ImageUploader from '@/components/ImageUploader'
import type { UploadState } from '@/hooks/useMediaUpload'
import type { MediaFile } from '@/types/media'
import { mediaGovernanceService } from '@/services/mediaGovernanceService'
import { articleMediaManager } from '@/services/articleMediaManager'
import { MediaLibrary } from '@/components/MediaLibrary'

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
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'existing'>('upload')
  const { uploadFiles } = useMediaUpload()

  useEffect(() => {
    if (!showUploader) return

    const loadLibrary = async () => {
      setIsLoadingLibrary(true)
      try {
        const files = await mediaGovernanceService.fetchLibraryMedia()
        setMediaFiles(files.filter((file) => file.mediaType === 'image'))
      } catch (error) {
        console.error('Failed to fetch media library:', error)
      } finally {
        setIsLoadingLibrary(false)
      }
    }

    void loadLibrary()
  }, [showUploader])

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
        if (file.mediaType === 'image') {
          const src = getStableImageSrc(file)
          if (src) {
            editor.chain().focus().setImage({
              src,
              alt: file.fileName,
              title: file.fileName,
              mediaId: file.id,
            }).run()
          }
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

  const handleInsertExisting = async (file: MediaFile) => {
    if (!editor) return
    const src = getStableImageSrc(file)
    if (!src) return

    editor.chain().focus().setImage({
      src,
      alt: file.fileName,
      title: file.fileName,
      mediaId: file.id,
    }).run()

    if (articleId) {
      try {
        const association = await articleMediaManager.addMediaToArticle(articleId, file.id)
        if (!association.success) {
          throw new Error(association.error || 'Failed to register article media relationship')
        }
      } catch (error) {
        console.error('Failed to register existing media usage:', error)
      }
    }

    setShowUploader(false)
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
        onClick={() => {
          setActiveTab('upload')
          setShowUploader(true)
        }}
        className="toolbar-button"
        title="Insert Image (上傳圖片)"
        type="button"
      >
        <ImageIcon size={18} />
      </button>

      {/* Render modal in a portal to keep toolbar visible */}
      {showUploader &&
        createPortal(
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

              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`px-3 py-1 rounded text-sm ${
                    activeTab === 'upload' ? 'bg-waldorf-sage-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  上傳新圖片 / Upload New
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('existing')}
                  className={`px-3 py-1 rounded text-sm ${
                    activeTab === 'existing' ? 'bg-waldorf-sage-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  插入現有媒體 / Insert Existing
                </button>
              </div>

              {activeTab === 'upload' ? (
                uploadState.isUploading ? (
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
                )
              ) : isLoadingLibrary ? (
                <p className="text-sm text-gray-600">載入媒體庫中... / Loading media library...</p>
              ) : (
                <div className="max-h-[480px] overflow-auto">
                  <p className="text-xs text-gray-500 mb-3">
                    選擇後將直接插入，並同步更新引用計數。 / Selecting inserts immediately and updates usage tracking.
                  </p>
                  <MediaLibrary
                    mediaFiles={mediaFiles}
                    onMediaSelected={(selected) => {
                      void handleInsertExisting(selected)
                    }}
                  />
                </div>
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
          </div>,
          document.body
        )}
    </>
  )
}

function getStableImageSrc(file: MediaFile): string | undefined {
  if (file.storageUrl?.startsWith('storage://')) {
    return file.storageUrl
  }

  const preferred = file.publicUrl || file.signedUrl
  if (!preferred) return undefined

  // Convert signed/public Supabase URLs back to stable storage URI.
  try {
    const url = new URL(preferred)
    const signMarker = '/storage/v1/object/sign/'
    const publicMarker = '/storage/v1/object/public/'

    if (url.pathname.includes(signMarker)) {
      const fullPath = decodeURIComponent(url.pathname.split(signMarker)[1] || '')
      if (fullPath) return `storage://${fullPath}`
    }

    if (url.pathname.includes(publicMarker)) {
      const fullPath = decodeURIComponent(url.pathname.split(publicMarker)[1] || '')
      if (fullPath) return `storage://${fullPath}`
    }
  } catch {
    // non-URL values fall through
  }

  return preferred
}
