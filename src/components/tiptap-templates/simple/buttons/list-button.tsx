/**
 * ListButton Component
 * Button for toggling bullet lists
 */

import { Editor } from '@tiptap/react'
import { List } from 'lucide-react'

interface ListButtonProps {
  editor: Editor
}

export function ListButton({ editor }: ListButtonProps) {
  return (
    <button
      onClick={() => editor.chain().focus().toggleBulletList().run()}
      className={`toolbar-button ${
        editor.isActive('bulletList') ? 'active' : ''
      }`}
      title="Bullet List"
      type="button"
    >
      <List size={18} />
    </button>
  )
}
