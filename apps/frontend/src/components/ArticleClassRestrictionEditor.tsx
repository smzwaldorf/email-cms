/**
 * Article Class Restriction Editor Component
 * UI for editors to set class-based article restrictions
 *
 * US3: Class-Based Article Visibility
 * - Toggle between public and class-restricted visibility
 * - Multi-select available classes with grade year indicators
 * - Validates that class-restricted articles have at least one class
 * - Saves restrictions via ArticleService
 */

import React, { useEffect, useState } from 'react'
import type { ArticleRow, ClassRow } from '@/types/database'
import { ArticleService } from '@/services/ArticleService'
import { ClassService } from '@/services/ClassService'

interface ArticleClassRestrictionEditorProps {
  /** Article to restrict (must be fetched article with full data) */
  article: ArticleRow
  /** Callback when restrictions are saved */
  onSave?: (updatedArticle: ArticleRow) => void
  /** Callback when restrictions are cleared */
  onClear?: (updatedArticle: ArticleRow) => void
  /** Callback on error */
  onError?: (error: string) => void
  /** CSS class for custom styling */
  className?: string
}

/**
 * Article Class Restriction Editor Component
 */
export const ArticleClassRestrictionEditor: React.FC<
  ArticleClassRestrictionEditorProps
> = ({ article, onSave, onClear, onError, className = '' }) => {
  const [visibilityType, setVisibilityType] = useState<'public' | 'class_restricted'>(
    article.visibility_type as 'public' | 'class_restricted'
  )
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    article.restricted_to_classes || []
  )
  const [availableClasses, setAvailableClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load available classes
  useEffect(() => {
    const loadClasses = async () => {
      try {
        setLoading(true)
        const classes = await ClassService.getAllClasses()
        // Sort by grade year DESC (older kids first)
        const sortedClasses = [...classes].sort(
          (a, b) => (b.class_grade_year || 0) - (a.class_grade_year || 0)
        )
        setAvailableClasses(sortedClasses)
      } catch (err) {
        const message = err instanceof Error ? err.message : '無法載入班級'
        setError(message)
        onError?.(message)
      } finally {
        setLoading(false)
      }
    }

    loadClasses()
  }, [onError])

  // Update visibility type change
  useEffect(() => {
    // If switching to public, clear class restrictions
    if (visibilityType === 'public') {
      setSelectedClasses([])
      setSuccess(false)
    }
  }, [visibilityType])

  const handleClassToggle = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId) ? prev.filter((c) => c !== classId) : [...prev, classId]
    )
    setSuccess(false)
  }

  const handleSelectAll = () => {
    if (selectedClasses.length === availableClasses.length) {
      setSelectedClasses([])
    } else {
      setSelectedClasses(availableClasses.map((c) => c.id))
    }
    setSuccess(false)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      if (visibilityType === 'class_restricted') {
        // Validate that at least one class is selected
        if (selectedClasses.length === 0) {
          setError('班級限定文章至少需選擇一個班級')
          onError?.('班級限定文章至少需選擇一個班級')
          setSaving(false)
          return
        }

        // Save class restrictions
        const updated = await ArticleService.setArticleClassRestriction(
          article.id,
          selectedClasses
        )
        setSuccess(true)
        onSave?.(updated)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '無法儲存限制設定'
      setError(message)
      onError?.(message)
    } finally {
      setSaving(false)
    }
  }

  const handleClearRestrictions = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      // Clear restrictions (revert to public)
      const updated = await ArticleService.removeArticleClassRestriction(article.id)
      setVisibilityType('public')
      setSelectedClasses([])
      setSuccess(true)
      onClear?.(updated)
    } catch (err) {
      const message = err instanceof Error ? err.message : '無法清除限制設定'
      setError(message)
      onError?.(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`article-class-restriction-editor ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-waldorf-brown mb-2">
          文章可見範圍設定
        </h2>
        <p className="text-gray-600">
          設定哪些班級可以看見這篇文章（班級大小事）
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700">
          可見範圍已儲存
        </div>
      )}

      {/* Current Article Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <p className="font-semibold text-gray-800 mb-1">{article.title}</p>
        <p className="text-sm text-gray-600">文章 ID： {article.id}</p>
      </div>

      {/* Visibility Type Toggle */}
      <fieldset className="mb-6">
        <legend className="text-lg font-semibold text-gray-800 mb-3">
          可見範圍類型
        </legend>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="public"
              checked={visibilityType === 'public'}
              onChange={(e) => setVisibilityType(e.target.value as 'public')}
              disabled={saving}
              className="w-4 h-4"
            />
            <span className="ml-3">
              <span className="font-medium text-gray-800">公開</span>
              <p className="text-sm text-gray-600">
                所有家長與訪客皆可查看
              </p>
            </span>
          </label>

          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="class_restricted"
              checked={visibilityType === 'class_restricted'}
              onChange={(e) => setVisibilityType(e.target.value as 'class_restricted')}
              disabled={saving}
              className="w-4 h-4"
            />
            <span className="ml-3">
              <span className="font-medium text-gray-800">班級限定</span>
              <p className="text-sm text-gray-600">
                僅選取的班級可查看
              </p>
            </span>
          </label>
        </div>
      </fieldset>

      {/* Class Selection (only shown for class-restricted) */}
      {visibilityType === 'class_restricted' && (
        <fieldset className="mb-6">
          <legend className="text-lg font-semibold text-gray-800 mb-3">
            限定班級
          </legend>

          {loading && <div className="text-gray-500">正在載入班級...</div>}

          {!loading && availableClasses.length > 0 && (
            <div className="space-y-2">
              {/* Select All Option */}
              <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    selectedClasses.length === availableClasses.length &&
                    availableClasses.length > 0
                  }
                  onChange={handleSelectAll}
                  disabled={saving}
                  className="w-4 h-4"
                />
                <span className="ml-2 font-medium text-gray-800">全選班級</span>
              </label>

              {/* Class Options */}
              <div className="border-t pt-2 mt-2">
                {availableClasses.map((cls) => (
                  <label
                    key={cls.id}
                    className="flex items-center p-3 hover:bg-waldorf-cream/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClasses.includes(cls.id)}
                      onChange={() => handleClassToggle(cls.id)}
                      disabled={saving}
                      className="w-4 h-4"
                    />
                    <span className="ml-3 flex-1">
                      <span className="font-medium text-gray-800">{cls.class_name}</span>
                      <span className="ml-2 text-sm text-gray-500">
                        （年級 {cls.class_grade_year})
                      </span>
                    </span>
                    {/* Grade year indicator */}
                    {cls.class_grade_year && cls.class_grade_year >= 3 && (
                      <span
                        className="ml-2 px-2 py-1 text-xs font-semibold rounded"
                        style={{ backgroundColor: '#d4a574', color: 'white' }}
                      >
                        高中
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {!loading && availableClasses.length === 0 && (
            <div className="p-4 bg-gray-50 rounded text-gray-600">
              沒有可選班級
            </div>
          )}

          {/* Validation Message */}
          {visibilityType === 'class_restricted' && selectedClasses.length === 0 && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
              請至少選擇一個班級，才能儲存為班級限定文章
            </div>
          )}
        </fieldset>
      )}

      {/* Selected Classes Summary */}
      {visibilityType === 'class_restricted' && selectedClasses.length > 0 && (
        <div className="mb-6 p-4 bg-waldorf-sage/10 rounded">
          <p className="font-semibold text-gray-800 mb-2">已選班級：</p>
          <div className="flex flex-wrap gap-2">
            {selectedClasses
              .map((id) => availableClasses.find((c) => c.id === id))
              .filter(Boolean)
              .map((cls) => (
                <span
                  key={cls!.id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-waldorf-sage text-white"
                >
                  {cls!.class_name}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {visibilityType === 'class_restricted' && (
          <button
            onClick={handleSave}
            disabled={saving || selectedClasses.length === 0}
            className="px-4 py-2 bg-waldorf-sage text-white rounded font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '儲存中...' : '儲存限制設定'}
          </button>
        )}

        {visibilityType === 'public' && article.visibility_type === 'class_restricted' && (
          <button
            onClick={handleClearRestrictions}
            disabled={saving}
            className="px-4 py-2 bg-waldorf-sage text-white rounded font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '清除中...' : '清除限制（設為公開）'}
          </button>
        )}

        {visibilityType === 'public' && article.visibility_type !== 'class_restricted' && (
          <span className="px-4 py-2 text-gray-600">
            這篇文章已設為公開
          </span>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
        <p className="font-semibold mb-2">關於班級限定</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>公開文章可供所有家長查看</li>
          <li>班級限定文章僅供孩子在所選班級的家長查看</li>
          <li>家長可以查看不同孩子所屬班級的文章</li>
          <li>一篇文章可以同時限定多個班級</li>
        </ul>
      </div>
    </div>
  )
}

export default ArticleClassRestrictionEditor
