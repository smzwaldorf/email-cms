/**
 * 自定義 Hook - 文章編輯狀態管理
 * 管理編輯器的狀態，包括編輯中的文章、編輯模式、保存狀態等
 */

import { useState, useCallback } from 'react'

interface UseArticleEditorState {
  editingArticleId: string | null
  unsavedChanges: boolean
  isSaving: boolean
  error: string | null
}

interface UseArticleEditorActions {
  startEditing: (articleId: string) => void
  stopEditing: () => void
  markAsChanged: () => void
  markAsSaved: () => void
  clearError: () => void
  setError: (error: string) => void
  setIsSaving: (isSaving: boolean) => void
}

export function useArticleEditor(): UseArticleEditorState & UseArticleEditorActions {
  const [state, setState] = useState<UseArticleEditorState>({
    editingArticleId: null,
    unsavedChanges: false,
    isSaving: false,
    error: null,
  })

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

  return {
    ...state,
    startEditing,
    stopEditing,
    markAsChanged,
    markAsSaved,
    clearError,
    setError,
    setIsSaving,
  }
}
