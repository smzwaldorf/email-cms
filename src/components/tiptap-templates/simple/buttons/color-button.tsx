/**
 * ColorButton Component
 * Button for changing text color
 */

import { Editor } from '@tiptap/react'
import { Palette, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface ColorButtonProps {
  editor: Editor
}

const COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Green', value: '#008000' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Orange', value: '#FF8C00' },
  { name: 'Purple', value: '#800080' },
  { name: 'Gray', value: '#808080' },
]

export function ColorButton({ editor }: ColorButtonProps) {
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

  // Get current text color
  const getCurrentColor = () => {
    const marks = editor.state.selection.$anchor.marks()
    for (const mark of marks) {
      if (mark.type.name === 'textStyle' && mark.attrs.color) {
        return mark.attrs.color
      }
    }
    return '#000000' // Default to black if no color set
  }

  const currentColor = getCurrentColor()

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="toolbar-button flex items-center gap-1"
        title={`Text Color: ${currentColor}`}
        type="button"
      >
        <Palette size={18} />
        <div
          className="w-4 h-4 rounded border border-waldorf-clay-400"
          style={{ backgroundColor: currentColor }}
          title={currentColor}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-waldorf-cream-300 rounded-md shadow-lg z-10 p-2 min-w-max">
          <div className="grid grid-cols-4 gap-2">
            {COLORS.map((color) => {
              const isActive = currentColor.toLowerCase() === color.value.toLowerCase()

              return (
                <button
                  key={color.value}
                  onClick={() => {
                    editor.chain().focus().setColor(color.value).run()
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
                editor.chain().focus().unsetColor().run()
                setIsOpen(false)
              }}
              className={`w-8 h-8 rounded border-2 flex items-center justify-center transition-colors ${
                currentColor.toLowerCase() === '#000000'
                  ? 'border-waldorf-sage-600 ring-2 ring-waldorf-sage-400 text-waldorf-sage-600'
                  : 'border-waldorf-cream-300 hover:border-red-600 text-red-600'
              }`}
              title="Default Color"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
