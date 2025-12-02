/**
 * 組件 - 文章編輯器
 * 提供文章編輯功能的表單介面，使用富文本編輯器
 * 包含權限檢查 - 只有admin和該類別的教師可編輯
 */

import { useState, useEffect } from 'react'
import { Article } from '@/types'
import { useAuth } from '@/context/AuthContext'
import PermissionService, { PermissionError } from '@/services/PermissionService'
import ArticleService from '@/services/ArticleService'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'

interface ArticleEditorProps {
  article: Article
  onSave: (updates: Partial<Article>) => void
  onCancel: () => void
  isSaving?: boolean
  canEdit?: boolean
  permissionError?: string
}

export function ArticleEditor({
  article,
  onSave,
  onCancel,
  isSaving = false,
  canEdit,
  permissionError,
}: ArticleEditorProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    title: article.title,
    author: article.author || '',
    summary: article.summary || '',
    content: article.content,
    isPublished: article.isPublished,
  })
  const [localPermissionError, setLocalPermissionError] = useState<string>('')
  const [isCheckingPermission, setIsCheckingPermission] = useState(false)
  const [hasEditPermission, setHasEditPermission] = useState(canEdit ?? false)

  // article.content 已經是 HTML 格式（TipTap 直接輸出），直接使用
  // Content is already in HTML format from the database
  const editorContent = formData.content

  // 檢查編輯權限
  useEffect(() => {
    const checkPermission = async () => {
      if (canEdit !== undefined) {
        setHasEditPermission(canEdit)
        if (permissionError) {
          setLocalPermissionError(permissionError)
        }
        return
      }

      if (!user?.id) {
        setLocalPermissionError('未登入')
        setHasEditPermission(false)
        return
      }

      setIsCheckingPermission(true)
      try {
        // 獲取文章完整資訊以檢查權限
        const articleRow = await ArticleService.getArticleById(article.id)
        const canEditArticle = await PermissionService.canEditArticle(user.id, articleRow)
        setHasEditPermission(canEditArticle)

        if (!canEditArticle) {
          const role = await PermissionService.getUserRole(user.id)
          setLocalPermissionError(
            role === 'parent' || role === 'student'
              ? '家長和學生不能編輯文章'
              : '你沒有編輯此文章的權限。只有管理員和該類別的老師可以編輯。'
          )
        }
      } catch (err) {
        if (err instanceof PermissionError) {
          setLocalPermissionError(err.message)
        } else {
          console.error('Failed to check permission:', err)
          setLocalPermissionError('檢查權限時出錯')
        }
        setHasEditPermission(false)
      } finally {
        setIsCheckingPermission(false)
      }
    }

    checkPermission()
  }, [article.id, user?.id, canEdit, permissionError])

  // 當文章改變時更新表單
  useEffect(() => {
    setFormData({
      title: article.title,
      author: article.author || '',
      summary: article.summary || '',
      content: article.content,
      isPublished: article.isPublished,
    })
  }, [article])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Save HTML content directly (TipTap output)
    // No conversion needed - store HTML directly in database
    onSave({
      title: formData.title,
      author: formData.author || undefined,
      summary: formData.summary || undefined,
      content: formData.content,  // Already HTML from editor
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

  // 如果沒有編輯權限，顯示權限拒絕信息
  if (!hasEditPermission && !isCheckingPermission) {
    return (
      <article className="h-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-waldorf-cream-200 bg-waldorf-sage-50">
          <h1 className="text-2xl font-bold text-waldorf-clay-800 mb-2">編輯文章</h1>
          <div className="flex items-center gap-2 text-sm text-waldorf-clay-600">
            <span>文章 ID: {article.id}</span>
            <span>|</span>
            <span>週次: {article.weekNumber}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-white p-6">
          <div className="max-w-md text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-2">無法編輯</h2>
              <p className="text-red-700 mb-4">{localPermissionError}</p>
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-waldorf-sage-600 text-white rounded-md hover:bg-waldorf-sage-700"
              >
                返回
              </button>
            </div>
          </div>
        </div>
      </article>
    )
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
        <div className="max-w-6xl mx-auto space-y-4">
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
            <div className="border border-waldorf-cream-300 rounded-md overflow-hidden">
              <SimpleEditor
                content={editorContent}
                contentType="html"
                onChange={(html) => handleContentChange(html)}
                placeholder="輸入文章內容..."
              />
            </div>
            <p className="text-xs text-waldorf-clay-500 mt-1">
              使用富文本編輯器編輯內容
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
