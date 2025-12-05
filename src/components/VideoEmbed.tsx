/**
 * 組件 - 影片嵌入
 * Component - Video Embed
 * 回應式 YouTube 影片嵌入元件，支援桌面和行動裝置
 */

import { memo } from 'react'
import { extractYouTubeVideoId, generateYouTubeEmbedUrl } from '@/adapters/TipTapYoutubeNode'

interface VideoEmbedProps {
  /**
   * YouTube URL 或視頻 ID
   */
  src?: string

  /**
   * 視頻 ID（如果已知）
   */
  videoId?: string

  /**
   * 自訂寬度（默認 100%）
   */
  width?: string | number

  /**
   * 自訂高度（默認 480px，但回應式情況下被忽略）
   */
  height?: string | number

  /**
   * 開始時間（秒）
   */
  startTime?: number

  /**
   * 自動播放
   */
  autoplay?: boolean

  /**
   * 標題
   */
  title?: string

  /**
   * 額外的 CSS 類別
   */
  className?: string

  /**
   * 測試 ID
   */
  'data-testid'?: string
}

/**
 * 影片嵌入組件
 * Video Embed Component
 * 支援 16:9 長寬比的回應式設計
 */
function VideoEmbedComponent({
  src,
  videoId,
  width = '100%',
  height = '480',
  startTime,
  autoplay = false,
  title = 'YouTube video',
  className = '',
  'data-testid': testId = 'video-embed',
}: VideoEmbedProps) {
  // 確定視頻 ID
  const finalVideoId = videoId || (src ? extractYouTubeVideoId(src) : null)

  if (!finalVideoId) {
    return (
      <div
        className={`bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 ${className}`}
        data-testid={testId}
      >
        <p className="font-semibold">無效的 YouTube URL</p>
        <p className="text-sm mt-1">請提供有效的 YouTube 視頻 ID 或 URL</p>
      </div>
    )
  }

  // 生成嵌入 URL
  const embedUrl = generateYouTubeEmbedUrl(finalVideoId, { startTime, autoplay })

  // 計算響應式寬度
  const widthValue = typeof width === 'number' ? `${width}px` : width
  const heightValue = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`my-4 rounded-lg overflow-hidden shadow-md ${className}`}
      data-testid={testId}
    >
      <div
        className="relative bg-black"
        style={{
          width: widthValue,
          paddingBottom: '56.25%', // 16:9 aspect ratio
          position: 'relative',
        }}
      >
        <iframe
          src={embedUrl}
          title={title}
          className="absolute top-0 left-0 w-full h-full"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          data-testid="video-iframe"
        />
      </div>
    </div>
  )
}

export const VideoEmbed = memo(VideoEmbedComponent)
