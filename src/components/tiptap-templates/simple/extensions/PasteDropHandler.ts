/**
 * PasteDropHandler Extension
 * Handles paste and drop events for images and files
 * Automatically uploads them to storage and inserts storage:// URLs
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

export interface PasteDropHandlerOptions {
  uploadFiles?: (files: File[], articleId?: string) => Promise<any[]>
  articleId?: string
  maxFileSize?: number // in bytes, default 10MB
  allowedMimeTypes?: string[]
}

export const PasteDropHandler = Extension.create<PasteDropHandlerOptions>({
  name: 'pasteDropHandler',

  addOptions() {
    return {
      uploadFiles: undefined,
      articleId: undefined,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
      ],
    }
  },

  addProseMirrorPlugins() {
    const { uploadFiles, articleId, maxFileSize, allowedMimeTypes } = this.options
    const editor = this.editor

    return [
      new Plugin({
        key: new PluginKey('pasteDropHandler'),
        props: {
          handlePaste: (_view: EditorView, event: ClipboardEvent) => {
            const items = event.clipboardData?.items
            if (!items) return false

            const files: File[] = []
            let hasMedia = false

            for (let i = 0; i < items.length; i++) {
              const item = items[i]

              if (item.kind === 'file') {
                const file = item.getAsFile()
                if (file) {
                  hasMedia = true

                  // Validate file
                  if (!validateFile(file, maxFileSize, allowedMimeTypes)) {
                    console.warn(`File rejected: ${file.name}`)
                    continue
                  }

                  files.push(file)
                }
              }
            }

            // If we found media files, handle the upload
            if (hasMedia && files.length > 0 && uploadFiles) {
              event.preventDefault()
              handleUpload(files, editor, uploadFiles, articleId)
              return true
            }

            return false
          },
          handleDOMEvents: {
            drop: (view: EditorView, event: DragEvent) => {
              const dataTransfer = event.dataTransfer
              if (!dataTransfer) return false

              const files: File[] = []
              let hasMedia = false

              // Check for files in the drag data
              if (dataTransfer.items) {
                for (let i = 0; i < dataTransfer.items.length; i++) {
                  if (dataTransfer.items[i].kind === 'file') {
                    const file = dataTransfer.items[i].getAsFile()
                    if (file) {
                      hasMedia = true

                      // Validate file
                      if (!validateFile(file, maxFileSize, allowedMimeTypes)) {
                        console.warn(`File rejected: ${file.name}`)
                        continue
                      }

                      files.push(file)
                    }
                  }
                }
              } else if (dataTransfer.files) {
                // Fallback for older browsers
                for (let i = 0; i < dataTransfer.files.length; i++) {
                  const file = dataTransfer.files[i]
                  hasMedia = true

                  if (!validateFile(file, maxFileSize, allowedMimeTypes)) {
                    console.warn(`File rejected: ${file.name}`)
                    continue
                  }

                  files.push(file)
                }
              }

              // If we found media files, handle the upload
              if (hasMedia && files.length > 0 && uploadFiles) {
                event.preventDefault()
                event.stopPropagation()

                // Get drop position
                const coords = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                })

                if (coords) {
                  // Focus at drop position before uploading
                  const tr = view.state.tr.setSelection(
                    Selection.near(view.state.doc.resolve(coords.pos))
                  )
                  view.dispatch(tr)
                }

                handleUpload(files, editor, uploadFiles, articleId)
                return true
              }

              return false
            },
          },
        },
      }),
    ]
  },
})

/**
 * Validate a file based on size and type
 */
function validateFile(
  file: File,
  maxFileSize: number = 10 * 1024 * 1024,
  allowedMimeTypes: string[] = []
): boolean {
  // Check file size
  if (file.size > maxFileSize) {
    console.warn(`File too large: ${file.name} (${file.size} bytes)`)
    return false
  }

  // Check MIME type if list provided
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
    console.warn(`File type not allowed: ${file.name} (${file.type})`)
    return false
  }

  return true
}

/**
 * Handle file upload and insert into editor
 */
async function handleUpload(
  files: File[],
  editor: Editor,
  uploadFiles: (files: File[], articleId?: string) => Promise<any[]>,
  articleId?: string
) {
  try {
    // Focus editor before upload
    editor.chain().focus().run()

    // Upload files
    const uploadedFiles = await uploadFiles(files, articleId)

    // Insert each uploaded file into the editor
    uploadedFiles.forEach((file: any) => {
      const src = file.storageUrl || file.publicUrl
      if (!src) return

      if (file.mediaType === 'image') {
        try {
          ;(editor.chain() as any)
            .focus()
            .setImage({
              src,
              alt: file.fileName,
              title: file.fileName,
            })
            .run()
        } catch (e) {
          console.warn('Failed to insert image:', e)
        }
      } else if (file.mediaType === 'audio') {
        // Insert audio - check if there's an audio node type
        // For now, we'll insert it as a custom node if available
        try {
          ;(editor.chain() as any)
            .focus()
            .insertContent({
              type: 'audioNode',
              attrs: {
                src,
              },
            })
            .run()
        } catch (e) {
          console.warn('Audio node not available, skipping audio insert')
        }
      }
    })
  } catch (error) {
    console.error('Upload failed:', error)
    // Optionally show error to user via a toast or similar
  }
}
