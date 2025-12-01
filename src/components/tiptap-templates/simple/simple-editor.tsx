/**
 * SimpleEditor Component
 * A fully working TipTap editor with commonly used extensions
 * Supports markdown, formatting, lists, headings, images, and more
 */

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Placeholder from '@tiptap/extension-placeholder'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

import { EditorToolbar } from './toolbar'
import './styles/editor.css'

interface SimpleEditorProps {
  content?: string // Can be TipTap JSON string or HTML
  contentType?: 'html' | 'json' // Specify content format
  onChange?: (content: string, format: 'html') => void // Always output HTML
  placeholder?: string
  className?: string
}

export function SimpleEditor({
  content = '',
  contentType = 'html',
  onChange,
  placeholder = '輸入文章內容...',
  className = '',
}: SimpleEditorProps) {
  // Parse content based on type
  let initialContent: any = ''
  if (contentType === 'json' && content) {
    try {
      initialContent = JSON.parse(content)
      // Validate it's a proper TipTap document
      if (!initialContent || typeof initialContent !== 'object' || initialContent.type !== 'doc') {
        console.warn('Invalid TipTap document, using empty content')
        initialContent = {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        }
      }
    } catch (error) {
      console.error('Failed to parse TipTap JSON content:', error)
      // Fallback to empty document if JSON is invalid
      initialContent = {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      }
    }
  } else {
    initialContent = content
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false, // Disable Link from StarterKit to avoid duplication
      }),
      Image.configure({
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TextStyle,
      Color,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Superscript,
      Subscript,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      // Always call onChange when content updates
      // autoSave flag is for external auto-save behavior, not for internal onChange
      onChange?.(editor.getHTML(), 'html')
    },
  })

  return (
    <div className={`tiptap-editor ${className}`}>
      {editor && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} className="editor-content" />
    </div>
  )
}
