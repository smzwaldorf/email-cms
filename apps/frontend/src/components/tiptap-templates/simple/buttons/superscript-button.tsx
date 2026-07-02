/**
 * SuperscriptButton Component
 * Button for applying superscript formatting
 */

import { Editor } from '@tiptap/react'
import { Superscript } from 'lucide-react'

interface SuperscriptButtonProps {
  editor: Editor
}

export function SuperscriptButton({ editor }: SuperscriptButtonProps) {
  return (
    <button
      onClick={() => editor.chain().focus().toggleSuperscript().run()}
      disabled={!editor.can().toggleSuperscript()}
      className={`toolbar-button ${editor.isActive('superscript') ? 'active' : ''}`}
      title="Superscript"
      type="button"
    >
      <Superscript size={18} />
    </button>
  )
}
