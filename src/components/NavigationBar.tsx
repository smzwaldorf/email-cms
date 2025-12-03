/**
 * 組件 - 導航欄
 * 提供文章導航功能（前後切換）和位置指示
 *
 * 鍵盤快捷鍵支援 (T052):
 * 上一篇文章:
 *   - 左箭頭鍵 (ArrowLeft)
 *   - p 鍵
 *   - k 鍵
 *
 * 下一篇文章:
 *   - 右箭頭鍵 (ArrowRight)
 *   - n 鍵
 *   - j 鍵
 *
 * 編輯當前文章:
 *   - e 鍵
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPositionText } from '@/types'
import { NavigationState } from '@/types'

interface NavigationBarProps {
  navigationState: NavigationState
  onPrevious: () => void
  onNext: () => void
  disabled?: boolean
}

export function NavigationBar({
  navigationState,
  onPrevious,
  onNext,
  disabled = false,
}: NavigationBarProps) {
  const navigate = useNavigate()
  const canGoPrevious = navigationState.currentArticleOrder > 1
  const canGoNext = navigationState.currentArticleOrder < navigationState.totalArticlesInWeek

  // Handle keyboard shortcuts (T052: 鍵盤快捷鍵支援)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return

      const key = event.key.toLowerCase()

      // 上一篇文章: ArrowLeft, p, k
      if ((event.key === 'ArrowLeft' || key === 'p' || key === 'k') && canGoPrevious) {
        event.preventDefault()
        onPrevious()
      }
      // 下一篇文章: ArrowRight, n, j
      else if ((event.key === 'ArrowRight' || key === 'n' || key === 'j') && canGoNext) {
        event.preventDefault()
        onNext()
      }
      // 編輯當前文章: e - Navigate to editor
      else if (key === 'e') {
        event.preventDefault()
        navigate(`/editor/${navigationState.currentWeekNumber}`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [canGoPrevious, canGoNext, onPrevious, onNext, navigationState, navigate, disabled])

  return (
    <div className="border-t border-waldorf-cream-200 bg-waldorf-cream-50 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* 上一篇按鈕 */}
        <button
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className={`
            px-4 py-2 rounded-lg font-medium transition-colors
            ${
              canGoPrevious
                ? 'bg-waldorf-peach-100 text-waldorf-clay-800 hover:bg-waldorf-peach-200 active:bg-waldorf-peach-300'
                : 'bg-waldorf-cream-100 text-waldorf-clay-400 cursor-not-allowed'
            }
          `}
        >
          ← 上一篇
        </button>

        {/* 位置指示 */}
        <div className="text-center">
          <p className="text-sm font-medium text-waldorf-clay-800">
            {getPositionText(navigationState)}
          </p>
          <div className="mt-2 flex gap-1 justify-center">
            {Array.from({ length: navigationState.totalArticlesInWeek }).map(
              (_, index) => (
                <div
                  key={index}
                  className={`
                    h-2 w-2 rounded-full transition-colors
                    ${
                      index + 1 === navigationState.currentArticleOrder
                        ? 'bg-waldorf-sage-500'
                        : 'bg-waldorf-cream-300'
                    }
                  `}
                />
              )
            )}
          </div>
        </div>

        {/* 下一篇按鈕 */}
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className={`
            px-4 py-2 rounded-lg font-medium transition-colors
            ${
              canGoNext
                ? 'bg-waldorf-peach-100 text-waldorf-clay-800 hover:bg-waldorf-peach-200 active:bg-waldorf-peach-300'
                : 'bg-waldorf-cream-100 text-waldorf-clay-400 cursor-not-allowed'
            }
          `}
        >
          下一篇 →
        </button>
      </div>
    </div>
  )
}
