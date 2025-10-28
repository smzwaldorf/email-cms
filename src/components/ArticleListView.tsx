/**
 * 組件 - 文章清單視圖
 * 顯示某週的所有文章清單
 */

import { Article } from '@/types'
import { ArticleCard } from './ArticleCard'
import { formatWeekNumber } from '@/utils/formatters'

interface ArticleListViewProps {
  weekNumber: string
  articles: Article[]
  selectedArticleId: string
  onSelectArticle: (articleId: string) => void
  isLoading?: boolean
}

export function ArticleListView({
  weekNumber,
  articles,
  selectedArticleId,
  onSelectArticle,
  isLoading = false,
}: ArticleListViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">本週無文章</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 週報頭部 */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">
          {formatWeekNumber(weekNumber)}
        </h2>
        <p className="text-sm text-gray-600">共 {articles.length} 篇文章</p>
      </div>

      {/* 文章清單 */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 p-4">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              isSelected={article.id === selectedArticleId}
              onClick={() => onSelectArticle(article.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
