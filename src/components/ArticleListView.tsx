/**
 * 組件 - 文章清單視圖
 * 顯示某週的所有文章清單
 */

import { memo, useCallback } from 'react'
import { Article } from '@/types'
import { ArticleCard } from './ArticleCard'
import { WeekSelector } from './WeekSelector'

interface ArticleListViewProps {
  weekNumber: string
  articles: Article[]
  selectedArticleId: string
  onSelectArticle: (articleId: string) => void
  isLoading?: boolean
  disabled?: boolean
}

export const ArticleListView = memo(function ArticleListView({
  articles,
  selectedArticleId,
  onSelectArticle,
  isLoading = false,
  disabled = false,
}: ArticleListViewProps) {
  // Memoize the select handler to prevent unnecessary re-renders
  const handleSelectArticle = useCallback(
    (articleId: string) => {
      if (!disabled) {
        onSelectArticle(articleId)
      }
    },
    [onSelectArticle, disabled]
  )
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-waldorf-sage-500 mx-auto mb-2"></div>
          <p className="text-waldorf-clay-700">載入中...</p>
        </div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-waldorf-clay-600">本週無文章</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 週報頭部 */}
      <div className="px-4 py-3 border-b border-waldorf-cream-200 bg-waldorf-cream-100 space-y-3">
        <div className="flex items-center justify-between">
          <WeekSelector />
        </div>
        <p className="text-sm text-waldorf-clay-600">共 {articles.length} 篇文章</p>
      </div>

      {/* 文章清單 */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 p-4">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              isSelected={article.id === selectedArticleId}
              onClick={() => handleSelectArticle(article.id)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    </div>
  )
})
