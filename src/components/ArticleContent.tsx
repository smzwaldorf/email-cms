/**
 * 組件 - 文章內容
 * 顯示完整的文章內容，包括 Markdown 渲染
 */

import { useMarkdownConverter } from '@/hooks/useMarkdownConverter'
import { formatDate, formatViewCount } from '@/utils/formatters'

interface ArticleContentProps {
  title: string
  author?: string
  content: string
  createdAt?: string
  viewCount?: number
  isLoading?: boolean
}

export function ArticleContent({
  title,
  author,
  content,
  createdAt,
  viewCount,
  isLoading = false,
}: ArticleContentProps) {
  const { html, isConverting } = useMarkdownConverter(content)

  if (isLoading || isConverting) {
    return (
      <div className="flex items-center justify-center p-8">
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
        <div className="flex items-center gap-4 text-sm text-waldorf-clay-600">
          {author && <span>作者：{author}</span>}
          {createdAt && <span>{formatDate(createdAt)}</span>}
          {viewCount !== undefined && (
            <span>瀏覽：{formatViewCount(viewCount)}</span>
          )}
        </div>
      </div>

      {/* 文章內容 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
        <div
          className="prose prose-sm max-w-none text-waldorf-clay-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </article>
  )
}
