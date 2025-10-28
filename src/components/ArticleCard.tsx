/**
 * 組件 - 文章卡片
 * 顯示文章摘要信息
 */

import { Article } from '@/types'
import { truncateText, formatDate } from '@/utils/formatters'

interface ArticleCardProps {
  article: Article
  isSelected: boolean
  onClick: () => void
}

export function ArticleCard({ article, isSelected, onClick }: ArticleCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-lg border cursor-pointer transition-all
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300 bg-white'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 line-clamp-2">
            {article.title}
          </h3>
          {article.author && (
            <p className="text-sm text-gray-500 mt-1">作者：{article.author}</p>
          )}
          {article.summary && (
            <p className="text-sm text-gray-600 mt-2">
              {truncateText(article.summary, 80)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
        <span>順序 #{article.order}</span>
        <span>{formatDate(article.createdAt)}</span>
      </div>
    </div>
  )
}
