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
        const message = err instanceof Error ? err.message : 'Failed to load classes'
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
          setError('Select at least one class for class-restricted articles')
          onError?.('Select at least one class for class-restricted articles')
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
      const message = err instanceof Error ? err.message : 'Failed to save restrictions'
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
      const message = err instanceof Error ? err.message : 'Failed to clear restrictions'
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
          Article Visibility Settings
        </h2>
        <p className="text-gray-600">
          Control which classes can see this article (班級大小事)
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
          Restrictions saved successfully
        </div>
      )}

      {/* Current Article Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <p className="font-semibold text-gray-800 mb-1">{article.title}</p>
        <p className="text-sm text-gray-600">Week: {article.week_number}</p>
      </div>

      {/* Visibility Type Toggle */}
      <fieldset className="mb-6">
        <legend className="text-lg font-semibold text-gray-800 mb-3">
          Visibility Type
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
              <span className="font-medium text-gray-800">Public</span>
              <p className="text-sm text-gray-600">
                Visible to all parents and visitors
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
              <span className="font-medium text-gray-800">Class Restricted</span>
              <p className="text-sm text-gray-600">
                Only visible to selected classes
              </p>
            </span>
          </label>
        </div>
      </fieldset>

      {/* Class Selection (only shown for class-restricted) */}
      {visibilityType === 'class_restricted' && (
        <fieldset className="mb-6">
          <legend className="text-lg font-semibold text-gray-800 mb-3">
            Restrict to Classes
          </legend>

          {loading && <div className="text-gray-500">Loading classes...</div>}

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
                <span className="ml-2 font-medium text-gray-800">Select All Classes</span>
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
                        (Grade {cls.class_grade_year})
                      </span>
                    </span>
                    {/* Grade year indicator */}
                    {cls.class_grade_year && cls.class_grade_year >= 3 && (
                      <span
                        className="ml-2 px-2 py-1 text-xs font-semibold rounded"
                        style={{ backgroundColor: '#d4a574', color: 'white' }}
                      >
                        High School
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {!loading && availableClasses.length === 0 && (
            <div className="p-4 bg-gray-50 rounded text-gray-600">
              No classes available
            </div>
          )}

          {/* Validation Message */}
          {visibilityType === 'class_restricted' && selectedClasses.length === 0 && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
              Select at least one class to save as class-restricted
            </div>
          )}
        </fieldset>
      )}

      {/* Selected Classes Summary */}
      {visibilityType === 'class_restricted' && selectedClasses.length > 0 && (
        <div className="mb-6 p-4 bg-waldorf-sage/10 rounded">
          <p className="font-semibold text-gray-800 mb-2">Classes Selected:</p>
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
            {saving ? 'Saving...' : 'Save Restrictions'}
          </button>
        )}

        {visibilityType === 'public' && article.visibility_type === 'class_restricted' && (
          <button
            onClick={handleClearRestrictions}
            disabled={saving}
            className="px-4 py-2 bg-waldorf-sage text-white rounded font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Clearing...' : 'Clear Restrictions (Make Public)'}
          </button>
        )}

        {visibilityType === 'public' && article.visibility_type !== 'class_restricted' && (
          <span className="px-4 py-2 text-gray-600">
            Article is already public
          </span>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
        <p className="font-semibold mb-2">About Class Restrictions</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Public articles are visible to all parents</li>
          <li>Class-restricted articles are only visible to parents with children in selected classes</li>
          <li>Parents can see articles from multiple children's classes</li>
          <li>An article can be restricted to multiple classes at once</li>
        </ul>
      </div>
    </div>
  )
}

export default ArticleClassRestrictionEditor
