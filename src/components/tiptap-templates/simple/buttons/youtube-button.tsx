/**
 * YouTubeButton Component
 * Button for inserting YouTube videos into the editor
 * Supports URL input and validation for various YouTube URL formats
 */

import { Editor } from '@tiptap/react'
import { Video } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { isValidYouTubeUrl, extractYouTubeVideoId, generateYouTubeEmbedUrl } from '@/adapters/TipTapYoutubeNode'

interface YouTubeButtonProps {
  editor: Editor
}

export function YouTubeButton({ editor }: YouTubeButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [startTime, setStartTime] = useState('')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleInsertVideo = async () => {
    if (!youtubeUrl.trim()) {
      setError('請輸入 YouTube URL / Please enter a YouTube URL')
      return
    }

    setError('')
    setIsProcessing(true)

    try {
      // Validate URL
      if (!isValidYouTubeUrl(youtubeUrl)) {
        setError('無效的 YouTube URL / Invalid YouTube URL')
        setIsProcessing(false)
        return
      }

      // Extract video ID
      const videoId = extractYouTubeVideoId(youtubeUrl)
      if (!videoId) {
        setError('無法提取視頻 ID / Unable to extract video ID')
        setIsProcessing(false)
        return
      }

      // Parse start time
      const startTimeSeconds = startTime ? parseInt(startTime, 10) : undefined
      if (startTime && (isNaN(startTimeSeconds) || startTimeSeconds < 0)) {
        setError('開始時間必須是正整數 / Start time must be a positive integer')
        setIsProcessing(false)
        return
      }

      // Generate embed URL
      const embedUrl = generateYouTubeEmbedUrl(videoId, {
        startTime: startTimeSeconds,
      })

      // Insert video node
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'youtube',
          attrs: {
            src: embedUrl,
            videoId,
            width: '100%',
            height: '480',
            startTime: startTimeSeconds || null,
          },
        })
        .run()

      // Reset form
      setYoutubeUrl('')
      setStartTime('')
      setShowModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知錯誤 / Unknown error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInsertVideo()
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="toolbar-button"
        title="Insert YouTube Video (插入 YouTube 影片)"
        type="button"
      >
        <Video size={18} />
      </button>

      {/* Render modal in a portal to keep toolbar visible */}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">插入 YouTube 影片 / Insert YouTube Video</h3>
                <button
                  onClick={() => {
                    setShowModal(false)
                    setYoutubeUrl('')
                    setStartTime('')
                    setError('')
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                  type="button"
                >
                  ✕
                </button>
              </div>

              {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

              <div className="space-y-4">
                {/* YouTube URL Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    YouTube URL / 連結
                  </label>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    支持的格式: youtube.com/watch?v=..., youtu.be/..., 或直接貼上視頻 ID
                    <br />
                    Supported: youtube.com/watch?v=..., youtu.be/..., or video ID
                  </p>
                </div>

                {/* Start Time Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始時間 / Start Time (秒 / seconds) - 選填
                  </label>
                  <input
                    type="number"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    (選擇性) 設定影片開始播放的秒數
                    <br />
                    (Optional) Specify when the video should start playing
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => {
                    setShowModal(false)
                    setYoutubeUrl('')
                    setStartTime('')
                    setError('')
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
                  type="button"
                >
                  取消 / Cancel
                </button>
                <button
                  onClick={handleInsertVideo}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
                  type="button"
                >
                  {isProcessing ? '處理中... / Processing...' : '插入 / Insert'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
