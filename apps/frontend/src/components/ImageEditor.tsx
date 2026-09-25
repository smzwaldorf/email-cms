/**
 * 圖片編輯器元件 - 調整大小、對齐、標題、替代文字
 * Image Editor Component - Resize, align, caption, alt text
 */

import React, { useState } from 'react'

/**
 * 圖片編輯器屬性
 * Image Editor props
 */
interface ImageEditorProps {
  imageUrl: string
  onPropertiesChange: (properties: ImageProperties) => void
  initialProperties?: ImageProperties
  disabled?: boolean
  className?: string
}

/**
 * 圖片屬性
 * Image properties
 */
export interface ImageProperties {
  alt?: string
  title?: string
  align?: 'left' | 'center' | 'right'
  width?: number
  height?: number
  caption?: string
}

/**
 * 圖片編輯器元件
 * Image Editor component
 *
 * 支援的編輯操作:
 * 1. 調整大小 (寬度、高度)
 * 2. 對齐方式 (左、中、右)
 * 3. 替代文字 (無障礙性)
 * 4. 圖片標題
 * 5. 圖片說明文字
 */
export const ImageEditor: React.FC<ImageEditorProps> = ({
  imageUrl,
  onPropertiesChange,
  initialProperties = {},
  disabled = false,
  className = '',
}) => {
  const [alt, setAlt] = useState(initialProperties.alt || '')
  const [title, setTitle] = useState(initialProperties.title || '')
  const [align, setAlign] = useState<'left' | 'center' | 'right'>(
    initialProperties.align || 'center'
  )
  const [width, setWidth] = useState(initialProperties.width || 400)
  const [height, setHeight] = useState(initialProperties.height || undefined)
  const [caption, setCaption] = useState(initialProperties.caption || '')
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true)
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number } | null>(null)

  /**
   * 取得圖片資訊
   * Get image information
   */
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImageInfo({
      width: img.naturalWidth,
      height: img.naturalHeight,
    })
  }

  /**
   * 計算保持寬高比的高度
   * Calculate height maintaining aspect ratio
   */
  const calculateHeightWithAspectRatio = (newWidth: number): number => {
    if (!imageInfo) return newWidth
    return Math.round((newWidth * imageInfo.height) / imageInfo.width)
  }

  /**
   * 處理寬度變更
   * Handle width change
   */
  const handleWidthChange = (newWidth: number) => {
    setWidth(newWidth)

    if (maintainAspectRatio && imageInfo) {
      const newHeight = calculateHeightWithAspectRatio(newWidth)
      setHeight(newHeight)
    }

    // 發出變更事件
    // Emit change event
    onPropertiesChange({
      alt,
      title,
      align,
      width: newWidth,
      height: maintainAspectRatio && imageInfo ? calculateHeightWithAspectRatio(newWidth) : height,
      caption,
    })
  }

  /**
   * 處理高度變更
   * Handle height change
   */
  const handleHeightChange = (newHeight: number) => {
    setHeight(newHeight)

    // 發出變更事件
    // Emit change event
    onPropertiesChange({
      alt,
      title,
      align,
      width,
      height: newHeight,
      caption,
    })
  }

  /**
   * 處理對齐方式變更
   * Handle alignment change
   */
  const handleAlignChange = (newAlign: 'left' | 'center' | 'right') => {
    setAlign(newAlign)

    onPropertiesChange({
      alt,
      title,
      align: newAlign,
      width,
      height,
      caption,
    })
  }

  /**
   * 處理替代文字變更
   * Handle alt text change
   */
  const handleAltChange = (newAlt: string) => {
    setAlt(newAlt)

    onPropertiesChange({
      alt: newAlt,
      title,
      align,
      width,
      height,
      caption,
    })
  }

  /**
   * 處理標題變更
   * Handle title change
   */
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)

    onPropertiesChange({
      alt,
      title: newTitle,
      align,
      width,
      height,
      caption,
    })
  }

  /**
   * 處理說明文字變更
   * Handle caption change
   */
  const handleCaptionChange = (newCaption: string) => {
    setCaption(newCaption)

    onPropertiesChange({
      alt,
      title,
      align,
      width,
      height,
      caption: newCaption,
    })
  }

  /**
   * 處理保持寬高比變更
   * Handle aspect ratio toggle
   */
  const handleAspectRatioToggle = () => {
    setMaintainAspectRatio(!maintainAspectRatio)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 圖片預覽 / Image preview */}
      <div className={`flex justify-${align} overflow-auto`}>
        <img
          src={imageUrl}
          alt={alt}
          title={title}
          width={width}
          height={height}
          onLoad={handleImageLoad}
          className="rounded-lg border border-gray-200 shadow-sm"
        />
      </div>

      {/* 大小調整 / Size controls */}
      <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-16">
            寬度：
          </label>
          <input
            type="number"
            value={width}
            onChange={(e) => handleWidthChange(parseInt(e.target.value))}
            disabled={disabled}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            min="50"
            max="1200"
          />
          <span className="text-sm text-gray-500">px</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-16">
            高度：
          </label>
          <input
            type="number"
            value={height || ''}
            onChange={(e) => handleHeightChange(e.target.value ? parseInt(e.target.value) : 0)}
            disabled={disabled || maintainAspectRatio}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            min="50"
            max="1200"
          />
          <span className="text-sm text-gray-500">px</span>
          <button
            onClick={handleAspectRatioToggle}
            disabled={disabled}
            className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
              maintainAspectRatio
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-200 text-gray-700'
            } disabled:opacity-50`}
            title="保持寬高比"
          >
            🔗
          </button>
        </div>

        {imageInfo && (
          <p className="text-xs text-gray-500">
            原始尺寸: {imageInfo.width} × {imageInfo.height} px／原始： {imageInfo.width} × {imageInfo.height} px
          </p>
        )}
      </div>

      {/* 對齐方式 / Alignment */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          對齊方式：
        </label>
        <div className="flex gap-2">
          {(['left', 'center', 'right'] as const).map((alignOption) => (
            <button
              key={alignOption}
              onClick={() => handleAlignChange(alignOption)}
              disabled={disabled}
              className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
                align === alignOption
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              } disabled:opacity-50`}
            >
              {alignOption === 'left' && '左'}
              {alignOption === 'center' && '中'}
              {alignOption === 'right' && '右'}
            </button>
          ))}
        </div>
      </div>

      {/* 替代文字 / Alt text */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          替代文字： <span className="text-gray-500">（無障礙用途）</span>
        </label>
        <textarea
          value={alt}
          onChange={(e) => handleAltChange(e.target.value)}
          disabled={disabled}
          placeholder="描述圖片內容"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50 resize-none"
          rows={2}
        />
      </div>

      {/* 標題 / Title */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          標題：
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          disabled={disabled}
          placeholder="圖片標題"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
        />
      </div>

      {/* 說明文字 / Caption */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          說明文字：
        </label>
        <textarea
          value={caption}
          onChange={(e) => handleCaptionChange(e.target.value)}
          disabled={disabled}
          placeholder="圖片下方的說明文字"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50 resize-none"
          rows={2}
        />
      </div>
    </div>
  )
}

export default ImageEditor
