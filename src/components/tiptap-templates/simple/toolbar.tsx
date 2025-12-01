/**
 * EditorToolbar Component
 * Toolbar with formatting, list, heading, and other editing tools
 */

import { useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  Code,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Highlighter,
} from 'lucide-react'
import { MarkButton } from './buttons/mark-button'
import { HeadingButton } from './buttons/heading-button'
import { ListButton } from './buttons/list-button'
import { LinkButton } from './buttons/link-button'
import { ImageButton } from './buttons/image-button'
import { ColorButton } from './buttons/color-button'

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
      <div className="toolbar-group">
        {/* Undo/Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
          className="toolbar-button"
        >
          <Undo size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
          className="toolbar-button"
        >
          <Redo size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Text Formatting */}
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
          mark="underline"
          icon={<Underline size={18} />}
          title="Underline"
        />
        <MarkButton
          editor={editor}
          mark="code"
          icon={<Code size={18} />}
          title="Inline Code"
        />
      </div>

      <div className="toolbar-divider" />

      {/* Headings */}
      <div className="toolbar-group">
        <HeadingButton editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* Highlights & Color */}
      <div className="toolbar-group">
        <MarkButton
          editor={editor}
          mark="highlight"
          icon={<Highlighter size={18} />}
          title="Highlight"
        />
        <ColorButton editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* Lists */}
      <div className="toolbar-group">
        <ListButton editor={editor} />
        <button
          onClick={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          className={`toolbar-button ${
            editor.isActive('orderedList') ? 'active' : ''
          }`}
          title="Ordered List"
        >
          <ListOrdered size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Block Elements */}
      <div className="toolbar-group">
        <button
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleCodeBlock()
              .run()
          }
          className={`toolbar-button ${
            editor.isActive('codeBlock') ? 'active' : ''
          }`}
          title="Code Block"
        >
          <Code size={18} />
        </button>
        <button
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBlockquote()
              .run()
          }
          className={`toolbar-button ${
            editor.isActive('blockquote') ? 'active' : ''
          }`}
          title="Block Quote"
        >
          <Quote size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Links & Media */}
      <div className="toolbar-group">
        <LinkButton editor={editor} />
        <ImageButton editor={editor} />
      </div>
    </div>
  )
}
