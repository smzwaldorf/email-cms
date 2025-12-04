/**
 * 自動儲存 Hook
 * Auto Save Hook
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type { AutoSaveState } from '@/types/editor'

/**
 * 自動儲存配置選項
 * Auto save configuration options
 */
export interface UseAutoSaveOptions {
  // 儲存間隔（毫秒）/ Save interval in milliseconds
  interval?: number
  // 儲存函數 / Save function
  onSave: (content: string) => Promise<void>
  // 初始內容 / Initial content
  initialContent?: string
  // 是否啟用 / Enable auto save
  enabled?: boolean
  // localStorage 備份鍵值 / localStorage backup key
  storageKey?: string
  // 保留備份數量 / Number of backups to keep
  maxBackups?: number
}

/**
 * 自動儲存 Hook
 * Use Auto Save Hook
 */
export function useAutoSave(options: UseAutoSaveOptions) {
  const {
    interval = 2000,
    onSave,
    initialContent = '',
    enabled = true,
    storageKey = 'editor_autosave',
    maxBackups = 10,
  } = options

  // 狀態
  // State
  const [state, setState] = useState<AutoSaveState>({
    enabled,
    interval,
    pendingChanges: false,
    saveInProgress: false,
  })

  // 內容參考
  // Content reference
  const contentRef = useRef<string>(initialContent)
  const lastSavedRef = useRef<string>(initialContent)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * 保存到 localStorage
   * Save to localStorage
   */
  const saveToLocalStorage = useCallback((content: string) => {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        content,
      }

      // 取得現有備份
      // Get existing backups
      const existingKey = `${storageKey}_backups`
      const existing = localStorage.getItem(existingKey)
      const backups = existing ? JSON.parse(existing) : []

      // 新增新備份
      // Add new backup
      backups.push(backup)

      // 保持最多 maxBackups 個備份
      // Keep only maxBackups backups
      if (backups.length > maxBackups) {
        backups.shift()
      }

      localStorage.setItem(existingKey, JSON.stringify(backups))
      localStorage.setItem(storageKey, content)
    } catch (error) {
      console.error('保存到 localStorage 失敗 / Failed to save to localStorage:', error)
    }
  }, [storageKey, maxBackups])

  /**
   * 從 localStorage 恢復
   * Restore from localStorage
   */
  const restoreFromLocalStorage = useCallback((): string | null => {
    try {
      return localStorage.getItem(storageKey)
    } catch (error) {
      console.error('從 localStorage 恢復失敗 / Failed to restore from localStorage:', error)
      return null
    }
  }, [storageKey])

  /**
   * 執行儲存
   * Execute save
   */
  const executeSave = useCallback(async () => {
    if (!state.enabled || state.saveInProgress) {
      return
    }

    if (contentRef.current === lastSavedRef.current) {
      // 內容未變更，無需儲存
      // Content unchanged, no need to save
      return
    }

    setState((prev) => ({
      ...prev,
      saveInProgress: true,
    }))

    try {
      // 儲存到後端
      // Save to backend
      await onSave(contentRef.current)

      // 更新最後儲存內容
      // Update last saved content
      lastSavedRef.current = contentRef.current

      // 保存到 localStorage 作為備份
      // Save to localStorage as backup
      saveToLocalStorage(contentRef.current)

      // 更新狀態
      // Update state
      setState((prev) => ({
        ...prev,
        saveInProgress: false,
        pendingChanges: false,
        lastSavedAt: new Date().toISOString(),
        lastError: undefined,
      }))
    } catch (error) {
      console.error('自動儲存失敗 / Auto save failed:', error)

      setState((prev) => ({
        ...prev,
        saveInProgress: false,
        lastError: error instanceof Error ? error : new Error(String(error)),
      }))
    }
  }, [state.enabled, state.saveInProgress, onSave, saveToLocalStorage])

  /**
   * 更新內容
   * Update content
   */
  const updateContent = useCallback((newContent: string) => {
    contentRef.current = newContent

    setState((prev) => ({
      ...prev,
      pendingChanges: true,
    }))

    // 清除現有定時器
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // 設置新定時器
    // Set new timer
    timerRef.current = setTimeout(() => {
      executeSave()
    }, interval)
  }, [interval, executeSave])

  /**
   * 立即儲存
   * Save immediately
   */
  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    return await executeSave()
  }, [executeSave])

  /**
   * 取消待保存的更改
   * Discard pending changes
   */
  const discardChanges = useCallback(() => {
    contentRef.current = lastSavedRef.current

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    setState((prev) => ({
      ...prev,
      pendingChanges: false,
    }))
  }, [])

  /**
   * 啟用/停用自動儲存
   * Enable/disable auto save
   */
  const toggleAutoSave = useCallback((enable: boolean) => {
    setState((prev) => ({
      ...prev,
      enabled: enable,
    }))

    if (!enable && timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /**
   * 清除 localStorage 備份
   * Clear localStorage backups
   */
  const clearBackups = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(`${storageKey}_backups`)
    } catch (error) {
      console.error('清除備份失敗 / Failed to clear backups:', error)
    }
  }, [storageKey])

  /**
   * 取得備份列表
   * Get backup list
   */
  const getBackups = useCallback(() => {
    try {
      const existing = localStorage.getItem(`${storageKey}_backups`)
      return existing ? JSON.parse(existing) : []
    } catch (error) {
      console.error('取得備份列表失敗 / Failed to get backups:', error)
      return []
    }
  }, [storageKey])

  /**
   * 恢復備份
   * Restore backup
   */
  const restoreBackup = useCallback((index: number) => {
    try {
      const backups = getBackups()
      if (index >= 0 && index < backups.length) {
        const backup = backups[index]
        updateContent(backup.content)
        return backup.content
      }
    } catch (error) {
      console.error('恢復備份失敗 / Failed to restore backup:', error)
    }

    return null
  }, [getBackups, updateContent])

  /**
   * 頁面卸載時儲存
   * Save on page unload
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.pendingChanges && state.enabled) {
        // 立即執行儲存
        // Execute save immediately
        if (contentRef.current !== lastSavedRef.current) {
          // 儲存到 localStorage
          // Save to localStorage
          saveToLocalStorage(contentRef.current)

          e.preventDefault()
          e.returnValue = ''
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [state.pendingChanges, state.enabled, saveToLocalStorage])

  /**
   * 清理定時器
   * Cleanup timer
   */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return {
    // 狀態
    // State
    state,
    pendingChanges: state.pendingChanges,
    saving: state.saveInProgress,
    lastSavedAt: state.lastSavedAt,
    error: state.lastError,

    // 操作
    // Operations
    updateContent,
    saveNow,
    discardChanges,
    toggleAutoSave,

    // LocalStorage 相關
    // LocalStorage related
    restoreFromLocalStorage,
    saveToLocalStorage,
    clearBackups,
    getBackups,
    restoreBackup,

    // 工具函數
    // Utilities
    hasPendingChanges: () => state.pendingChanges,
    isAutoSaveEnabled: () => state.enabled,
  }
}

/**
 * 使用自動儲存的替代 Hook - 更簡單的 API
 * Simplified auto save hook
 */
export function useSimpleAutoSave(
  content: string,
  onSave: (content: string) => Promise<void>,
  interval: number = 2000
) {
  const {
    updateContent,
    saveNow,
    state,
    restoreFromLocalStorage,
  } = useAutoSave({
    interval,
    onSave,
    initialContent: content,
  })

  useEffect(() => {
    updateContent(content)
  }, [content, updateContent])

  return {
    isSaving: state.saveInProgress,
    lastSavedAt: state.lastSavedAt,
    hasPendingChanges: state.pendingChanges,
    saveNow,
    restoreFromLocalStorage,
  }
}
