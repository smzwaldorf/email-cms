/**
 * HeadingButton Component
 * Dropdown button for selecting heading levels
 */

import { Editor } from '@tiptap/react'
import { Heading, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface HeadingButtonProps {
  editor: Editor
}

export function HeadingButton({ editor }: HeadingButtonProps) {
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

  type HeadingLevel = 1 | 2 | 3

  const headings: Array<{ level?: HeadingLevel; label: string }> = [
    { level: 1, label: 'H1' },
    { level: 2, label: 'H2' },
    { level: 3, label: 'H3' },
    { label: 'Paragraph' },
  ]

  const handleHeadingClick = (heading: { level?: HeadingLevel; label: string }) => {
    if (heading.level !== undefined) {
      editor.chain().focus().toggleHeading({ level: heading.level }).run()
    } else {
      editor.chain().focus().setParagraph().run()
    }
    setIsOpen(false)
  }

  // Get current heading level or check if paragraph
  const getCurrentHeading = () => {
    if (editor.isActive('heading', { level: 1 })) return 'H1'
    if (editor.isActive('heading', { level: 2 })) return 'H2'
    if (editor.isActive('heading', { level: 3 })) return 'H3'
    return 'Text'
  }

  const currentHeading = getCurrentHeading()

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="toolbar-button flex items-center gap-1"
        title={`Current: ${currentHeading}`}
        type="button"
      >
        <Heading size={18} />
        <span className="text-xs font-medium">{currentHeading}</span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-waldorf-cream-300 rounded-md shadow-lg z-10 min-w-max">
          {headings.map((heading, index) => {
            const isActive = heading.level
              ? editor.isActive('heading', { level: heading.level })
              : editor.isActive('paragraph')

            return (
              <button
                key={index}
                onClick={() => handleHeadingClick(heading)}
                className={`w-full text-left px-4 py-2 text-sm ${
                  isActive
                    ? 'bg-waldorf-sage-100 font-semibold text-waldorf-sage-900'
                    : 'hover:bg-waldorf-sage-50'
                }`}
              >
                {heading.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
