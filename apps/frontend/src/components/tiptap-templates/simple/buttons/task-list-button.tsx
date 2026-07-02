/**
 * TaskListButton Component
 * Button for toggling task list
 */

import { Editor } from '@tiptap/react'
import { CheckSquare } from 'lucide-react'

interface TaskListButtonProps {
  editor: Editor
}

export function TaskListButton({ editor }: TaskListButtonProps) {
  const handleClick = () => {
    // If task list is already active, toggle it off
    if (editor.isActive('taskList')) {
      editor.chain().focus().toggleTaskList().run()
    } else {
      // If bullet list is active, turn it off first (make task list exclusive)
      if (editor.isActive('bulletList')) {
        editor.chain().focus().toggleBulletList().run()
      }
      // Then activate task list
      editor.chain().focus().toggleTaskList().run()
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`toolbar-button ${editor.isActive('taskList') ? 'active' : ''}`}
      title="Task List"
      type="button"
    >
      <CheckSquare size={18} />
    </button>
  )
}
