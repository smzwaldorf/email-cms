/**
 * TipTap 音訊自訂節點
 * TipTap Audio Custom Node Extension
 * 支援在編輯器中嵌入音訊播放器
 */

import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import AudioPlayer from '@/components/AudioPlayer'
import { useState, useEffect } from 'react'
import { storageService } from '@/services/storageService'

/**
 * 音訊節點視圖組件
 * Audio node view component for rendering audio player
 */
function AudioView({ node, selected }: any) {
  const { src, title, mediaId, duration } = node.attrs
  const [signedUrl, setSignedUrl] = useState<string>(src)

  // Sign storage:// URLs for playback in editor
  useEffect(() => {
    if (!src) return

    let isMounted = true

    // If it's already a signed URL or blob URL, use it as-is
    if (!src.startsWith('storage://')) {
      setSignedUrl(src)
      return
    }

    // Sign the storage:// URL
    const signUrl = async () => {
      try {
        // Parse bucket and path from storage:// URL
        // Format: storage://bucket/path/to/file
        const pathWithoutProtocol = src.replace('storage://', '')
        const [bucket, ...pathParts] = pathWithoutProtocol.split('/')
        const path = pathParts.join('/')

        if (bucket && path) {
          const signed = await storageService.getSignedUrl(bucket, path, 300) // 5 minutes validity
          if (isMounted) {
            setSignedUrl(signed)
          }
        }
      } catch (error) {
        console.error('Failed to sign audio URL:', error)
        // Fallback to original URL
        if (isMounted) {
          setSignedUrl(src)
        }
      }
    }

    signUrl()

    return () => {
      isMounted = false
    }
  }, [src])

  const handleNodeClick = (e: React.MouseEvent) => {
    // Allow clicks on interactive elements (buttons, inputs, ranges)
    const target = e.target as HTMLElement
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.closest('button') ||
      target.closest('input')
    ) {
      // Stop propagation to prevent node selection
      e.stopPropagation()
    }
  }

  return (
    <NodeViewWrapper
      className={`relative my-4 rounded-lg overflow-hidden ${
        selected ? 'ring-2 ring-waldorf-sage-500' : ''
      }`}
      data-testid="audio-embed"
      data-audio-id={mediaId}
      onClick={handleNodeClick}
    >
      <AudioPlayer
        src={signedUrl}
        title={title}
        duration={duration}
        onEnded={() => {
          // Handle end of audio playback if needed
        }}
      />

      {/* 編輯提示 */}
      {selected && (
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
          Delete: Press Backspace
        </div>
      )}
    </NodeViewWrapper>
  )
}

/**
 * 音訊節點選項介面
 * Audio node options interface
 */
export interface AudioNodeOptions {
  src: string
  title?: string
  mediaId?: string
  duration?: number
}

/**
 * 自訂音訊節點
 * Custom audio node extension for TipTap
 */
export const TipTapAudioNode = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => {
          let src = element.getAttribute('data-src')
          if (!src) {
            const audioElem = element.querySelector('audio')
            if (audioElem) {
              src = audioElem.getAttribute('src')
            }
          }
          
          if (src && src.includes('/storage/v1/object/sign/')) {
            try {
              const url = new URL(src)
              const pathParts = url.pathname.split('/storage/v1/object/sign/')
              if (pathParts.length > 1) {
                const fullPath = pathParts[1]
                const decodedPath = decodeURIComponent(fullPath)
                return `storage://${decodedPath}`
              }
            } catch (e) {
              console.warn('Failed to parse signed audio URL:', e)
            }
          }
          
          return src
        },
        renderHTML: (attributes) => ({
          'data-src': attributes.src,
        }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) => ({
          'data-title': attributes.title,
        }),
      },
      mediaId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-media-id'),
        renderHTML: (attributes) => ({
          'data-media-id': attributes.mediaId,
        }),
      },
      duration: {
        default: 0,
        parseHTML: (element) => {
          const duration = element.getAttribute('data-duration')
          return duration ? parseFloat(duration) : 0
        },
        renderHTML: (attributes) => ({
          'data-duration': attributes.duration,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-audio-node]',
        getAttrs: (element) => {
          return {
            src: element.getAttribute('data-src'),
            title: element.getAttribute('data-title'),
            mediaId: element.getAttribute('data-media-id'),
            duration: element.getAttribute('data-duration')
              ? parseFloat(element.getAttribute('data-duration') || '0')
              : 0,
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        'data-audio-node': true,
        class: 'audio-node-wrapper',
        ...HTMLAttributes,
      },
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioView)
  },

  addCommands() {
    return {
      setAudio:
        (options: AudioNodeOptions) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              title: options.title || null,
              mediaId: options.mediaId || null,
              duration: options.duration || 0,
            },
          })
        },

      updateAudio:
        (options: Partial<AudioNodeOptions>) =>
        ({ commands }: any) => {
          return commands.updateAttributes(this.name, options)
        },
    } as any
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }: any) => {
        // 刪除選中的音訊節點
        const { selection } = editor.state
        const { $from } = selection

        // 檢查當前節點是否為音訊節點
        if ($from.parent.type.name === 'audio') {
          return editor.commands.deleteNode(this.name)
        }

        return false
      },
    }
  },
})

/**
 * 驗證音訊 URL
 * Validate audio URL
 */
export function isValidAudioUrl(url: string): boolean {
  if (!url) return false

  try {
    const urlObj = new URL(url)
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']
    const pathname = urlObj.pathname.toLowerCase()

    return audioExtensions.some((ext) => pathname.endsWith(ext))
  } catch {
    // Fallback: check if URL contains audio extension
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']
    return audioExtensions.some((ext) => url.toLowerCase().includes(ext))
  }
}

/**
 * 格式化時間（秒）為可讀格式
 * Format duration in seconds to readable format
 */
export function formatAudioDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * 從媒體檔案元資料建立音訊節點
 * Create audio node from media file metadata
 */
export function createAudioNodeFromMedia(mediaFile: {
  publicUrl: string
  fileName: string
  id: string
  duration?: number
}): AudioNodeOptions {
  return {
    src: mediaFile.publicUrl,
    title: mediaFile.fileName,
    mediaId: mediaFile.id,
    duration: mediaFile.duration || 0,
  }
}
