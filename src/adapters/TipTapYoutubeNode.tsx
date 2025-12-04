/**
 * TipTap YouTube 自訂節點
 * TipTap YouTube Custom Node Extension
 * 擴展 @tiptap/extension-youtube 以支援自訂屬性和行為
 */

import Youtube from '@tiptap/extension-youtube'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useState, useEffect, useRef } from 'react'

/**
 * YouTube 節點視圖組件
 * YouTube node view component for rendering embedded videos
 */
function YoutubeView({ node, selected, deleteNode, editor, updateAttributes }: any) {
  const { src, width, height, caption } = node.attrs
  const isEditable = editor?.isEditable !== false
  const [isEditingCaption, setIsEditingCaption] = useState(false)
  const [captionText, setCaptionText] = useState(caption || '')
  const [isCaptionFocused, setIsCaptionFocused] = useState(false)
  const captionInputRef = useRef<HTMLInputElement>(null)

  // Sync caption text when node.attrs.caption changes
  useEffect(() => {
    if (!isEditingCaption) {
      setCaptionText(caption || '')
    }
  }, [caption, isEditingCaption])

  const handleDelete = () => {
    deleteNode()
  }

  const handleCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCaption = e.target.value
    setCaptionText(newCaption)
    updateAttributes({ caption: newCaption || null })
  }

  const handleCaptionBlur = () => {
    setIsEditingCaption(false)
  }

  useEffect(() => {
    if (isEditingCaption && captionInputRef.current) {
      captionInputRef.current.focus()
      captionInputRef.current.setSelectionRange(0, 0)
    }
  }, [isEditingCaption])

  return (
    <NodeViewWrapper className="youtube-node-view">
      <div className="flex flex-col">
        {/* Video container with selection border */}
        <div
          className={`relative my-4 rounded-lg overflow-visible shadow-md ${selected ? 'ring-4 ring-waldorf-sage-500' : ''}`}
          data-testid="youtube-embed"
          data-youtube-video=""
        >
          <div
            className="relative"
            style={{
              paddingBottom: '56.25%', // 16:9 aspect ratio
              position: 'relative',
              width: '100%',
            }}
          >
            <iframe
              src={src}
              width={width || '100%'}
              height={height || '100%'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: isEditable ? 'none' : 'auto',
              }}
              frameBorder="0"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title="YouTube video"
              data-testid="youtube-iframe"
            />

            {/* Semi-transparent overlay to capture clicks for selection in edit mode */}
            {isEditable && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'rgba(135, 153, 107, 0.2)',
                  cursor: 'pointer',
                  zIndex: 5,
                }}
                data-testid="youtube-overlay"
              />
            )}

            {/* Delete button - always visible when editable */}
            {isEditable && (
              <button
                onClick={handleDelete}
                className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 active:bg-red-700 transition-colors cursor-pointer z-10"
                title="Delete video"
                style={{ pointerEvents: 'auto' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* 編輯提示 */}
          {selected && isEditable && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
              Delete: Press Backspace
            </div>
          )}
        </div>

        {/* Caption - displayed outside the selection border (Medium-style) */}
        {(captionText || (isEditable && selected)) && (
          <div className="w-full flex justify-center mt-2 px-4">
            {isEditingCaption && isEditable ? (
              <input
                ref={captionInputRef}
                type="text"
                value={captionText}
                onChange={handleCaptionChange}
                onBlur={() => {
                  handleCaptionBlur()
                  setIsCaptionFocused(false)
                }}
                onFocus={() => setIsCaptionFocused(true)}
                placeholder={isCaptionFocused ? '' : 'Add caption...'}
                className="text-sm text-gray-600 italic px-0 py-1 focus:outline-none max-w-xs text-center bg-transparent"
              />
            ) : captionText ? (
              <p
                onClick={() => isEditable && setIsEditingCaption(true)}
                className={`text-sm text-gray-600 italic px-0 py-1 max-w-xs text-center ${
                  isEditable ? 'cursor-text' : ''
                }`}
              >
                {captionText}
              </p>
            ) : isEditable && selected ? (
              <button
                onClick={() => setIsEditingCaption(true)}
                className="text-sm text-gray-400 italic px-0 py-1 cursor-text hover:text-gray-500"
              >
                Add a caption
              </button>
            ) : null}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

/**
 * 自訂 YouTube 節點配置
 * Custom YouTube node configuration
 */
export const TipTapYoutubeNode = Youtube.extend({
  name: 'youtube',

  addOptions() {
    return {
      ...this.parent?.(),
      addPasteHandler: false, // Disable automatic paste detection for YouTube URLs
    } as any
  },

  addAttributes() {
    return {
      // 繼承原始屬性
      src: {
        default: null,
        parseHTML: (element) => {
          // Try to get src from iframe directly
          let src = element.getAttribute('src')
          // If this is a wrapper div, look for iframe inside
          if (!src) {
            const iframe = element.querySelector('iframe')
            if (iframe) {
              src = iframe.getAttribute('src')
            }
          }
          return src
        },
        renderHTML: (attributes) => ({
          src: attributes.src,
        }),
      },
      width: {
        default: '100%',
        parseHTML: (element) => element.getAttribute('width'),
        renderHTML: (attributes) => ({
          width: attributes.width,
        }),
      },
      height: {
        default: '480',
        parseHTML: (element) => element.getAttribute('height'),
        renderHTML: (attributes) => ({
          height: attributes.height,
        }),
      },
      startTime: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-start-time'),
        renderHTML: (attributes) => ({
          'data-start-time': attributes.startTime,
        }),
      },
      videoId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-video-id'),
        renderHTML: (attributes) => ({
          'data-video-id': attributes.videoId,
        }),
      },
      caption: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-caption'),
        renderHTML: (attributes) => ({
          'data-caption': attributes.caption,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video]',
        getAttrs: (element) => {
          const iframe = element.querySelector('iframe')
          if (iframe) {
            return {
              src: iframe.getAttribute('src'),
              // Check caption on wrapper first, then fallback to iframe
              caption: element.getAttribute('data-caption') || iframe.getAttribute('data-caption'),
            }
          }
          return false
        },
      },
      {
        tag: 'iframe[src*="youtube.com"]',
        getAttrs: (element) => {
          const parent = element.parentElement
          return {
            src: element.getAttribute('src'),
            caption: parent?.getAttribute('data-caption'),
          }
        },
      },
      {
        tag: 'iframe[src*="youtu.be"]',
        getAttrs: (element) => {
          const parent = element.parentElement
          return {
            src: element.getAttribute('src'),
            caption: parent?.getAttribute('data-caption'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    // Extract caption from HTMLAttributes
    const { caption, ...iframeAttrs } = HTMLAttributes

    return [
      'div',
      {
        'data-youtube-video': true,
        class: 'youtube-video-wrapper',
        ...(caption && { 'data-caption': caption }),
      },
      [
        'iframe',
        {
          ...iframeAttrs,
          class: 'youtube-iframe',
          frameborder: '0',
          allowfullscreen: true,
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        },
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeView)
  },

  // 添加命令以插入 YouTube 視頻
  addCommands() {
    return {
      setYoutubeVideo:
        (options: { src: string; width?: string; height?: string; startTime?: number }) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              width: (options.width || '100%') as any,
              height: (options.height || '480') as any,
              startTime: options.startTime || null,
            },
          })
        },

      updateYoutubeVideo:
        (options: { src?: string; width?: string; height?: string; startTime?: number }) =>
        ({ commands }: any) => {
          return commands.updateAttributes(this.name, {
            src: options.src,
            width: options.width,
            height: options.height,
            startTime: options.startTime,
          })
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }: any) => {
        // 刪除選中的 YouTube 節點
        const { selection } = editor.state
        const { $from } = selection

        // 檢查當前節點是否為 YouTube 節點
        if ($from.parent.type.name === 'youtube') {
          return editor.commands.deleteNode(this.name)
        }

        return false
      },
    }
  },
})

/**
 * 提取 YouTube 視頻 ID 從 URL
 * Extract YouTube video ID from URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null

  // 支援多種 YouTube URL 格式
  const patterns = [
    // https://youtu.be/dQw4w9WgXcQ or https://youtu.be/dQw4w9WgXcQ?t=30
    /youtu\.be\/([^&\n?#/]+)/,
    // https://www.youtube.com/watch?v=dQw4w9WgXcQ (支援 v= 在任何位置)
    /[?&]v=([^&\n#/]+)/,
    // https://www.youtube.com/embed/dQw4w9WgXcQ
    /youtube\.com\/embed\/([^&\n?#/]+)/,
    // 直接的視頻 ID
    /^([a-zA-Z0-9_-]{11})$/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      // 移除可能的尾部斜線
      return match[1].replace(/\/$/, '')
    }
  }

  return null
}

/**
 * 生成 YouTube 嵌入 URL
 * Generate YouTube embed URL from video ID
 */
export function generateYouTubeEmbedUrl(
  videoId: string,
  options?: { startTime?: number; autoplay?: boolean }
): string {
  if (!videoId) return ''

  const baseUrl = `https://www.youtube.com/embed/${videoId}`
  const params = new URLSearchParams()

  if (options?.startTime !== undefined && options.startTime !== null) {
    params.set('start', String(options.startTime))
  }

  if (options?.autoplay) {
    params.set('autoplay', '1')
  }

  // 添加額外的參數以改善體驗
  params.set('rel', '0') // 不顯示相關視頻
  params.set('modestbranding', '1') // 最小品牌

  const queryString = params.toString()
  return queryString ? `${baseUrl}?${queryString}` : baseUrl
}

/**
 * 驗證 YouTube URL
 * Validate YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null
}
