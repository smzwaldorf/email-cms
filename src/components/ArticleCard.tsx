/**
 * 組件 - 文章卡片
 * 顯示文章摘要信息
 */

import { memo, useCallback } from 'react'
import { Article } from '@/types'
import { truncateText, formatDate } from '@/utils/formatters'

interface ArticleCardProps {
  article: Article
  isSelected: boolean
  onClick: () => void
}

export const ArticleCard = memo(function ArticleCard({ article, isSelected, onClick }: ArticleCardProps) {
  // Memoize onClick to prevent unnecessary re-renders
  const handleClick = useCallback(() => {
    onClick()
  }, [onClick])
  return (
    <div
      onClick={handleClick}
      className={`
        p-4 rounded-lg border cursor-pointer transition-all
        ${
          isSelected
            ? 'border-waldorf-sage-500 bg-waldorf-sage-50 shadow-sm'
            : 'border-waldorf-cream-200 hover:border-waldorf-sage-300 bg-waldorf-cream-50'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h3 className="font-semibold text-waldorf-clay-800 line-clamp-2">
            {article.title}
          </h3>
          {article.author && (
            <p className="text-sm text-waldorf-clay-600 mt-1">作者：{article.author}</p>
          )}
          {article.summary && (
            <p className="text-sm text-waldorf-clay-700 mt-2">
              {truncateText(article.summary, 80)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-waldorf-clay-500">
        <span>順序 #{article.order}</span>
        <span>{formatDate(article.createdAt)}</span>
      </div>
    </div>
  )
})
