/**
 * 組件 - 側邊按鈕
 * 在畫面邊緣顯示快速導航按鈕
 */

interface SideButtonProps {
  direction: 'left' | 'right'
  onClick: () => void
  disabled?: boolean
  label?: string
}

export function SideButton({
  direction,
  onClick,
  disabled = false,
  label,
}: SideButtonProps) {
  const isLeft = direction === 'left'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        fixed top-1/2 -translate-y-1/2 p-3 rounded-lg
        transition-all duration-200
        ${
          isLeft
            ? 'left-4 hover:left-6'
            : 'right-4 hover:right-6'
        }
        ${
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
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
}
