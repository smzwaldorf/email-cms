/**
 * AudioButton Component
 * Button for inserting audio files into the editor
 * Supports audio upload with validation for MP3, WAV, OGG formats
 */

import { Editor } from '@tiptap/react'
import { Music } from 'lucide-react'
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMediaUpload } from '@/hooks/useMediaUpload'
import AudioUploader from '@/components/AudioUploader'
import type { UploadState } from '@/hooks/useMediaUpload'
import { createAudioNodeFromMedia } from '@/adapters/TipTapAudioNode'

interface AudioButtonProps {
  editor: Editor
  articleId?: string
}

export function AudioButton({ editor, articleId }: AudioButtonProps) {
  const [showUploader, setShowUploader] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    uploadedFiles: [],
  })
  const { uploadFiles } = useMediaUpload()

  /**
   * 處理音訊檔案選擇和上傳
   * Handle audio file selection and upload
   */
  const handleFilesSelected = async (files: File[]) => {
    if (!editor) return

    try {
      // 使用 useMediaUpload hook 上傳檔案
      // Use useMediaUpload hook to upload files
      const uploadedFiles = await uploadFiles(files, articleId, (state) => {
        setUploadState(state)
      })

      // 將上傳的音訊插入到編輯器
      // Insert uploaded audio into editor
      uploadedFiles.forEach((file) => {
        if (file.mediaType === 'audio') {
          const audioNode = createAudioNodeFromMedia({
            publicUrl: file.publicUrl || file.storageUrl || '',
            fileName: file.fileName,
            id: file.id,
            duration: file.duration,
          })

          editor.chain().focus().setAudio?.(audioNode).run()
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
      console.error('Audio upload failed:', error)
      // 錯誤已通過 uploadState 顯示
      // Error already shown via uploadState
    }
  }

  return (
    <>
      <button
        onClick={() => setShowUploader(true)}
        className="toolbar-button"
        title="Insert Audio (插入音訊)"
        type="button"
      >
        <Music size={18} />
      </button>

      {/* Render modal in a portal to keep toolbar visible */}
      {showUploader &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">上傳音訊 / Upload Audio</h3>
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
                <AudioUploader
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
          </div>,
          document.body
        )}
    </>
  )
}
