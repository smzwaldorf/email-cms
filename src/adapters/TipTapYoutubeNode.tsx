/**
 * TipTap YouTube 自訂節點
 * TipTap YouTube Custom Node Extension
 * 擴展 @tiptap/extension-youtube 以支援自訂屬性和行為
 */

import Youtube from '@tiptap/extension-youtube'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Node } from '@tiptap/core'

/**
 * YouTube 節點視圖組件
 * YouTube node view component for rendering embedded videos
 */
function YoutubeView({ node, selected }: any) {
  const { src, width, height, startTime } = node.attrs

  return (
    <div className="relative my-4 rounded-lg overflow-hidden shadow-md" data-testid="youtube-embed">
      <div
        className={`relative ${selected ? 'ring-2 ring-waldorf-sage-500' : ''}`}
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
          }}
          frameBorder="0"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title="YouTube video"
          data-testid="youtube-iframe"
        />
      </div>

      {/* 編輯提示 */}
      {selected && (
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
          Delete: Press Backspace
        </div>
      )}
    </div>
  )
}

/**
 * 自訂 YouTube 節點配置
 * Custom YouTube node configuration
 */
export const TipTapYoutubeNode = Youtube.extend({
  name: 'youtube',

  addAttributes() {
    return {
      // 繼承原始屬性
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('src'),
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
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video]',
      },
      {
        tag: 'iframe[src*="youtube.com"]',
      },
      {
        tag: 'iframe[src*="youtu.be"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        'data-youtube-video': true,
        class: 'youtube-video-wrapper',
      },
      [
        'iframe',
        {
          ...HTMLAttributes,
          class: 'youtube-iframe',
          frameborder: '0',
          allowfullscreen: true,
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        },
      ],
    ]
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
              width: options.width || '100%',
              height: options.height || '480',
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
        const { state } = editor
        const { selection } = state

        // 檢查當前節點是否為 YouTube 節點
        state.doc.nodesBetween(selection.$from.pos, selection.$to.pos, (node: any) => {
          if (node.type.name === 'youtube') {
            return editor.commands.deleteNode(this.name)
          }
        })

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
