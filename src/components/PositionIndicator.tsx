/**
 * 元件 - 位置指示器
 * 顯示當前文章在整週文章中的位置（例如：第 5 篇，共 10 篇）
 */

import { PositionIndicatorProps } from '@/types'

export function PositionIndicator({
  currentPosition,
  totalArticles,
}: PositionIndicatorProps) {
  // 計算進度百分比
  const progressPercent = Math.round(
    (currentPosition / totalArticles) * 100
  )

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      {/* 位置文字 */}
      <div className="text-sm font-medium text-gray-700">
        第 <span className="font-bold text-blue-600">{currentPosition}</span>{' '}
        篇，共 <span className="font-bold text-gray-900">{totalArticles}</span> 篇
      </div>

      {/* 進度條 */}
      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 進度百分比 */}
      <div className="text-xs text-gray-500">{progressPercent}%</div>
    </div>
  )
}
