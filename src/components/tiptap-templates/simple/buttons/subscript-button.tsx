/**
 * SubscriptButton Component
 * Button for applying subscript formatting
 */

import { Editor } from '@tiptap/react'
import { Subscript } from 'lucide-react'

interface SubscriptButtonProps {
  editor: Editor
}

export function SubscriptButton({ editor }: SubscriptButtonProps) {
  return (
    <button
      onClick={() => editor.chain().focus().toggleSubscript().run()}
      disabled={!editor.can().toggleSubscript()}
      className={`toolbar-button ${editor.isActive('subscript') ? 'active' : ''}`}
      title="Subscript"
      type="button"
    >
      <Subscript size={18} />
    </button>
  )
}
