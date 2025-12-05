/**
 * TipTap 音訊自訂節點
 * TipTap Audio Custom Node Extension
 * 支援在編輯器中嵌入音訊播放器
 */

import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import AudioPlayer from '@/components/AudioPlayer'
import { useState, useEffect, useRef } from 'react'
import { storageService } from '@/services/storageService'

/**
 * 音訊節點視圖組件
 * Audio node view component for rendering audio player
 */
function AudioView({ node, selected, editor, deleteNode, updateAttributes }: any) {
  const { src, title, mediaId, duration, caption } = node.attrs
  const isReadOnly = editor?.isEditable === false
  const isEditable = editor?.isEditable !== false
  const [isEditingCaption, setIsEditingCaption] = useState(false)
  const [captionText, setCaptionText] = useState(caption || '')
  const [isCaptionFocused, setIsCaptionFocused] = useState(false)
  const captionInputRef = useRef<HTMLInputElement>(null)

  // Initialize with src only if it's NOT a storage URL
  // This prevents browser from trying to load storage:// URLs
  const [signedUrl, setSignedUrl] = useState<string>(
    src && !src.startsWith('storage://') ? src : ''
  )

  // Sync caption text when node.attrs.caption changes
  useEffect(() => {
    if (!isEditingCaption) {
      setCaptionText(caption || '')
    }
  }, [caption, isEditingCaption])

  // Sign storage:// URLs for playback in editor
  useEffect(() => {
    if (!src) return

    let isMounted = true

    // If it's already a signed URL or blob URL, use it as-is
    if (!src.startsWith('storage://')) {
      if (isMounted) setSignedUrl(src)
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
    // In read-only mode, prevent all selection
    if (isReadOnly) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

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
    <NodeViewWrapper
      data-testid="audio-embed"
      data-audio-id={mediaId}
      onClick={handleNodeClick}
    >
      <div
        className={`relative mt-4 mb-1 rounded-lg overflow-hidden ${
          selected && !isReadOnly ? 'ring-2 ring-waldorf-sage-500' : ''
        }`}
      >
        {signedUrl ? (
          <AudioPlayer
            src={signedUrl}
            title={title}
            duration={duration}
            onEnded={() => {
              // Handle end of audio playback if needed
            }}
          />
        ) : (
          <div className="bg-gray-100 p-4 rounded flex items-center justify-center">
            <span className="text-gray-500 text-sm">Loading audio...</span>
          </div>
        )}

        {/* Delete button - always visible when editable */}
        {isEditable && (
          <button
            onClick={handleDelete}
            className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 active:bg-red-700 transition-colors cursor-pointer"
            title="Delete audio"
          >
            ✕
          </button>
        )}

        {/* 編輯提示 */}
        {selected && !isReadOnly && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
            Delete: Press Backspace
          </div>
        )}
      </div>

      {/* Caption - displayed outside the selection border (Medium-style) */}
      {(captionText || selected) && (
        <div className="w-full flex justify-center mt-1 px-4">
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
          ) : selected && isEditable ? (
            <button
              onClick={() => setIsEditingCaption(true)}
              className="text-sm text-gray-400 italic px-0 py-1 cursor-text hover:text-gray-500"
            >
              Add a caption
            </button>
          ) : null}
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
          let src = element.getAttribute('data-src') || element.getAttribute('data-storage-src')
          if (!src) {
            const audioElem = element.querySelector('audio')
            if (audioElem) {
              src = audioElem.getAttribute('src') || audioElem.getAttribute('data-storage-src')
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
        renderHTML: (attributes) => {
          // If it's a storage URL, put it in data-storage-src and leave src empty
          if (attributes.src && attributes.src.startsWith('storage://')) {
            return {
              'data-storage-src': attributes.src,
              'data-src': '', // Clear data-src to prevent confusion
            }
          }
          return {
            'data-src': attributes.src,
          }
        },
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
        tag: 'div[data-audio-node]',
        getAttrs: (element) => {
          return {
            src: element.getAttribute('data-src'),
            title: element.getAttribute('data-title'),
            mediaId: element.getAttribute('data-media-id'),
            duration: element.getAttribute('data-duration')
              ? parseFloat(element.getAttribute('data-duration') || '0')
              : 0,
            caption: element.getAttribute('data-caption'),
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
