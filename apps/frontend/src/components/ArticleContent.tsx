/**
 * 組件 - 文章內容
 * 顯示完整的文章內容，包括 Markdown 渲染
 *
 * 性能優化 (US3 快速導航):
 * - 使用 React.memo 防止不必要的重新渲染
 * - 使用 useMemo 緩存 HTML 渲染結果避免重複計算
 * - 優化文章切換性能，減少重新渲染時間
 */

import { memo, useMemo, useEffect, useRef } from 'react'
import { useLoadingTimeout } from '@/components/LoadingTimeout'
import { formatDate, formatViewCount } from '@/utils/formatters'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import './ArticleContent.css'

interface ArticleContentProps {
  title: string
  author?: string
  content: string
  createdAt?: string
  viewCount?: number
  isLoading?: boolean
}

/**
 * 文章內容組件 - 帶性能優化
 * memo: 防止父組件重新渲染時不必要地重新渲染此組件
 * useMemo: 緩存 HTML 結果，避免 Markdown 轉換重複計算
 */
function ArticleContentComponent({
  title,
  author,
  content,
  createdAt,
  viewCount,
  isLoading = false,
}: ArticleContentProps) {
  const { isTimedOut } = useLoadingTimeout(isLoading, 3000) // 3 second timeout (default)
  const contentRef = useRef<HTMLDivElement>(null)



  // Sanitize image URLs, disable checkboxes, and disable selection of media nodes
  useEffect(() => {
    if (!contentRef.current) return

    // Wait for a brief moment for TipTap to render
    const timer = setTimeout(() => {
      if (!contentRef.current) return

      // Sanitize images
      const images = contentRef.current.querySelectorAll('img')
      images.forEach((img) => {
        if (img.dataset.sanitized === 'true') return

        const sanitize = async () => {
          const currentSrc = img.getAttribute('src')
          // Only sanitize if it has query parameters (likely a signed URL) and isn't already a blob
          if (!currentSrc || currentSrc.startsWith('blob:') || !currentSrc.includes('?')) return

          try {
            const response = await fetch(currentSrc)
            const blob = await response.blob()
            const objectUrl = URL.createObjectURL(blob)
            img.src = objectUrl
            img.dataset.sanitized = 'true'
          } catch (error) {
            console.error('Failed to sanitize image URL:', error)
          }
        }

        if (img.complete) {
          sanitize()
        } else {
          img.addEventListener('load', sanitize, { once: true })
        }
      })

      // Disable all checkboxes in read-only mode
      const checkboxes = contentRef.current.querySelectorAll('input[type="checkbox"]')
      checkboxes.forEach((checkbox) => {
        (checkbox as HTMLInputElement).disabled = true
        ;(checkbox as HTMLInputElement).setAttribute('disabled', 'true') // Try attribute too
      })

      // Prevent click events and selection on image and audio node wrappers
      const mediaClickHandler = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
      }

      const imageWrappers = contentRef.current.querySelectorAll('.secure-image-wrapper')
      imageWrappers.forEach((wrapper) => {
        ;(wrapper as HTMLElement).addEventListener('click', mediaClickHandler)
        ;(wrapper as HTMLElement).addEventListener('mousedown', mediaClickHandler)
      })

      const audioWrappers = contentRef.current.querySelectorAll('[data-audio-node]')
      audioWrappers.forEach((wrapper) => {
        ;(wrapper as HTMLElement).addEventListener('click', mediaClickHandler)
        ;(wrapper as HTMLElement).addEventListener('mousedown', mediaClickHandler)
      })
    }, 100) // Small delay to ensure DOM is ready

    return () => clearTimeout(timer)
  }, [content])

  // 使用 useMemo 優化文章中繼資料，避免重複建立相同的 UI 結構
  const metadataSection = useMemo(
    () => (
      <div className="flex items-center gap-4 text-sm text-waldorf-clay-600">
        {author && <span>作者：{author}</span>}
        {createdAt && <span>{formatDate(createdAt)}</span>}
        {viewCount !== undefined && (
          <span>瀏覽：{formatViewCount(viewCount)}</span>
        )}
      </div>
    ),
    [author, createdAt, viewCount]
  )

  if (isLoading) {
    // Show timeout warning if loading takes > 3 seconds
    if (isTimedOut) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-waldorf-clay-800 mb-4">
              加載超時
            </h2>
            <p className="text-waldorf-clay-600 mb-6">
              文章加載時間過長。請重新載入頁面。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-waldorf-sage-600 text-white rounded-md hover:bg-waldorf-sage-700 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 transition-colors"
            >
              重新載入頁面
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-waldorf-sage-500 mx-auto mb-2"></div>
          <p className="text-waldorf-clay-700">載入文章中...</p>
        </div>
      </div>
    )
  }

  return (
    <article className="h-full flex flex-col overflow-hidden">
      {/* 文章頭部 */}
      <div className="px-6 py-4 border-b border-waldorf-cream-200 bg-waldorf-cream-50">
        <h1 className="text-2xl font-bold text-waldorf-clay-800 mb-2">{title}</h1>
        {metadataSection}
      </div>

      {/* 文章內容 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
        <div
          ref={contentRef}
          className="prose max-w-none text-waldorf-clay-700 leading-relaxed"
        >
          <SimpleEditor
            content={content}
            readOnly={true}
            className="min-h-[200px]"
          />
        </div>
      </div>
    </article>
  )
}

// 使用 memo 包裝組件，防止父組件重新渲染時不必要的重新渲染
// 當 props 沒有變化時，不會重新渲染此組件
export const ArticleContent = memo(ArticleContentComponent)
