/**
 * 元件 - 文章順序管理器
 * 支持拖放式重新排列文章和管理文章列表
 */

import { useState } from 'react'
import { Article } from '@/types'
import { DragDropArticle } from './DragDropArticle'
import clsx from 'clsx'

export interface ArticleOrderManagerProps {
  articles: Article[]
  onReorder: (articles: Article[]) => void
  onSelectArticle: (articleId: string) => void
  onDeleteArticle: (articleId: string) => void
  selectedArticleId: string
  disabled?: boolean
}

export function ArticleOrderManager({
  articles,
  onReorder,
  onSelectArticle,
  onDeleteArticle,
  selectedArticleId,
  disabled = false,
}: ArticleOrderManagerProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  const [localArticles, setLocalArticles] = useState(articles)

  // 同步外部文章變化
  if (JSON.stringify(articles) !== JSON.stringify(localArticles)) {
    setLocalArticles(articles)
  }

  const handleDragStart = (articleId: string) => {
    if (disabled) return
    setDraggedItem(articleId)
  }

  const handleDragOver = (articleId: string) => {
    if (disabled || !draggedItem) return
    setDragOverItem(articleId)
  }

  const handleDragEnd = () => {
    if (disabled || !draggedItem || !dragOverItem || draggedItem === dragOverItem) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    const draggedIndex = localArticles.findIndex(a => a.id === draggedItem)
    const dragOverIndex = localArticles.findIndex(a => a.id === dragOverItem)

    if (draggedIndex === -1 || dragOverIndex === -1) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    // 交換位置
    const newArticles = [...localArticles]
    ;[newArticles[draggedIndex], newArticles[dragOverIndex]] = [
      newArticles[dragOverIndex],
      newArticles[draggedIndex],
    ]

    setLocalArticles(newArticles)
    onReorder(newArticles)
    setDraggedItem(null)
    setDragOverItem(null)
  }

  const handleMoveUp = (index: number) => {
    if (disabled || index === 0) return
    const newArticles = [...localArticles]
    ;[newArticles[index - 1], newArticles[index]] = [
      newArticles[index],
      newArticles[index - 1],
    ]
    setLocalArticles(newArticles)
    onReorder(newArticles)
  }

  const handleMoveDown = (index: number) => {
    if (disabled || index === localArticles.length - 1) return
    const newArticles = [...localArticles]
    ;[newArticles[index], newArticles[index + 1]] = [
      newArticles[index + 1],
      newArticles[index],
    ]
    setLocalArticles(newArticles)
    onReorder(newArticles)
  }

  return (
    <div className="space-y-2">
      {localArticles.map((article, index) => (
        <div
          key={article.id}
          onDragOver={() => handleDragOver(article.id)}
          onDragLeave={() => setDragOverItem(null)}
          onDrop={handleDragEnd}
          className={clsx(
            'border-2 rounded-lg p-3 transition-all duration-200',
            dragOverItem === article.id
              ? 'border-waldorf-brown bg-waldorf-cream'
              : 'border-gray-200 bg-white hover:border-gray-300',
            selectedArticleId === article.id
              ? 'ring-2 ring-waldorf-brown'
              : ''
          )}
        >
          <DragDropArticle
            article={article}
            index={index}
            isSelected={selectedArticleId === article.id}
            isDragging={draggedItem === article.id}
            isDragOver={dragOverItem === article.id}
            disabled={disabled}
            onSelect={onSelectArticle}
            onDelete={onDeleteArticle}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
            totalArticles={localArticles.length}
          />
        </div>
      ))}
    </div>
  )
}
