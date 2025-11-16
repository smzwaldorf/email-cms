/**
 * 組件 - 側邊按鈕
 * 在畫面邊緣顯示快速導航按鈕
 */

import { memo, useState, useCallback } from 'react'

interface SideButtonProps {
  direction: 'left' | 'right'
  onClick: () => void
  disabled?: boolean
  label?: string
}

export const SideButton = memo(function SideButton({
  direction,
  onClick,
  disabled = false,
  label,
}: SideButtonProps) {
  const isLeft = direction === 'left'
  const [isClicked, setIsClicked] = useState(false)

  // Memoize onClick handler for quick response
  const handleClick = useCallback(() => {
    if (disabled) return

    // Visual feedback: show pressed state
    setIsClicked(true)
    onClick()

    // Reset pressed state after animation
    setTimeout(() => {
      setIsClicked(false)
    }, 150)
  }, [onClick, disabled])

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        fixed top-1/2 -translate-y-1/2 p-3 rounded-lg
        transition-all duration-150 active:scale-95
        ${
          isLeft
            ? 'left-4 hover:left-6'
            : 'right-4 hover:right-6'
        }
        ${
          disabled
            ? 'bg-waldorf-cream-200 text-waldorf-clay-400 cursor-not-allowed opacity-50'
            : `bg-waldorf-sage-500 text-white hover:bg-waldorf-sage-600 shadow-lg ${
                isClicked ? 'scale-95 bg-waldorf-sage-700' : ''
              }`
        }
      `}
      title={label}
    >
      {isLeft ? (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      ) : (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      )}
    </button>
  )
})
