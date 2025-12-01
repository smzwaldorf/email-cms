/**
 * EditorToolbar Component
 * Toolbar with formatting, list, heading, and other editing tools
 */

import { useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  ListOrdered,
  Undo,
  Redo,
} from 'lucide-react'
import { MarkButton } from './buttons/mark-button'
import { HeadingButton } from './buttons/heading-button'
import { ListButton } from './buttons/list-button'
import { TaskListButton } from './buttons/task-list-button'
import { BlockquoteButton } from './buttons/blockquote-button'
import { LinkButton } from './buttons/link-button'
import { TextAlignButton } from './buttons/text-align-button'
import { SuperscriptButton } from './buttons/superscript-button'
import { SubscriptButton } from './buttons/subscript-button'
import { UnderlineButton } from './buttons/underline-button'
import { HighlightButton } from './buttons/highlight-button'
import { InsertButton } from './buttons/insert-button'

interface EditorToolbarProps {
  editor: Editor
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  // Force re-render when editor state changes
  const [, setUpdateCount] = useState(0)

  useEffect(() => {
    // Update toolbar when editor content or selection changes
    const updateHandler = () => {
      setUpdateCount((prev) => prev + 1)
    }

    editor.on('update', updateHandler)
    editor.on('selectionUpdate', updateHandler)

    return () => {
      editor.off('update', updateHandler)
      editor.off('selectionUpdate', updateHandler)
    }
  }, [editor])

  return (
    <div className="toolbar">
      {/* 1. Undo/Redo */}
      <div className="toolbar-group">
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().undo().run()
          }}
          disabled={!editor.can().undo()}
          title="Undo"
          className="toolbar-button"
          type="button"
        >
          <Undo size={18} />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().redo().run()
          }}
          disabled={!editor.can().redo()}
          title="Redo"
          className="toolbar-button"
          type="button"
        >
          <Redo size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* 2. Heading */}
      <div className="toolbar-group">
        <HeadingButton editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* 3. Lists (Bullet & Numbered) */}
      <div className="toolbar-group">
        <ListButton editor={editor} />
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().toggleOrderedList().run()
          }}
          className={`toolbar-button ${editor.isActive('orderedList') ? 'active' : ''}`}
          title="Ordered List"
          type="button"
        >
          <ListOrdered size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* 4. Task List */}
      <div className="toolbar-group">
        <TaskListButton editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* 5. Blockquote */}
      <div className="toolbar-group">
        <BlockquoteButton editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* 6. Code Block */}
      <div className="toolbar-group">
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().toggleCodeBlock().run()
          }}
          className={`toolbar-button ${editor.isActive('codeBlock') ? 'active' : ''}`}
          title="Code Block"
          type="button"
        >
          <Code size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* 7. Bold, Italic, Strikethrough, Underline */}
      <div className="toolbar-group">
        <MarkButton
          editor={editor}
          mark="bold"
          icon={<Bold size={18} />}
          title="Bold"
        />
        <MarkButton
          editor={editor}
          mark="italic"
          icon={<Italic size={18} />}
          title="Italic"
        />
        <MarkButton
          editor={editor}
          mark="strike"
          icon={<Strikethrough size={18} />}
          title="Strikethrough"
        />
        <MarkButton
          editor={editor}
          mark="code"
          icon={<Code size={18} />}
          title="Inline Code"
        />
        <UnderlineButton editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* 8. Highlight */}
      <div className="toolbar-group">
        <HighlightButton editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* 9. Link */}
      <div className="toolbar-group">
        <LinkButton editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* 10. Subscript & Superscript */}
      <div className="toolbar-group">
        <SubscriptButton editor={editor} />
        <SuperscriptButton editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* 11. Text Alignment */}
      <div className="toolbar-group">
        <TextAlignButton editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* 12. Add Image */}
      <div className="toolbar-group">
        <InsertButton editor={editor} />
      </div>
    </div>
  )
}
