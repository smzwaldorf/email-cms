/**
 * 元件 - 可拖拽的文章項目
 * 支持拖放排序和快速操作（選擇、刪除、移動）
 */

import { Article } from '@/types'
import clsx from 'clsx'

export interface DragDropArticleProps {
  article: Article
  index: number
  isSelected?: boolean
  isDragging: boolean
  isDragOver?: boolean
  disabled: boolean
  onSelect: (articleId: string) => void
  onDelete: (articleId: string) => void
  onDragStart: (articleId: string) => void
  onDragEnd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  totalArticles: number
}

export function DragDropArticle({
  article,
  index,
  isDragging,
  disabled,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  totalArticles,
}: DragDropArticleProps) {
  const handleDelete = () => {
    if (window.confirm(`確認刪除「${article.title}」?`)) {
      onDelete(article.id)
    }
  }

  return (
    <div
      draggable={!disabled}
      onDragStart={() => onDragStart(article.id)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(article.id)}
      className={clsx(
        'flex items-center gap-3 cursor-move select-none transition-opacity duration-200',
        isDragging && 'opacity-50',
        disabled && 'cursor-not-allowed'
      )}
    >
      {/* 拖拽把手 */}
      <div className="flex items-center justify-center w-6 h-6 flex-shrink-0">
        <span className="text-gray-400 text-lg select-none" title="拖拽排序">
          ⋮⋮
        </span>
      </div>

      {/* 文章資訊 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-waldorf-brown bg-waldorf-cream px-2 py-1 rounded flex-shrink-0">
            {index + 1}
          </span>
          <h3 className="font-medium text-gray-900 truncate">
            {article.title || '未命名文章'}
          </h3>
          {!article.isPublished && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded flex-shrink-0">
              草稿
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 truncate mt-1">
          {article.author && `作者: ${article.author}`}
          {article.summary && `${article.author ? ' • ' : ''}${article.summary}`}
        </p>
      </div>

      {/* 操作按鈕 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* 向上移動 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
          disabled={disabled || index === 0}
          className={clsx(
            'p-1 rounded hover:bg-gray-100 transition-colors',
            (disabled || index === 0) && 'opacity-50 cursor-not-allowed'
          )}
          title="向上移動"
        >
          <svg
            className="w-4 h-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
        </button>

        {/* 向下移動 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
          disabled={disabled || index === totalArticles - 1}
          className={clsx(
            'p-1 rounded hover:bg-gray-100 transition-colors',
            (disabled || index === totalArticles - 1) &&
              'opacity-50 cursor-not-allowed'
          )}
          title="向下移動"
        >
          <svg
            className="w-4 h-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* 刪除按鈕 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDelete()
          }}
          disabled={disabled}
          className={clsx(
            'p-1 rounded hover:bg-red-50 transition-colors',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          title="刪除文章"
        >
          <svg
            className="w-4 h-4 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
