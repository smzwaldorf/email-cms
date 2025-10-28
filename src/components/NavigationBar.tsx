/**
 * 組件 - 導航欄
 * 提供文章導航功能（前後切換）和位置指示
 */

import { getPositionText } from '@/types'
import { NavigationState } from '@/types'

interface NavigationBarProps {
  navigationState: NavigationState
  onPrevious: () => void
  onNext: () => void
}

export function NavigationBar({
  navigationState,
  onPrevious,
  onNext,
}: NavigationBarProps) {
  const canGoPrevious = navigationState.currentArticleOrder > 1
  const canGoNext = navigationState.currentArticleOrder < navigationState.totalArticlesInWeek

  return (
    <div className="border-t border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        {/* 上一篇按鈕 */}
        <button
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className={`
            px-4 py-2 rounded-lg font-medium transition-colors
            ${
              canGoPrevious
                ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          ← 上一篇
        </button>

        {/* 位置指示 */}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900">
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
                        ? 'bg-blue-500'
                        : 'bg-gray-300'
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
                ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          下一篇 →
        </button>
      </div>
    </div>
  )
}
