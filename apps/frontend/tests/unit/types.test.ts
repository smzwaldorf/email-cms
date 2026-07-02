/**
 * 測試 - 型別定義驗證
 */

import { describe, it, expect } from 'vitest'
import { getPositionText, hasNext, hasPrevious } from '@/types'
import { NavigationState } from '@/types'

describe('Type definitions and utilities', () => {
  const mockNavState: NavigationState = {
    currentWeekNumber: '2025-W43',
    currentArticleId: 'article-001',
    currentArticleOrder: 2,
    totalArticlesInWeek: 5,
    articleList: [],
    isLoading: false,
  }

  it('should format position text correctly', () => {
    const text = getPositionText(mockNavState)
    expect(text).toBe('第 2 篇，共 5 篇')
  })

  it('should determine if next article exists', () => {
    expect(hasNext(mockNavState)).toBe(true)

    const lastArticle = { ...mockNavState, currentArticleOrder: 5 }
    expect(hasNext(lastArticle)).toBe(false)
  })

  it('should determine if previous article exists', () => {
    expect(hasPrevious(mockNavState)).toBe(true)

    const firstArticle = { ...mockNavState, currentArticleOrder: 1 }
    expect(hasPrevious(firstArticle)).toBe(false)
  })
})
