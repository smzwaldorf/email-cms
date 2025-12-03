/**
 * SimpleEditor Component
 * A fully working TipTap editor with commonly used extensions
 * Supports markdown, formatting, lists, headings, images, and more
 */

import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import StarterKit from '@tiptap/starter-kit'
import { TipTapImageNode } from './extensions/TipTapImageNode'
import { TipTapYoutubeNode } from '@/adapters/TipTapYoutubeNode'
import { TipTapAudioNode } from '@/adapters/TipTapAudioNode'
import { PasteDropHandler } from './extensions/PasteDropHandler'
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
import { useMediaUpload } from '@/hooks/useMediaUpload'

import { EditorToolbar } from './toolbar'
import './styles/editor.css'

interface SimpleEditorProps {
  content?: string // Can be TipTap JSON string or HTML
  contentType?: 'html' | 'json' // Specify content format
  onChange?: (content: string, format: 'html') => void // Always output HTML
  placeholder?: string
  className?: string
  articleId?: string // Optional article ID for media associations
}

// Helper to sanitize content
const sanitizeContent = (content: string): string => {
  if (!content) return ''
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    
    // Process images
    const images = doc.querySelectorAll('img')
    images.forEach(img => {
      const src = img.getAttribute('src')
      if (src && src.startsWith('storage://')) {
        img.setAttribute('data-storage-src', src)
        img.setAttribute('src', '') // Keep src attribute but empty to trigger parseHTML
      }
    })
    
    // Process audio
    const audios = doc.querySelectorAll('audio')
    audios.forEach(audio => {
      const src = audio.getAttribute('src')
      if (src && src.startsWith('storage://')) {
        audio.setAttribute('data-storage-src', src)
        audio.setAttribute('src', '')
      }
    })
    
    // Process custom audio divs (if any)
    const audioDivs = doc.querySelectorAll('div[data-audio-node]')
    audioDivs.forEach(div => {
      const src = div.getAttribute('data-src')
      if (src && src.startsWith('storage://')) {
        div.setAttribute('data-storage-src', src)
        div.setAttribute('data-src', '')
      }
    })

    return doc.body.innerHTML
  } catch (e) {
    console.error('Failed to sanitize content:', e)
    return content
  }
}

export function SimpleEditor({
  content = '',
  contentType = 'html',
  onChange,
  placeholder = '輸入文章內容...',
  className = '',
  articleId,
  readOnly = false,
}: SimpleEditorProps & { readOnly?: boolean }) {
  const { uploadFiles } = useMediaUpload()

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
    // Sanitize HTML content to prevent browser from trying to load storage:// URLs
    initialContent = typeof content === 'string' ? sanitizeContent(content) : content
  }

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        link: false, // Disable Link from StarterKit to avoid duplication
      }),
      TipTapImageNode.configure({
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
      TipTapYoutubeNode,
      TipTapAudioNode,
      Placeholder.configure({
        placeholder: readOnly ? undefined : placeholder,
      }),
      // Add paste and drop handler for automatic media upload
      PasteDropHandler.configure({
        uploadFiles,
        articleId,
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      // Always call onChange when content updates
      // autoSave flag is for external auto-save behavior, not for internal onChange
      onChange?.(editor.getHTML(), 'html')
    },
  })

  // Update editor editable state when readOnly prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  // Update editor content when content prop changes
  const contentRef = useRef(content)

  useEffect(() => {
    if (editor && content !== undefined) {
      // Check if content is actually different to avoid cursor jumps and loops
      const currentContent = editor.getHTML()
      if (currentContent !== content && contentRef.current !== content) {
        // For read-only, always update. For editable, only if different.
        // Note: This might still cause issues if Tiptap normalizes HTML differently than input
        // But for switching articles (major change), it's necessary.
        const sanitizedContent = typeof content === 'string' ? sanitizeContent(content) : content
        // Use a microtask to defer the setContent call to avoid flushSync warning
        Promise.resolve().then(() => {
          if (editor) {
            editor.commands.setContent(sanitizedContent)
            contentRef.current = content
          }
        })
      }
    }
  }, [editor, content])

  return (
    <div className={`tiptap-editor ${readOnly ? 'read-only' : ''} ${className}`}>
      {editor && !readOnly && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} className="editor-content" />
    </div>
  )
}
