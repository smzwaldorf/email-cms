/**
 * 圖片上傳器元件 - 支援拖放、檔案選擇、剪貼簿上傳
 * Image Uploader Component - Supports drag-drop, file picker, clipboard upload
 */

import React, { useRef, useCallback, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

/**
 * 圖片上傳器元件屬性
 * Image Uploader component props
 */
interface ImageUploaderProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
  maxFiles?: number
  maxFileSize?: number // 位元組 / bytes
  className?: string
  children?: React.ReactNode
}

/**
 * 圖片上傳器元件
 * Image Uploader component
 *
 * 支援的上傳方式:
 * 1. 拖放檔案到容器
 * 2. 點擊打開檔案選擇器
 * 3. 粘貼圖片從剪貼簿
 */
export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onFilesSelected,
  disabled = false,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  className = '',
  children,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string>('')

  /**
   * 驗證檔案
   * Validate files
   */
  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const errors: string[] = []
      const valid: File[] = []

      files.forEach((file) => {
        // 檢查檔案類型
        // Check file type
        if (!file.type.startsWith('image/')) {
          errors.push(`${file.name}: 不是圖片檔案 / Not an image file`)
          return
        }

        // 檢查檔案大小
        // Check file size
        if (file.size > maxFileSize) {
          errors.push(
            `${file.name}: 檔案大小超過限制 (${(maxFileSize / 1024 / 1024).toFixed(1)}MB) / File size exceeds limit`
          )
          return
        }

        valid.push(file)
      })

      // 檢查檔案數量
      // Check file count
      if (valid.length > maxFiles) {
        errors.push(
          `最多只能上傳 ${maxFiles} 個檔案 / Maximum ${maxFiles} files allowed`
        )
        valid.length = maxFiles
      }

      return { valid, errors }
    },
    [maxFileSize, maxFiles]
  )

  /**
   * 處理檔案選擇
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return

      const fileArray = Array.from(files)
      const { valid, errors } = validateFiles(fileArray)

      if (errors.length > 0) {
        setError(errors[0])
        setTimeout(() => setError(''), 3000)
      }

      if (valid.length > 0) {
        onFilesSelected(valid)
      }
    },
    [validateFiles, onFilesSelected]
  )

  /**
   * 處理輸入框變更
   * Handle input change
   */
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
  }

  /**
   * 處理拖放進入
   * Handle drag enter
   */
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  /**
   * 處理拖放離開
   * Handle drag leave
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  /**
   * 處理拖放懸停
   * Handle drag over
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  /**
   * 處理拖放放下
   * Handle drop
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    handleFileSelect(files)
  }

  /**
   * 處理點擊打開檔案選擇器
   * Handle click to open file picker
   */
  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  /**
   * 處理粘貼事件
   * Handle paste event
   */
  const handlePaste = (e: ClipboardEvent) => {
    if (!containerRef.current?.contains(document.activeElement as Node)) {
      return
    }

    const items = e.clipboardData?.items
    if (!items) return

    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length > 0) {
      e.preventDefault()
      handleFileSelect(new DataTransfer([...files]).items as any)
    }
  }

  React.useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        relative border-2 border-dashed rounded-lg
        transition-colors cursor-pointer
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500 hover:bg-blue-50'}
        ${className}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleInputChange}
        disabled={disabled}
        className="hidden"
      />

      {children || (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <svg
            className="w-12 h-12 text-gray-400 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <p className="text-sm font-medium text-gray-700 mb-1">
            拖放圖片到這裡或點擊選擇 / Drag images here or click to select
          </p>
          <p className="text-xs text-gray-500">
            支援粘貼圖片 / Paste images supported
          </p>
          {maxFileSize && (
            <p className="text-xs text-gray-500 mt-1">
              最大檔案大小: {(maxFileSize / 1024 / 1024).toFixed(1)}MB / Max file size: {(maxFileSize / 1024 / 1024).toFixed(1)}MB
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-100 text-red-700 text-sm p-2 rounded-b-lg">
          {error}
        </div>
      )}
    </div>
  )
}

export default ImageUploader
