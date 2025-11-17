/**
 * useArticleEditor Hook
 * Enhanced state management for article creation and editing
 * Integrates with ArticleService for database operations
 */

import { useState, useCallback, useRef } from 'react'
import ArticleService, { CreateArticleDTO, UpdateArticleDTO } from '@/services/ArticleService'
import type { ArticleRow } from '@/types/database'

/**
 * Article form state
 */
export interface ArticleFormState {
  weekNumber: string
  title: string
  content: string
  author?: string
  visibilityType: 'public' | 'class_restricted'
  restrictedToClasses: string[]
  articleOrder?: number
}

/**
 * Validation errors
 */
export interface ValidationErrors {
  title?: string
  content?: string
  author?: string
  visibilityType?: string
  restrictedToClasses?: string
  weekNumber?: string
  articleOrder?: string
}

/**
 * Hook state
 */
export interface UseArticleEditorState {
  editingArticleId: string | null
  unsavedChanges: boolean
  isSaving: boolean
  isPublishing: boolean
  error: string | null
  formData: ArticleFormState
  errors: ValidationErrors
  article: ArticleRow | null
}

/**
 * Hook actions
 */
export interface UseArticleEditorActions {
  startEditing: (articleId: string) => void
  stopEditing: () => void
  markAsChanged: () => void
  markAsSaved: () => void
  clearError: () => void
  setError: (error: string) => void
  setIsSaving: (isSaving: boolean) => void
  setFormData: (data: Partial<ArticleFormState>) => void
  resetForm: () => void
  validate: () => boolean
  saveArticle: () => Promise<ArticleRow>
  publishArticle: () => Promise<ArticleRow>
  unpublishArticle: () => Promise<ArticleRow>
  deleteArticle: () => Promise<void>
}

const defaultFormState: ArticleFormState = {
  weekNumber: '',
  title: '',
  content: '',
  author: '',
  visibilityType: 'public',
  restrictedToClasses: [],
  articleOrder: undefined,
}

