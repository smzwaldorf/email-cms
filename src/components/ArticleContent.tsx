/**
 * 組件 - 文章內容
 * 顯示完整的文章內容，包括 Markdown 渲染
 *
 * 性能優化 (US3 快速導航):
 * - 使用 React.memo 防止不必要的重新渲染
 * - 使用 useMemo 緩存 HTML 渲染結果避免重複計算
 * - 優化文章切換性能，減少重新渲染時間
 */

import { memo, useMemo, useState, useEffect, useRef, ReactNode } from 'react'
import { useLoadingTimeout } from '@/components/LoadingTimeout'
import { formatDate, formatViewCount } from '@/utils/formatters'
import { replaceStorageTokens } from '@/utils/contentParser'
import AudioPlayer from '@/components/AudioPlayer'
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
 * Parse HTML content and render audio nodes as React components
 * Other content is rendered as HTML
 */
function parseAndRenderContent(htmlString: string): ReactNode[] {
  const container = document.createElement('div')
  container.innerHTML = htmlString
  const nodes: ReactNode[] = []
  let key = 0

  Array.from(container.childNodes).forEach((node) => {
    // Check if it's an audio node and process specially
    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement
      if (elem.hasAttribute('data-audio-node')) {
        const src = elem.getAttribute('data-src') || ''
        const title = elem.getAttribute('data-title') || ''
        const duration = elem.getAttribute('data-duration')
          ? parseFloat(elem.getAttribute('data-duration') || '0')
          : 0

        nodes.push(
          <div key={`audio-${key++}`} className="my-4">
            <AudioPlayer src={src} title={title} duration={duration} />
          </div>
        )
        return
      }
    }

    // For non-audio elements, render as HTML
    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement
      nodes.push(
        <div
          key={`html-${key++}`}
          dangerouslySetInnerHTML={{ __html: elem.outerHTML }}
        />
      )
    }
  })

  return nodes
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
  const { isTimedOut } = useLoadingTimeout(isLoading, 3000)
  const contentRef = useRef<HTMLDivElement>(null)
  const [processedContent, setProcessedContent] = useState('')
  const [renderedNodes, setRenderedNodes] = useState<ReactNode[]>([])

  // 處理內容中的 storage:// token 並轉換為簽署 URL，並解析音訊節點
  useEffect(() => {
    let isMounted = true

    const processContent = async () => {
      if (!content) {
        if (isMounted) {
          setProcessedContent('')
          setRenderedNodes([])
        }
        return
      }

      try {
        const htmlWithSignedUrls = await replaceStorageTokens(content)

        // 為所有 checkbox 添加 disabled 屬性，確保閱讀模式下不可編輯
        const finalHtml = htmlWithSignedUrls.replace(/<input type="checkbox"/g, '<input type="checkbox" disabled')

        if (isMounted) {
          setProcessedContent(finalHtml)
          // Parse and render audio nodes as React components
          const nodes = parseAndRenderContent(finalHtml)
          setRenderedNodes(nodes)
        }
      } catch (error) {
        console.error('Failed to process content:', error)
        // Fallback to original content if processing fails
        if (isMounted) {
          setProcessedContent(content)
          const nodes = parseAndRenderContent(content)
          setRenderedNodes(nodes)
        }
      }
    }

    processContent()

    return () => {
      isMounted = false
    }
  }, [content])

  // Sanitize image URLs after loading
  useEffect(() => {
    if (!contentRef.current) return

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
  }, [processedContent])

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
          {renderedNodes.length > 0 ? (
            renderedNodes
          ) : (
            <div dangerouslySetInnerHTML={{ __html: processedContent }} />
          )}
        </div>
      </div>
    </article>
  )
}

// 使用 memo 包裝組件，防止父組件重新渲染時不必要的重新渲染
// 當 props 沒有變化時，不會重新渲染此組件
export const ArticleContent = memo(ArticleContentComponent)
