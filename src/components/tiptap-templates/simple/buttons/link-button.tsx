/**
 * LinkButton Component
 * Button for adding/editing links with a popup dialog
 */

import { Editor } from '@tiptap/react'
import { Link2, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface LinkButtonProps {
  editor: Editor
}

export function LinkButton({ editor }: LinkButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [url, setUrl] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSetLink = () => {
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run()
    }
    setUrl('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSetLink()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => {
          setUrl(editor.getAttributes('link').href || '')
          setIsOpen(!isOpen)
        }}
        className={`toolbar-button ${
          editor.isActive('link') ? 'active' : ''
        }`}
        title="Add Link"
        type="button"
      >
        <Link2 size={18} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-waldorf-cream-300 rounded-md shadow-lg z-10 p-3 min-w-max">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className="px-2 py-1 border border-waldorf-cream-300 rounded text-sm w-48 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-500"
            />
            <button
              onClick={handleSetLink}
              className="px-3 py-1 bg-waldorf-sage-600 text-white rounded text-sm hover:bg-waldorf-sage-700"
              type="button"
            >
              Set
            </button>
            {editor.isActive('link') && (
              <button
                onClick={() => {
                  editor.chain().focus().unsetLink().run()
                  setIsOpen(false)
                }}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                type="button"
                title="Remove Link"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