export function useArticleEditor(
  initialArticle?: ArticleRow,
): UseArticleEditorState & UseArticleEditorActions {
  const [state, setState] = useState<UseArticleEditorState>({
    editingArticleId: initialArticle?.id || null,
    unsavedChanges: false,
    isSaving: false,
    isPublishing: false,
    error: null,
    formData: initialArticle
      ? {
          weekNumber: initialArticle.week_number,
          title: initialArticle.title,
          content: initialArticle.content,
          author: initialArticle.author || '',
          visibilityType: initialArticle.visibility_type as any,
          restrictedToClasses: initialArticle.restricted_to_classes || [],
          articleOrder: initialArticle.article_order,
        }
      : defaultFormState,
    errors: {},
    article: initialArticle || null,
  })

  const isEditing = useRef(!!initialArticle)

  const startEditing = useCallback((articleId: string) => {
    setState(prev => ({
      ...prev,
      editingArticleId: articleId,
      unsavedChanges: false,
      error: null,
    }))
  }, [])

  const stopEditing = useCallback(() => {
    setState(prev => ({
      ...prev,
      editingArticleId: null,
      unsavedChanges: false,
    }))
  }, [])

  const markAsChanged = useCallback(() => {
    setState(prev => ({
      ...prev,
      unsavedChanges: true,
    }))
  }, [])

  const markAsSaved = useCallback(() => {
    setState(prev => ({
      ...prev,
      unsavedChanges: false,
      isSaving: false,
    }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }))
  }, [])

  const setError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      error,
      isSaving: false,
    }))
  }, [])

  const setIsSaving = useCallback((isSaving: boolean) => {
    setState(prev => ({
      ...prev,
      isSaving,
    }))
  }, [])

  const setFormData = useCallback((data: Partial<ArticleFormState>) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, ...data },
      unsavedChanges: true,
      error: null,
    }))
  }, [])

  const resetForm = useCallback(() => {
    setState(prev => ({
      ...prev,
      formData: initialArticle
        ? {
            weekNumber: initialArticle.week_number,
            title: initialArticle.title,
            content: initialArticle.content,
            author: initialArticle.author || '',
            visibilityType: initialArticle.visibility_type as any,
            restrictedToClasses: initialArticle.restricted_to_classes || [],
            articleOrder: initialArticle.article_order,
          }
        : defaultFormState,
      errors: {},
      error: null,
      unsavedChanges: false,
    }))
  }, [initialArticle])

  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {}

    if (!state.formData.weekNumber?.trim()) {
      newErrors.weekNumber = 'Week number is required'
    }

    if (!state.formData.title?.trim()) {
      newErrors.title = 'Title is required'
    } else if (state.formData.title.length > 500) {
      newErrors.title = 'Title must be 500 characters or less'
    }

    if (!state.formData.content?.trim()) {
      newErrors.content = 'Content is required'
    }

    if (
      state.formData.visibilityType === 'class_restricted' &&
      state.formData.restrictedToClasses.length === 0
    ) {
      newErrors.restrictedToClasses = 'At least one class must be selected'
    }

    setState(prev => ({ ...prev, errors: newErrors }))
    return Object.keys(newErrors).length === 0
  }, [state.formData])

  const saveArticle = useCallback(async (): Promise<ArticleRow> => {
    if (!validate()) {
      throw new Error('Form validation failed')
    }

    setIsSaving(true)
    clearError()

    try {
      let result: ArticleRow

      if (isEditing.current && state.article?.id) {
        result = await ArticleService.updateArticle(state.article.id, {
          title: state.formData.title,
          content: state.formData.content,
          author: state.formData.author || undefined,
          visibilityType: state.formData.visibilityType,
          restrictedToClasses:
            state.formData.visibilityType === 'class_restricted'
              ? state.formData.restrictedToClasses
              : null,
        })
      } else {
        result = await ArticleService.createArticle({
          weekNumber: state.formData.weekNumber,
          title: state.formData.title,
          content: state.formData.content,
          author: state.formData.author || undefined,
          articleOrder: state.formData.articleOrder || 1,
          visibilityType: state.formData.visibilityType,
          restrictedToClasses:
            state.formData.visibilityType === 'class_restricted'
              ? state.formData.restrictedToClasses
              : null,
        } as CreateArticleDTO)
        isEditing.current = true
      }

      setState(prev => ({
        ...prev,
        article: result,
        editingArticleId: result.id,
        unsavedChanges: false,
        isSaving: false,
      }))

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setState(prev => ({ ...prev, error: errorMessage, isSaving: false }))
      throw err
    }
  }, [state.article?.id, state.formData, validate, clearError])

  const publishArticle = useCallback(async (): Promise<ArticleRow> => {
    if (!state.article?.id) {
      throw new Error('Article must be saved before publishing')
    }

    setState(prev => ({ ...prev, isPublishing: true }))

    try {
      const result = await ArticleService.publishArticle(state.article.id)
      setState(prev => ({
        ...prev,
        article: result,
        isPublishing: false,
        unsavedChanges: false,
      }))
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setState(prev => ({ ...prev, error: errorMessage, isPublishing: false }))
      throw err
    }
  }, [state.article?.id])

  const unpublishArticle = useCallback(async (): Promise<ArticleRow> => {
    if (!state.article?.id) {
      throw new Error('Article not found')
    }

    setState(prev => ({ ...prev, isPublishing: true }))

    try {
      const result = await ArticleService.unpublishArticle(state.article.id)
      setState(prev => ({
        ...prev,
        article: result,
        isPublishing: false,
      }))
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setState(prev => ({ ...prev, error: errorMessage, isPublishing: false }))
      throw err
    }
  }, [state.article?.id])

  const deleteArticle = useCallback(async (): Promise<void> => {
    if (!state.article?.id) {
      throw new Error('Article not found')
    }

    setIsSaving(true)

    try {
      await ArticleService.deleteArticle(state.article.id)
      setState(prev => ({
        ...prev,
        article: null,
        editingArticleId: null,
        formData: defaultFormState,
        isSaving: false,
        unsavedChanges: false,
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setState(prev => ({ ...prev, error: errorMessage, isSaving: false }))
      throw err
    }
  }, [state.article?.id])

  return {
    ...state,
    startEditing,
    stopEditing,
    markAsChanged,
    markAsSaved,
    clearError,
    setError,
    setIsSaving,
    setFormData,
    resetForm,
    validate,
    saveArticle,
    publishArticle,
    unpublishArticle,
    deleteArticle,
  }
}
