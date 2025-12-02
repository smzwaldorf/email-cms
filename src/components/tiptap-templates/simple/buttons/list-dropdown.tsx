/**
 * ListDropdown Component
 * Dropdown button for selecting list types (Bullet, Numbered, Task)
 */

import { Editor } from '@tiptap/react'
import { List, ListOrdered, CheckSquare, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface ListDropdownProps {
  editor: Editor
}

export function ListDropdown({ editor }: ListDropdownProps) {
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

  const listTypes = [
    {
      label: 'Bullet List',
      icon: <List size={16} />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
    },
    {
      label: 'Numbered List',
      icon: <ListOrdered size={16} />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
    },
    {
      label: 'Task List',
      icon: <CheckSquare size={16} />,
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: () => editor.isActive('taskList'),
    },
  ]

  const getCurrentListIcon = () => {
    if (editor.isActive('orderedList')) return <ListOrdered size={18} />
    if (editor.isActive('taskList')) return <CheckSquare size={18} />
    return <List size={18} />
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`toolbar-button flex items-center gap-1 ${
          editor.isActive('bulletList') ||
          editor.isActive('orderedList') ||
          editor.isActive('taskList')
            ? 'active'
            : ''
        }`}
        title="Lists"
        type="button"
      >
        {getCurrentListIcon()}
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-waldorf-cream-300 rounded-md shadow-lg z-10 min-w-[160px] py-1">
          {listTypes.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                item.action()
                setIsOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                item.isActive()
                  ? 'bg-waldorf-sage-100 font-medium text-waldorf-sage-900'
                  : 'hover:bg-waldorf-sage-50 text-waldorf-clay-700'
              }`}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
