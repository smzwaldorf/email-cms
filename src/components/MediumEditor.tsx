/**
 * MediumEditor React Wrapper Component
 * A React wrapper for the medium-editor library
 */

import { useEffect, useRef } from 'react'
import MediumEditorLib from 'medium-editor'
import 'medium-editor/dist/css/medium-editor.css'
import 'medium-editor/dist/css/themes/default.css'
import './MediumEditor.css'

interface MediumEditorProps {
  /** The HTML content to display and edit */
  text: string
  /** Callback when content changes */
  onChange: (content: string) => void
  /** Editor options */
  options?: MediumEditorLib.CoreOptions
  /** Additional CSS class name */
  className?: string
  /** Placeholder text */
  placeholder?: string
}

export function MediumEditor({
  text,
  onChange,
  options = {},
  className = '',
  placeholder = 'Write your content here...',
}: MediumEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const mediumInstanceRef = useRef<MediumEditorLib.MediumEditor | null>(null)

  useEffect(() => {
    if (!editorRef.current) return

    // Initialize medium-editor
    const defaultOptions: MediumEditorLib.CoreOptions = {
      toolbar: {
        buttons: [
          'bold',
          'italic',
          'underline',
          'anchor',
          'h2',
          'h3',
          'quote',
          'unorderedlist',
          'orderedlist',
        ],
      },
      placeholder: {
        text: placeholder,
        hideOnClick: true,
      },
      ...options,
    }

    mediumInstanceRef.current = new MediumEditorLib(
      editorRef.current,
      defaultOptions
    )

    // Set initial content
    if (editorRef.current && text !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = text
    }

    // Add event listener for content changes
    const handleInput = () => {
      if (editorRef.current) {
        const content = editorRef.current.innerHTML
        onChange(content)
      }
    }

    editorRef.current.addEventListener('input', handleInput)
    const currentRef = editorRef.current

    // Cleanup
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('input', handleInput)
      }
      if (mediumInstanceRef.current) {
        mediumInstanceRef.current.destroy()
      }
    }
  }, []) // Only run on mount

  // Update content when text prop changes externally
  useEffect(() => {
    if (
      editorRef.current &&
      text !== editorRef.current.innerHTML &&
      document.activeElement !== editorRef.current
    ) {
      editorRef.current.innerHTML = text
    }
  }, [text])

  return (
    <div
      ref={editorRef}
      className={`medium-editor-content ${className}`}
      style={{
        minHeight: '500px',
        maxHeight: '600px',
        overflowY: 'auto',
        padding: '1.25rem',
        backgroundColor: 'white',
        outline: 'none',
      }}
    />
  )
}
