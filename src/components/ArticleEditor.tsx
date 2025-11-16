/**
 * 組件 - 文章編輯器
 * 提供文章編輯功能的表單介面，使用富文本編輯器
 */

import { useState, useEffect } from 'react'
import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'
import { Article } from '@/types'

interface ArticleEditorProps {
  article: Article
  onSave: (updates: Partial<Article>) => void
  onCancel: () => void
  isSaving?: boolean
}

export function ArticleEditor({
  article,
  onSave,
  onCancel,
  isSaving = false,
}: ArticleEditorProps) {
  const [formData, setFormData] = useState({
    title: article.title,
    author: article.author || '',
    summary: article.summary || '',
    content: article.content,
    isPublished: article.isPublished,
  })

  // 當文章改變時更新表單
  useEffect(() => {
    setFormData({
      title: article.title,
      author: article.author || '',
      summary: article.summary || '',
      content: article.content,
      isPublished: article.isPublished,
    })
  }, [article.id])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      title: formData.title,
      author: formData.author || undefined,
      summary: formData.summary || undefined,
      content: formData.content,
      isPublished: formData.isPublished,
    })
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleContentChange = (value?: string) => {
    setFormData((prev) => ({
      ...prev,
      content: value || '',
    }))
  }

  return (
    <article className="h-full flex flex-col overflow-hidden">
      {/* 編輯器頭部 */}
      <div className="px-6 py-4 border-b border-waldorf-cream-200 bg-waldorf-sage-50">
        <h1 className="text-2xl font-bold text-waldorf-clay-800 mb-2">編輯文章</h1>
        <div className="flex items-center gap-2 text-sm text-waldorf-clay-600">
          <span>文章 ID: {article.id}</span>
          <span>|</span>
          <span>週次: {article.weekNumber}</span>
          <span>|</span>
          <span>順序: {article.order}</span>
        </div>
      </div>

      {/* 編輯表單 */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-6 py-4 bg-white"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {/* 標題 */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-waldorf-clay-700 mb-1"
            >
              標題 <span className="text-waldorf-rose-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-waldorf-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 focus:border-transparent"
              placeholder="輸入文章標題"
            />
          </div>

          {/* 作者 */}
          <div>
            <label
              htmlFor="author"
              className="block text-sm font-medium text-waldorf-clay-700 mb-1"
            >
              作者
            </label>
            <input
              type="text"
              id="author"
              name="author"
              value={formData.author}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-waldorf-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 focus:border-transparent"
              placeholder="輸入作者名稱"
            />
          </div>

          {/* 摘要 */}
          <div>
            <label
              htmlFor="summary"
              className="block text-sm font-medium text-waldorf-clay-700 mb-1"
            >
              摘要
            </label>
            <textarea
              id="summary"
              name="summary"
              value={formData.summary}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-waldorf-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 focus:border-transparent resize-none"
              placeholder="輸入文章摘要"
            />
          </div>

          {/* 內容 - 富文本編輯器 */}
          <div>
            <label
              className="block text-sm font-medium text-waldorf-clay-700 mb-2"
            >
              內容 <span className="text-waldorf-rose-500">*</span>
            </label>
            <div className="border border-waldorf-cream-300 rounded-md overflow-hidden" data-color-mode="light">
              <MDEditor
                value={formData.content}
                onChange={handleContentChange}
                height={500}
                preview="live"
                hideToolbar={false}
                enableScroll={true}
                visibleDragbar={true}
                textareaProps={{
                  placeholder: '輸入文章內容，支援 Markdown 格式...',
                }}
              />
            </div>
            <p className="text-xs text-waldorf-clay-500 mt-1">
              使用富文本編輯器編輯內容，內容將以 Markdown 格式儲存
            </p>
          </div>

          {/* 發布狀態 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublished"
              name="isPublished"
              checked={formData.isPublished}
              onChange={handleChange}
              className="w-4 h-4 text-waldorf-sage-600 border-waldorf-cream-300 rounded focus:ring-2 focus:ring-waldorf-sage-500"
            />
            <label
              htmlFor="isPublished"
              className="text-sm font-medium text-waldorf-clay-700"
            >
              已發布
            </label>
          </div>

          {/* 按鈕區 */}
          <div className="flex gap-3 pt-4 border-t border-waldorf-cream-200">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-waldorf-sage-600 text-white rounded-md hover:bg-waldorf-sage-700 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? '儲存中...' : '儲存'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-6 py-2 bg-white text-waldorf-clay-700 border border-waldorf-cream-300 rounded-md hover:bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </form>
    </article>
  )
}
