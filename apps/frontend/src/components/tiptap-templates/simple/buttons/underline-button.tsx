/**
 * UnderlineButton Component
 * Button for applying underline formatting
 */

import { Editor } from '@tiptap/react'
import { Underline } from 'lucide-react'

interface UnderlineButtonProps {
  editor: Editor
}

export function UnderlineButton({ editor }: UnderlineButtonProps) {
  return (
    <button
      onClick={() => editor.chain().focus().toggleUnderline().run()}
      disabled={!editor.can().toggleUnderline()}
      className={`toolbar-button ${editor.isActive('underline') ? 'active' : ''}`}
      title="Underline"
      type="button"
    >
      <Underline size={18} />
    </button>
  )
}
