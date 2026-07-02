/**
 * 音訊上傳器元件 - 支援拖放、檔案選擇
 * Audio Uploader Component - Supports drag-drop, file picker
 */

import React, { useRef, useCallback, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

/**
 * 音訊上傳器元件屬性
 * Audio Uploader component props
 */
interface AudioUploaderProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
  maxFiles?: number
  maxFileSize?: number // 位元組 / bytes
  className?: string
  children?: React.ReactNode
}

/**
 * 音訊上傳器元件
 * Audio Uploader component
 *
 * 支援的上傳方式:
 * 1. 拖放檔案到容器
 * 2. 點擊打開檔案選擇器
 *
 * 支援格式: MP3, WAV, OGG, M4A
 * Supported formats: MP3, WAV, OGG, M4A
 */
export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFilesSelected,
  disabled = false,
  maxFiles = 10,
  maxFileSize = 50 * 1024 * 1024, // 50MB default for audio
  className = '',
  children,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string>('')

  /**
   * 驗證音訊檔案格式
   * Validate audio file formats
   */
  const isValidAudioFormat = (mimeType: string): boolean => {
    const validFormats = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a']
    return validFormats.includes(mimeType) || mimeType.startsWith('audio/')
  }

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
        if (!isValidAudioFormat(file.type)) {
          errors.push(
            `${file.name}: 不是音訊檔案 (支援 MP3, WAV, OGG) / Not an audio file (MP3, WAV, OGG supported)`
          )
          return
        }

        // 檢查檔案大小
        // Check file size
        if (file.size > maxFileSize) {
          errors.push(
            `${file.name}: 檔案大小超過限制 (最大 ${(maxFileSize / 1024 / 1024).toFixed(0)}MB) / File size exceeds limit (max ${(maxFileSize / 1024 / 1024).toFixed(0)}MB)`
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
        accept="audio/*"
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
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <p className="text-sm font-medium text-gray-700 mb-1">
            拖放音訊檔案到這裡或點擊選擇 / Drag audio files here or click to select
          </p>
          <p className="text-xs text-gray-500">
            支援格式: MP3, WAV, OGG / Supported: MP3, WAV, OGG
          </p>
          {maxFileSize && (
            <p className="text-xs text-gray-500 mt-1">
              最大檔案大小: {(maxFileSize / 1024 / 1024).toFixed(0)}MB / Max file size: {(maxFileSize / 1024 / 1024).toFixed(0)}MB
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

export default AudioUploader
