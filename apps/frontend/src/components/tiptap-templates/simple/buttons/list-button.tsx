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
  const handleClick = () => {
    // If bullet list is already active, toggle it off
    if (editor.isActive('bulletList')) {
      editor.chain().focus().toggleBulletList().run()
    } else {
      // If task list is active, turn it off first (make bullet list exclusive)
      if (editor.isActive('taskList')) {
        editor.chain().focus().toggleTaskList().run()
      }
      // Then activate bullet list
      editor.chain().focus().toggleBulletList().run()
    }
  }

  return (
    <button
      onClick={handleClick}
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
