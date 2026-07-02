/**
 * MarkButton Component
 * Button for toggling text marks (bold, italic, etc.)
 */

import { Editor } from '@tiptap/react'
import { ReactNode } from 'react'

interface MarkButtonProps {
  editor: Editor
  mark: string
  icon: ReactNode
  title: string
}

export function MarkButton({ editor, mark, icon, title }: MarkButtonProps) {
  const handleClick = () => {
    if (mark === 'bold') {
      editor.chain().focus().toggleBold().run()
    } else if (mark === 'italic') {
      editor.chain().focus().toggleItalic().run()
    } else if (mark === 'underline') {
      editor.chain().focus().toggleUnderline().run()
    } else if (mark === 'code') {
      editor.chain().focus().toggleCode().run()
    } else if (mark === 'highlight') {
      editor.chain().focus().toggleHighlight().run()
    } else if (mark === 'strikethrough') {
      editor.chain().focus().toggleStrike().run()
    }
  }

  const isActive = editor.isActive(mark)

  return (
    <button
      onClick={handleClick}
      className={`toolbar-button ${isActive ? 'active' : ''}`}
      title={title}
      type="button"
    >
      {icon}
    </button>
  )
}
