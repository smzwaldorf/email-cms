
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

function SecureImageComponent({ node, updateAttributes, selected }: any) {
  const [src, setSrc] = useState(node.attrs.src)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const resolveUrl = async () => {
      const originalSrc = node.attrs.src
      if (!originalSrc || !originalSrc.startsWith('storage://')) {
        setSrc(originalSrc)
        return
      }

      setIsLoading(true)
      try {
        const pathWithoutProtocol = originalSrc.replace('storage://', '')
        const [bucket, ...pathParts] = pathWithoutProtocol.split('/')
        const path = pathParts.join('/')

        if (bucket && path) {
          const supabase = getSupabaseClient()
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 300)

          if (data?.signedUrl) {
            setSrc(data.signedUrl)
          } else {
            console.error('Failed to sign URL:', error)
          }
        }
      } catch (error) {
        console.error('Error resolving storage URL:', error)
      } finally {
        setIsLoading(false)
      }
    }

    resolveUrl()
  }, [node.attrs.src])

  return (
    <NodeViewWrapper className="secure-image-wrapper" style={{ display: 'inline-block', lineHeight: 0 }}>
      <div className={`relative ${selected ? 'ring-2 ring-waldorf-sage-500' : ''}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-waldorf-sage-500"></div>
          </div>
        )}
        <img
          src={src}
          alt={node.attrs.alt}
          title={node.attrs.title}
          className={`max-w-full h-auto rounded-md ${isLoading ? 'opacity-50' : ''}`}
        />
      </div>
    </NodeViewWrapper>
  )
}

export const SecureImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SecureImageComponent)
  },
})
