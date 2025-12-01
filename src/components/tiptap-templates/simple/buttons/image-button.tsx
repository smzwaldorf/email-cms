/**
 * ImageButton Component
 * Button for uploading and inserting images
 */

import { Editor } from '@tiptap/react'
import { Image as ImageIcon } from 'lucide-react'
import { useRef } from 'react'

interface ImageButtonProps {
  editor: Editor
}

export function ImageButton({ editor }: ImageButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      editor
        .chain()
        .focus()
        .setImage({ src: base64, alt: file.name })
        .run()
    }
    reader.readAsDataURL(file)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="toolbar-button"
        title="Insert Image"
        type="button"
      >
        <ImageIcon size={18} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </>
  )
}
