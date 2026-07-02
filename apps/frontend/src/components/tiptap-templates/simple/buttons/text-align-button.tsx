/**
 * TextAlignButton Component
 * Dropdown button for text alignment (left, center, right, justify)
 */

import { Editor } from '@tiptap/react'
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface TextAlignButtonProps {
  editor: Editor
}

const ALIGNMENTS = [
  { value: 'left', icon: <AlignLeft size={18} />, title: 'Align Left' },
  { value: 'center', icon: <AlignCenter size={18} />, title: 'Align Center' },
  { value: 'right', icon: <AlignRight size={18} />, title: 'Align Right' },
  { value: 'justify', icon: <AlignJustify size={18} />, title: 'Justify' },
]

export function TextAlignButton({ editor }: TextAlignButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Get current alignment
  const getCurrentAlign = () => {
    if (editor.isActive({ textAlign: 'center' })) return 'center'
    if (editor.isActive({ textAlign: 'right' })) return 'right'
    if (editor.isActive({ textAlign: 'justify' })) return 'justify'
    return 'left'
  }

  const currentAlign = getCurrentAlign()
  const currentIcon = ALIGNMENTS.find((a) => a.value === currentAlign)?.icon

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`toolbar-button ${
          currentAlign !== 'left' ? 'active' : ''
        }`}
        title={`Text Alignment: ${currentAlign}`}
        type="button"
      >
        {currentIcon}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-waldorf-cream-300 rounded-md shadow-lg z-10 min-w-max">
          {ALIGNMENTS.map((align) => {
            const isActive = editor.isActive({ textAlign: align.value })

            return (
              <button
                key={align.value}
                onClick={() => {
                  editor.chain().focus().setTextAlign(align.value).run()
                  setIsOpen(false)
                }}
                className={`w-full flex items-center justify-center px-4 py-2 text-sm ${
                  isActive
                    ? 'bg-waldorf-sage-100 font-semibold text-waldorf-sage-900'
                    : 'hover:bg-waldorf-sage-50'
                }`}
                title={align.title}
                type="button"
              >
                {align.icon}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
