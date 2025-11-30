/**
 * Class Article Filter Component
 * Multi-select UI for filtering articles by class or family
 *
 * US3: Class-Based Article Visibility
 * - Displays available classes sorted by grade year (DESC)
 * - Fetches and displays articles for selected classes
 * - Shows visual hierarchy with grade year indicators
 * - Supports single and multi-class selection
 */

import React, { useEffect, useState } from 'react'
import type { ClassRow, ArticleRow } from '@/types/database'
import { FamilyService } from '@/services/FamilyService'
import { getArticlesForFamily, getArticlesForClass } from '@/services/queries/classArticleQueries'

interface ClassArticleFilterProps {
  /** Family ID for filtering (parent/visitor view) */
  familyId?: string
  /** Week number to filter articles */
  weekNumber: string
  /** Callback when articles are loaded */
  onArticlesLoaded?: (articles: ArticleRow[]) => void
  /** CSS class for custom styling */
  className?: string
}

/**
 * Class Article Filter Component
 */
export const ClassArticleFilter: React.FC<ClassArticleFilterProps> = ({
  familyId,
  weekNumber,
  onArticlesLoaded,
  className = '',
}) => {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [articles, setArticles] = useState<ArticleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load available classes
  useEffect(() => {
    const loadClasses = async () => {
      try {
        setLoading(true)
        setError(null)

        if (familyId) {
          // Load family's children classes (sorted by grade year DESC)
          const familyClasses = await FamilyService.getChildrenClasses(familyId)
          setClasses(familyClasses)

          // Auto-select all family classes
          if (familyClasses.length > 0) {
            const classIds = familyClasses.map((c) => c.id)
            setSelectedClasses(classIds)

            // Load articles for all family classes
            const { articles: familyArticles } = await getArticlesForFamily(
              familyId,
              weekNumber
            )
            setArticles(familyArticles)
            onArticlesLoaded?.(familyArticles)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load classes')
      } finally {
        setLoading(false)
      }
    }

    loadClasses()
  }, [familyId, weekNumber, onArticlesLoaded])

  // Load articles when selected classes change
  useEffect(() => {
    const loadArticles = async () => {
      if (selectedClasses.length === 0) {
        setArticles([])
        onArticlesLoaded?.([])
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load articles for each selected class
        const articlesByClass: Record<string, ArticleRow[]> = {}
        const articleMap = new Map<string, ArticleRow>()

        for (const classId of selectedClasses) {
          const classArticles = await getArticlesForClass(classId, weekNumber)
          articlesByClass[classId] = classArticles

          // Deduplicate by article ID
          for (const article of classArticles) {
            if (!articleMap.has(article.id)) {
              articleMap.set(article.id, article)
            }
          }
        }

        // Convert to array and sort by article_order
        const deduplicatedArticles = Array.from(articleMap.values()).sort(
          (a, b) => a.article_order - b.article_order
        )

        setArticles(deduplicatedArticles)
        onArticlesLoaded?.(deduplicatedArticles)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load articles')
      } finally {
        setLoading(false)
      }
    }

    if (!familyId) {
      loadArticles()
    }
  }, [selectedClasses, weekNumber, familyId, onArticlesLoaded])

  const handleClassToggle = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId) ? prev.filter((c) => c !== classId) : [...prev, classId]
    )
  }

  const handleSelectAll = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([])
    } else {
      setSelectedClasses(classes.map((c) => c.id))
    }
  }

  return (
    <div className={`class-article-filter ${className}`}>
      {/* Filter Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-waldorf-brown mb-2">
          Filter by Class
        </h3>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && classes.length === 0 && (
        <div className="text-center py-4 text-gray-500">Loading classes...</div>
      )}

      {/* Class Selection */}
      {classes.length > 0 && (
        <div className="space-y-2 mb-6">
          {/* Select All Option */}
          <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={selectedClasses.length === classes.length && classes.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="ml-2 font-medium text-gray-700">Select All</span>
          </label>

          {/* Class Options (sorted by grade year DESC) */}
          <div className="border-t pt-2">
            {classes.map((cls) => (
              <label
                key={cls.id}
                className="flex items-center p-2 hover:bg-waldorf-cream rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedClasses.includes(cls.id)}
                  onChange={() => handleClassToggle(cls.id)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="ml-2 flex-1">
                  <span className="font-medium text-gray-800">{cls.class_name}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    Grade {cls.class_grade_year}
                  </span>
                </span>
                {/* Visual indicator for higher grades */}
                {cls.class_grade_year >= 3 && (
                  <span className="inline-block ml-2 w-2 h-2 bg-waldorf-peach rounded-full" />
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* No Classes Message */}
      {classes.length === 0 && !loading && (
        <div className="p-4 bg-gray-50 rounded text-gray-600">
          No classes available for this family.
        </div>
      )}

      {/* Article Count */}
      <div className="mt-4 p-3 bg-waldorf-sage/10 rounded">
        <p className="text-sm text-gray-700">
          {articles.length === 0
            ? 'No articles found for selected classes'
            : `${articles.length} article${articles.length === 1 ? '' : 's'} available`}
        </p>
      </div>

      {/* Selected Classes Summary */}
      {selectedClasses.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium text-gray-700 mb-2">Selected Classes:</p>
          <div className="flex flex-wrap gap-2">
            {selectedClasses
              .map((id) => classes.find((c) => c.id === id))
              .filter(Boolean)
              .map((cls) => (
                <span
                  key={cls!.id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-waldorf-sage text-white"
                >
                  {cls!.class_name}
                  <button
                    onClick={() => handleClassToggle(cls!.id)}
                    className="ml-1 hover:opacity-75"
                    aria-label={`Remove ${cls!.class_name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ClassArticleFilter
