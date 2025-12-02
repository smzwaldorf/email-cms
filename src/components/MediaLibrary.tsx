/**
 * 媒體庫瀏覽器元件 - 搜尋、分頁、排序、重複使用媒體檔案
 * Media Library Browser Component - Search, pagination, sort, reuse media files
 */

import React, { useState, useMemo } from 'react'
import type { MediaFile, MediaFileType } from '@/types/media'

/**
 * 媒體庫瀏覽器屬性
 * Media Library Browser props
 */
interface MediaLibraryProps {
  mediaFiles: MediaFile[]
  onMediaSelected?: (mediaFile: MediaFile) => void
  onMediasSelected?: (mediaFiles: MediaFile[]) => void
  multiSelect?: boolean
  disabled?: boolean
  className?: string
}

/**
 * 排序選項
 * Sort options
 */
type SortOption = 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'date-asc' | 'date-desc'

/**
 * 媒體庫瀏覽器元件
 * Media Library Browser component
 *
 * 支援的功能:
 * 1. 搜尋媒體檔案 (名稱、類型)
 * 2. 排序 (名稱、大小、日期)
 * 3. 分頁
 * 4. 選擇媒體 (單選或多選)
 * 5. 預覽圖片縮圖
 */
export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  mediaFiles,
  onMediaSelected,
  onMediasSelected,
  multiSelect = false,
  disabled = false,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [selectedMediaType, setSelectedMediaType] = useState<MediaFileType | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const itemsPerPage = 12

  /**
   * 過濾和排序媒體檔案
   * Filter and sort media files
   */
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...mediaFiles]

    // 過濾搜尋查詢
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((file) =>
        file.fileName.toLowerCase().includes(query)
      )
    }

    // 過濾媒體類型
    // Filter by media type
    if (selectedMediaType !== 'all') {
      result = result.filter((file) => file.mediaType === selectedMediaType)
    }

    // 排序
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.fileName.localeCompare(b.fileName)
        case 'name-desc':
          return b.fileName.localeCompare(a.fileName)
        case 'size-asc':
          return a.fileSize - b.fileSize
        case 'size-desc':
          return b.fileSize - a.fileSize
        case 'date-asc':
          return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
        case 'date-desc':
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        default:
          return 0
      }
    })

    return result
  }, [mediaFiles, searchQuery, sortBy, selectedMediaType])

  /**
   * 分頁計算
   * Pagination calculation
   */
  const totalPages = Math.ceil(filteredAndSortedFiles.length / itemsPerPage)
  const paginatedFiles = filteredAndSortedFiles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  /**
   * 格式化檔案大小
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 格式化日期
   * Format date
   */
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  /**
   * 處理檔案選擇
   * Handle file selection
   */
  const handleSelectFile = (file: MediaFile) => {
    if (!multiSelect) {
      setSelectedFiles(new Set([file.id]))
      onMediaSelected?.(file)
    } else {
      const newSelected = new Set(selectedFiles)
      if (newSelected.has(file.id)) {
        newSelected.delete(file.id)
      } else {
        newSelected.add(file.id)
      }
      setSelectedFiles(newSelected)

      const selectedFileObjects = filteredAndSortedFiles.filter((f) =>
        newSelected.has(f.id)
      )
      onMediasSelected?.(selectedFileObjects)
    }
  }

  /**
   * 渲染媒體項目
   * Render media item
   */
  const renderMediaItem = (file: MediaFile) => {
    const isSelected = selectedFiles.has(file.id)

    return (
      <div
        key={file.id}
        onClick={() => !disabled && handleSelectFile(file)}
        className={`
          relative p-3 rounded-lg border-2 transition-all cursor-pointer
          ${isSelected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* 選擇核取方塊 / Selection checkbox */}
        {multiSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleSelectFile(file)}
            disabled={disabled}
            className="absolute top-2 right-2 w-4 h-4"
          />
        )}

        {/* 媒體預覽 / Media preview */}
        <div className="aspect-square rounded-md bg-gray-100 mb-2 overflow-hidden">
          {file.mediaType === 'image' && file.storageUrl ? (
            <img
              src={file.storageUrl}
              alt={file.fileName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <span className="text-xs font-medium text-gray-600 text-center px-1">
                {file.mediaType.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* 媒體資訊 / Media info */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-800 truncate">
            {file.fileName}
          </p>
          <p className="text-xs text-gray-500">
            {formatFileSize(file.fileSize)}
          </p>
          <p className="text-xs text-gray-500">
            {formatDate(file.uploadedAt)}
          </p>
          {file.width && file.height && file.mediaType === 'image' && (
            <p className="text-xs text-gray-500">
              {file.width}×{file.height}px
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 搜尋和篩選 / Search and filters */}
      <div className="space-y-3">
        {/* 搜尋框 / Search input */}
        <input
          type="text"
          placeholder="搜尋媒體檔案 / Search media files"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setCurrentPage(1)
          }}
          disabled={disabled}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
        />

        {/* 篩選和排序 / Filter and sort */}
        <div className="flex gap-3 flex-wrap">
          {/* 媒體類型篩選 / Media type filter */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: '全部 / All' },
              { value: 'image', label: '圖片 / Images' },
              { value: 'audio', label: '音訊 / Audio' },
              { value: 'video', label: '影片 / Video' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  setSelectedMediaType(value as any)
                  setCurrentPage(1)
                }}
                disabled={disabled}
                className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                  selectedMediaType === value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                } disabled:opacity-50`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 排序選項 / Sort option */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            disabled={disabled}
            className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-50"
          >
            <option value="date-desc">最新 / Latest</option>
            <option value="date-asc">最舊 / Oldest</option>
            <option value="name-asc">名稱 (A-Z) / Name (A-Z)</option>
            <option value="name-desc">名稱 (Z-A) / Name (Z-A)</option>
            <option value="size-asc">大小 (小-大) / Size (Small-Large)</option>
            <option value="size-desc">大小 (大-小) / Size (Large-Small)</option>
          </select>
        </div>

        {/* 結果計數 / Result count */}
        <p className="text-sm text-gray-600">
          找到 {filteredAndSortedFiles.length} 個媒體檔案 / Found {filteredAndSortedFiles.length} media files
          {selectedFiles.size > 0 && ` (已選擇 ${selectedFiles.size} 個 / Selected ${selectedFiles.size})`}
        </p>
      </div>

      {/* 媒體網格 / Media grid */}
      {paginatedFiles.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {paginatedFiles.map((file) => renderMediaItem(file))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">
            無媒體檔案 / No media files found
          </p>
        </div>
      )}

      {/* 分頁 / Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || disabled}
            className="px-4 py-2 text-sm border border-gray-300 rounded disabled:opacity-50"
          >
            上一頁 / Previous
          </button>

          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                disabled={disabled}
                className={`px-3 py-2 text-sm rounded transition-colors ${
                  page === currentPage
                    ? 'bg-blue-500 text-white'
                    : 'border border-gray-300'
                } disabled:opacity-50`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || disabled}
            className="px-4 py-2 text-sm border border-gray-300 rounded disabled:opacity-50"
          >
            下一頁 / Next
          </button>
        </div>
      )}
    </div>
  )
}

export default MediaLibrary
