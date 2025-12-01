/**
 * InsertButton Component
 * Button for inserting images
 */

import { Editor } from '@tiptap/react'
import { Image as ImageIcon } from 'lucide-react'
import { useRef } from 'react'

interface InsertButtonProps {
  editor: Editor
}

export function InsertButton({ editor }: InsertButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const src = e.target?.result as string
        editor.chain().focus().setImage({ src }).run()
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="toolbar-button"
        title="Add Image"
        type="button"
      >
        <ImageIcon size={18} />
      </button>
    </>
  )
}
