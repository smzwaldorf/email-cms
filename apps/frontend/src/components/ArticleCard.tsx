/**
 * 組件 - 文章卡片
 * 顯示文章摘要信息，支援角色權限檢查
 */

import { memo, useCallback, useState, useEffect } from 'react'
import { Article } from '@/types'
import { ArticleRow } from '@/types/database'
import { truncateText, formatDate } from '@/utils/formatters'
import PermissionService from '@/services/PermissionService'
import { CheckCircle } from 'lucide-react'

interface ArticleCardProps {
  article: Article
  isSelected: boolean
  onClick: () => void
  userId?: string  // For permission checking (optional)
  showPermissionStatus?: boolean  // Show permission badges (default: false)
  disabled?: boolean
  isRead?: boolean
}

export const ArticleCard = memo(function ArticleCard({
  article,
  isSelected,
  onClick,
  userId,
  showPermissionStatus = false,
  disabled = false,
  isRead = false
}: ArticleCardProps) {
  const [permissions, setPermissions] = useState({
    canView: true,
    canEdit: false,
    canDelete: false,
    isLoading: !userId,  // Don't load if no userId provided
  })

  // Check permissions if userId is provided
  useEffect(() => {
    if (!userId) return

    const checkPermissions = async () => {
      try {
        // Adapt Article to ArticleRow for permission checks
        // Note: We assume the UI Article type is a subset or mapped from ArticleRow
        // We cast here to satisfy the type system, but in a real app ensure all required fields exist
        const articleRow = article as unknown as ArticleRow

        const [canView, canEdit, canDelete] = await Promise.all([
          PermissionService.canViewArticle(userId, articleRow),
          PermissionService.canEditArticle(userId, articleRow),
          PermissionService.canDeleteArticle(userId, articleRow),
        ])

        setPermissions({ canView, canEdit, canDelete, isLoading: false })
      } catch (err) {
        console.error('Failed to check permissions:', err)
        setPermissions(prev => ({ ...prev, isLoading: false }))
      }
    }

    checkPermissions()
  }, [userId, article])

  // Memoize onClick to prevent unnecessary re-renders
  const handleClick = useCallback(() => {
    if (permissions.canView && !disabled) {
      onClick()
    }
  }, [onClick, permissions.canView, disabled])

  // Don't render if user can't view this article
  if (!permissions.canView && !permissions.isLoading && userId) {
    return null
  }

  return (
    <div
      onClick={handleClick}
      className={`
        p-4 rounded-lg border transition-all
        ${!permissions.canView || disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${
          isSelected
            ? 'border-waldorf-sage-500 bg-waldorf-sage-50 shadow-sm'
            : 'border-waldorf-cream-200 hover:border-waldorf-sage-300 bg-waldorf-cream-50'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold line-clamp-2 flex-1 ${isRead ? 'text-gray-500' : 'text-waldorf-clay-800'}`}>
              {article.title}
            </h3>
            {isRead && (
                <CheckCircle className="w-4 h-4 text-waldorf-sage-500 flex-shrink-0" />
            )}
            {showPermissionStatus && (
              <div className="flex items-center gap-1">
                {permissions.isLoading ? (
                  <span className="text-xs text-gray-400">...</span>
                ) : (
                  <>
                    {permissions.canEdit && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded whitespace-nowrap">
                        可編輯
                      </span>
                    )}
                    {permissions.canDelete && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded whitespace-nowrap">
                        可刪除
                      </span>
                    )}
                    {!permissions.canEdit && !permissions.canDelete && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded whitespace-nowrap">
                        唯讀
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
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
