/**
 * BlockquoteButton Component
 * Button for toggling blockquote
 */

import { Editor } from '@tiptap/react'
import { Quote } from 'lucide-react'

interface BlockquoteButtonProps {
  editor: Editor
}

export function BlockquoteButton({ editor }: BlockquoteButtonProps) {
  return (
    <button
      onClick={() => editor.chain().focus().toggleBlockquote().run()}
      className={`toolbar-button ${editor.isActive('blockquote') ? 'active' : ''}`}
      title="Blockquote"
      type="button"
    >
      <Quote size={18} />
    </button>
  )
}
