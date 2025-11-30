/**
 * 組件 - 文章內容
 * 顯示完整的文章內容，包括 Markdown 渲染
 *
 * 性能優化 (US3 快速導航):
 * - 使用 React.memo 防止不必要的重新渲染
 * - 使用 useMemo 緩存 HTML 渲染結果避免重複計算
 * - 優化文章切換性能，減少重新渲染時間
 */

import { memo, useMemo } from 'react'
import { useMarkdownConverter } from '@/hooks/useMarkdownConverter'
import { useLoadingTimeout } from '@/components/LoadingTimeout'
import { formatDate, formatViewCount } from '@/utils/formatters'

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
  const { html, isConverting } = useMarkdownConverter(content)
  const { isTimedOut } = useLoadingTimeout(isLoading || isConverting, 3000)

  // 使用 useMemo 優化 HTML 內容，避免在非內容相關 props 變化時重新計算
  const memoizedHtml = useMemo(() => html, [html])

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

  if (isLoading || isConverting) {
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
          className="prose prose-sm max-w-none text-waldorf-clay-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: memoizedHtml }}
        />
      </div>
    </article>
  )
}

// 使用 memo 包裝組件，防止父組件重新渲染時不必要的重新渲染
// 當 props 沒有變化時，不會重新渲染此組件
export const ArticleContent = memo(ArticleContentComponent)
