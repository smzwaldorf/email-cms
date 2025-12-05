/**
 * HighlightButton Component
 * Button for applying highlight color
 */

import { Editor } from '@tiptap/react'
import { Highlighter } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface HighlightButtonProps {
  editor: Editor
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#ffd700' },
  { name: 'Green', value: '#90EE90' },
  { name: 'Blue', value: '#87CEEB' },
  { name: 'Pink', value: '#FFB6C1' },
  { name: 'Orange', value: '#FFA500' },
]

export function HighlightButton({ editor }: HighlightButtonProps) {
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

  // Get current highlight color
  const getCurrentHighlight = () => {
    const marks = editor.state.selection.$anchor.marks()
    for (const mark of marks) {
      if (mark.type.name === 'highlight' && mark.attrs.color) {
        return mark.attrs.color
      }
    }
    return null
  }

  const currentHighlight = getCurrentHighlight()

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`toolbar-button ${currentHighlight ? 'active' : ''}`}
        title="Highlight Color"
        type="button"
      >
        <Highlighter size={18} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-waldorf-cream-300 rounded-md shadow-lg z-10 p-2 min-w-max">
          <div className="grid grid-cols-3 gap-2">
            {HIGHLIGHT_COLORS.map((color) => {
              const isActive = currentHighlight?.toLowerCase() === color.value.toLowerCase()

              return (
                <button
                  key={color.value}
                  onClick={() => {
                    editor.chain().focus().toggleHighlight({ color: color.value }).run()
                    setIsOpen(false)
                  }}
                  className={`w-8 h-8 rounded border-2 transition-colors ${
                    isActive
                      ? 'border-waldorf-sage-600 ring-2 ring-waldorf-sage-400'
                      : 'border-waldorf-cream-300 hover:border-waldorf-sage-600'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                  type="button"
                />
              )
            })}
            <button
              onClick={() => {
                editor.chain().focus().toggleHighlight().run()
                setIsOpen(false)
              }}
              className="col-span-3 text-left px-2 py-1 text-sm hover:bg-waldorf-sage-50 rounded"
              title="Clear Highlight"
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
