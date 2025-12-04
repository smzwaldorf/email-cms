
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import { useEffect, useState, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

function SecureImageComponent({ node, updateAttributes, selected, deleteNode, editor }: any) {
  // Initialize with src only if it's NOT a storage URL
  const [src, setSrc] = useState(
    node.attrs.src && !node.attrs.src.startsWith('storage://') ? node.attrs.src : ''
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isEditingCaption, setIsEditingCaption] = useState(false)
  const [caption, setCaption] = useState(node.attrs.caption || '')
  const [isCaptionFocused, setIsCaptionFocused] = useState(false)
  const captionInputRef = useRef<HTMLInputElement>(null)

  const [retryCount, setRetryCount] = useState(0)
  const [hasError, setHasError] = useState(false)
  const isEditable = editor?.isEditable !== false

  // Sync caption when node.attrs.caption changes
  useEffect(() => {
    if (!isEditingCaption) {
      setCaption(node.attrs.caption || '')
    }
  }, [node.attrs.caption, isEditingCaption])

  useEffect(() => {
    let isMounted = true

    const resolveUrl = async () => {
      const originalSrc = node.attrs.src

      if (!originalSrc || !originalSrc.startsWith('storage://')) {
        if (isMounted) setSrc(originalSrc)
        return
      }

      if (isMounted) {
        setIsLoading(true)
        setHasError(false)
      }

      try {
        const pathWithoutProtocol = originalSrc.replace('storage://', '')
        const [bucket, ...pathParts] = pathWithoutProtocol.split('/')
        const path = pathParts.join('/')

        if (bucket && path) {
          const supabase = getSupabaseClient()
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 300)

          if (isMounted) {
            if (data?.signedUrl) {
              setSrc(data.signedUrl)
            } else {
              console.error('Failed to sign URL:', error)
              setHasError(true)
            }
          }
        }
      } catch (error) {
        console.error('Error resolving storage URL:', error)
        if (isMounted) setHasError(true)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    resolveUrl()

    return () => {
      isMounted = false
    }
  }, [node.attrs.src, retryCount])

  const handleError = () => {
    // Only retry if it's a storage URL and we haven't retried too many times
    if (node.attrs.src?.startsWith('storage://') && retryCount < 3) {
      console.log('Image failed to load, retrying with new signed URL...')
      setRetryCount(prev => prev + 1)
    } else {
      setHasError(true)
    }
  }

  const handleDelete = () => {
    deleteNode()
  }

  const handleCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCaption = e.target.value
    setCaption(newCaption)
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
    <NodeViewWrapper className="secure-image-wrapper" style={{ display: 'inline-block', lineHeight: 0 }}>
      <div className={`relative mb-1 ${selected ? 'ring-2 ring-waldorf-sage-500 rounded-md' : ''}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 min-h-[100px] min-w-[100px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-waldorf-sage-500"></div>
          </div>
        )}
        {hasError ? (
          <div className="flex items-center justify-center bg-gray-100 text-gray-400 p-4 rounded-md border border-gray-200">
            <span className="text-sm">無法載入圖片</span>
          </div>
        ) : src ? (
          <img
            src={src}
            alt={node.attrs.alt}
            title={node.attrs.title}
            className={`max-w-full h-auto rounded-md ${isLoading ? 'opacity-50' : ''}`}
            onError={handleError}
          />
        ) : (
          // Placeholder while loading if src is empty
          <div className="w-full h-48 bg-gray-50 rounded-md"></div>
        )}

        {/* Delete button - always visible when editable */}
        {isEditable && (
          <button
            onClick={handleDelete}
            className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 active:bg-red-700 transition-colors cursor-pointer"
            title="Delete image"
          >
            ✕
          </button>
        )}
      </div>

      {/* Caption - displayed outside the selection border (Medium-style) */}
      {(caption || selected) && (
        <div className="w-full flex justify-center mt-1 px-4">
          {isEditingCaption && isEditable ? (
            <input
              ref={captionInputRef}
              type="text"
              value={caption}
              onChange={handleCaptionChange}
              onBlur={() => {
                handleCaptionBlur()
                setIsCaptionFocused(false)
              }}
              onFocus={() => setIsCaptionFocused(true)}
              placeholder={isCaptionFocused ? '' : 'Add caption...'}
              className="text-sm text-gray-600 italic px-0 py-1 focus:outline-none max-w-xs text-center bg-transparent"
            />
          ) : caption ? (
            <p
              onClick={() => isEditable && setIsEditingCaption(true)}
              className={`text-sm text-gray-600 italic px-0 py-1 max-w-xs text-center ${
                isEditable ? 'cursor-text' : ''
              }`}
            >
              {caption}
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

export const TipTapImageNode = Image.extend({
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => {
          let src = element.getAttribute('src')
          const storageSrc = element.getAttribute('data-storage-src')

          if (storageSrc) {
            src = storageSrc
          }

          if (!src) return null

          // Check if it's a signed URL from our storage
          // Pattern: .../storage/v1/object/sign/bucket/path...
          if (src.includes('/storage/v1/object/sign/')) {
            try {
              const url = new URL(src)
              const pathParts = url.pathname.split('/storage/v1/object/sign/')
              if (pathParts.length > 1) {
                const fullPath = pathParts[1] // e.g. media/user/file.jpg
                // Decode URI components in case they are encoded
                const decodedPath = decodeURIComponent(fullPath)
                return `storage://${decodedPath}`
              }
            } catch (e) {
              console.warn('Failed to parse signed URL:', e)
            }
          }

          return src
        },
        renderHTML: (attributes) => {
          // If it's a storage URL, put it in data-storage-src and leave src empty
          // This prevents browser from trying to load it
          if (attributes.src && attributes.src.startsWith('storage://')) {
            return {
              'data-storage-src': attributes.src,
              src: '', // Empty src to prevent request
            }
          }
          return {
            src: attributes.src,
          }
        },
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
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
  addNodeView() {
    return ReactNodeViewRenderer(SecureImageComponent)
  },
})
