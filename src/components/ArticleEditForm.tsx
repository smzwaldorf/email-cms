/**
 * Article Edit Form Component
 * US4: Editor Updates Existing Articles
 *
 * Allows editors to load an article and update its content with conflict detection
 * - Loads article for editing
 * - Shows last updated timestamp
 * - Detects concurrent edits (last-write-wins per spec)
 * - Displays edit history via audit log
 * - Supports reverting to previous versions
 */

import { useState, useEffect } from 'react'
import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'
import type { ArticleRow } from '@/types/database'
import { ArticleUpdateService } from '@/services/ArticleUpdateService'
import { ArticleServiceError } from '@/services/ArticleService'

interface ArticleEditFormProps {
  articleId: string
  onSave?: (article: ArticleRow) => void
  onCancel?: () => void
  onError?: (error: Error) => void
}

interface FormState {
  title: string
  content: string
  author: string | null
  visibilityType: 'public' | 'class_restricted'
  restrictedToClasses: string[] | null
}

interface ConflictInfo {
  detected: boolean
  localVersion: ArticleRow | null
  remoteVersion: ArticleRow | null
}

/**
 * Article Edit Form Component
 */
export function ArticleEditForm({
  articleId,
  onSave,
  onCancel,
  onError,
}: ArticleEditFormProps) {
  const [article, setArticle] = useState<ArticleRow | null>(null)
  const [formData, setFormData] = useState<FormState>({
    title: '',
    content: '',
    author: null,
    visibilityType: 'public',
    restrictedToClasses: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ConflictInfo>({
    detected: false,
    localVersion: null,
    remoteVersion: null,
  })
  const [showHistory, setShowHistory] = useState(false)
  const [auditHistory, setAuditHistory] = useState<any[]>([])

  /**
   * Load article on mount
   */
  useEffect(() => {
    loadArticle()
  }, [articleId])

  /**
   * Load article from database
   */
  const loadArticle = async () => {
    try {
      setIsLoading(true)
      setSaveError(null)
      const loadedArticle = await ArticleUpdateService.detectConflict(articleId, {} as ArticleRow)
      const artData = loadedArticle.remoteVersion

      setArticle(artData)
      setFormData({
        title: artData.title,
        content: artData.content,
        author: artData.author || null,
        visibilityType: artData.visibility_type,
        restrictedToClasses: artData.restricted_to_classes || null,
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setSaveError(`Failed to load article: ${error.message}`)
      if (onError) onError(error)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Load edit history (audit log)
   */
  const loadHistory = async () => {
    try {
      const history = await ArticleUpdateService.getArticleHistory(articleId, 10)
      setAuditHistory(history)
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }

  /**
   * Handle form field changes
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  /**
   * Handle content editor changes
   */
  const handleContentChange = (value?: string) => {
    setFormData((prev) => ({
      ...prev,
      content: value || '',
    }))
  }

  /**
   * Check for conflicts before saving
   */
  const checkForConflict = async (): Promise<boolean> => {
    if (!article) return false

    try {
      const result = await ArticleUpdateService.detectConflict(articleId, article)
      if (result.hasConflict) {
        setConflict({
          detected: true,
          localVersion: article,
          remoteVersion: result.remoteVersion,
        })
        return true
      }
      return false
    } catch (err) {
      console.error('Error checking conflict:', err)
      return false
    }
  }

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.title.trim()) {
      setSaveError('Title is required')
      return
    }

    if (!formData.content.trim()) {
      setSaveError('Content is required')
      return
    }

    try {
      setIsSaving(true)
      setSaveError(null)

      // Check for conflicts (implements last-write-wins)
      const hasConflict = await checkForConflict()
      if (hasConflict) {
        // Note: UI will show conflict notification
        // User can choose to save (overwrite) or reload
        return
      }

      // Update article
      const updated = await ArticleUpdateService.updateArticleContent(
        articleId,
        formData.title,
        formData.content,
      )

      setArticle(updated)
      if (onSave) onSave(updated)
    } catch (err) {
      const error = err instanceof ArticleServiceError ? err : new Error(String(err))
      setSaveError(error.message)
      if (onError) onError(error)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle revert to previous version
   */
  const handleRevert = async (auditLogId: string) => {
    try {
      setIsSaving(true)
      setSaveError(null)

      const reverted = await ArticleUpdateService.revertToPreviousVersion(
        articleId,
        auditLogId,
      )

      setArticle(reverted)
      setFormData({
        title: reverted.title,
        content: reverted.content,
        author: reverted.author || null,
        visibilityType: reverted.visibility_type,
        restrictedToClasses: reverted.restricted_to_classes || null,
      })
      setShowHistory(false)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setSaveError(`Failed to revert: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle overwriting conflict (last-write-wins)
   */
  const handleOverrideConflict = async () => {
    try {
      setIsSaving(true)
      setSaveError(null)
      setConflict({ detected: false, localVersion: null, remoteVersion: null })

      const updated = await ArticleUpdateService.updateArticleContent(
        articleId,
        formData.title,
        formData.content,
      )

      setArticle(updated)
      if (onSave) onSave(updated)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setSaveError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle reload after conflict
   */
  const handleReloadAfterConflict = async () => {
    setConflict({ detected: false, localVersion: null, remoteVersion: null })
    await loadArticle()
  }

  if (isLoading) {
    return (
      <article className="h-full flex items-center justify-center bg-waldorf-cream-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-waldorf-sage-600 mx-auto mb-4"></div>
          <p className="text-waldorf-clay-600">Loading article...</p>
        </div>
      </article>
    )
  }

  if (!article) {
    return (
      <article className="h-full flex items-center justify-center bg-waldorf-cream-50">
        <div className="text-center">
          <p className="text-waldorf-clay-600 mb-4">Article not found</p>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-waldorf-sage-600 text-white rounded-md hover:bg-waldorf-sage-700"
            >
              Back
            </button>
          )}
        </div>
      </article>
    )
  }

  return (
    <article className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-waldorf-cream-200 bg-waldorf-sage-50">
        <h1 className="text-2xl font-bold text-waldorf-clay-800 mb-2">Edit Article</h1>
        <div className="flex items-center gap-4 text-sm text-waldorf-clay-600">
          <span>ID: {article.id}</span>
          <span>|</span>
          <span>Week: {article.week_number}</span>
          <span>|</span>
          <span>Last updated: {new Date(article.updated_at).toLocaleString()}</span>
          <button
            type="button"
            onClick={() => {
              setShowHistory(!showHistory)
              if (!showHistory) loadHistory()
            }}
            className="ml-auto px-3 py-1 text-waldorf-sage-600 hover:bg-waldorf-sage-100 rounded transition-colors"
          >
            {showHistory ? 'Hide History' : 'View History'}
          </button>
        </div>
      </div>

      {/* Conflict Notification */}
      {conflict.detected && (
        <div className="px-6 py-4 bg-waldorf-rose-50 border-b border-waldorf-rose-200">
          <div className="max-w-4xl mx-auto">
            <h3 className="font-semibold text-waldorf-rose-800 mb-2">
              ⚠️ Concurrent Edit Detected
            </h3>
            <p className="text-sm text-waldorf-rose-700 mb-3">
              This article was modified since you loaded it. Last change at:{' '}
              {conflict.remoteVersion && new Date(conflict.remoteVersion.updated_at).toLocaleString()}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleOverrideConflict}
                disabled={isSaving}
                className="px-4 py-2 bg-waldorf-rose-600 text-white rounded-md hover:bg-waldorf-rose-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Overwrite (Last-Write-Wins)'}
              </button>
              <button
                type="button"
                onClick={handleReloadAfterConflict}
                disabled={isSaving}
                className="px-4 py-2 bg-waldorf-cream-200 text-waldorf-clay-700 rounded-md hover:bg-waldorf-cream-300 disabled:opacity-50 transition-colors"
              >
                Reload Latest Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit History Sidebar */}
      {showHistory && (
        <div className="px-6 py-4 bg-waldorf-cream-50 border-b border-waldorf-cream-200 max-h-48 overflow-y-auto">
          <h3 className="font-semibold text-waldorf-clay-800 mb-3">Edit History</h3>
          {auditHistory.length === 0 ? (
            <p className="text-sm text-waldorf-clay-500">No history available</p>
          ) : (
            <div className="space-y-2">
              {auditHistory.map((entry: any) => (
                <div key={entry.id} className="text-sm p-2 bg-white rounded border border-waldorf-cream-200">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-waldorf-clay-700">{entry.action}</span>
                    <span className="text-waldorf-clay-500">
                      {new Date(entry.changed_at).toLocaleString()}
                    </span>
                  </div>
                  {entry.action !== 'delete' && (
                    <button
                      type="button"
                      onClick={() => handleRevert(entry.id)}
                      disabled={isSaving}
                      className="text-xs text-waldorf-sage-600 hover:text-waldorf-sage-700 disabled:opacity-50"
                    >
                      Revert to this version
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {saveError && (
        <div className="px-6 py-3 bg-waldorf-rose-50 border-b border-waldorf-rose-200">
          <p className="text-sm text-waldorf-rose-700">{saveError}</p>
        </div>
      )}

      {/* Edit Form */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-6 py-4 bg-white"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-waldorf-clay-700 mb-1"
            >
              Title <span className="text-waldorf-rose-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              disabled={isSaving}
              className="w-full px-3 py-2 border border-waldorf-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 focus:border-transparent disabled:opacity-50"
              placeholder="Enter article title"
            />
          </div>

          {/* Author */}
          <div>
            <label
              htmlFor="author"
              className="block text-sm font-medium text-waldorf-clay-700 mb-1"
            >
              Author
            </label>
            <input
              type="text"
              id="author"
              name="author"
              value={formData.author || ''}
              onChange={handleChange}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-waldorf-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 focus:border-transparent disabled:opacity-50"
              placeholder="Enter author name"
            />
          </div>

          {/* Visibility Type */}
          <div>
            <label
              htmlFor="visibilityType"
              className="block text-sm font-medium text-waldorf-clay-700 mb-1"
            >
              Visibility
            </label>
            <select
              id="visibilityType"
              name="visibilityType"
              value={formData.visibilityType}
              onChange={handleChange}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-waldorf-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="public">Public</option>
              <option value="class_restricted">Class Restricted (班級大小事)</option>
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-waldorf-clay-700 mb-2">
              Content <span className="text-waldorf-rose-500">*</span>
            </label>
            <div
              className="border border-waldorf-cream-300 rounded-md overflow-hidden"
              data-color-mode="light"
            >
              <MDEditor
                value={formData.content}
                onChange={handleContentChange}
                height={500}
                preview="live"
                hideToolbar={false}
                enableScroll={true}
                visibleDragbar={true}
                textareaProps={{
                  placeholder: 'Enter article content in Markdown format...',
                  disabled: isSaving,
                }}
              />
            </div>
            <p className="text-xs text-waldorf-clay-500 mt-1">
              Edit content using Markdown format. Content will be saved automatically.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-waldorf-cream-200">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-waldorf-sage-600 text-white rounded-md hover:bg-waldorf-sage-700 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="px-6 py-2 bg-white text-waldorf-clay-700 border border-waldorf-cream-300 rounded-md hover:bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>
    </article>
  )
}
