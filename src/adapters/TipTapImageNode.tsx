/**
 * TipTap 圖片節點適配器 - 自訂圖片節點實現
 * TipTap Image Node Adapter - Custom image node implementation
 */

import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

/**
 * TipTap 圖片節點設定介面
 * TipTap Image Node configuration interface
 */
interface TipTapImageNodeOptions {
  inline: boolean
  allowBase64: boolean
}

/**
 * TipTap 圖片節點適配器
 * TipTap Image Node Adapter
 *
 * 擴展 @tiptap/extension-image 以支援:
 * 1. 媒體 ID (mediaId 屬性)
 * 2. 圖片屬性 (alt, title, align, width, height, caption)
 * 3. 內聯編輯控制項
 */
export const TipTapImageNode = Image.extend({
  name: 'image',

  addOptions(): TipTapImageNodeOptions {
    return {
      ...this.parent?.(),
      inline: false,
      allowBase64: true,
    }
  },

  addAttributes() {
    return {
      // 來自原始 Image 擴展的屬性
      // Attributes from original Image extension
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('src'),
        renderHTML: (attributes) => {
          return {
            src: attributes.src,
          }
        },
      },
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute('alt'),
        renderHTML: (attributes) => {
          return {
            alt: attributes.alt,
          }
        },
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('title'),
        renderHTML: (attributes) => {
          return {
            title: attributes.title,
          }
        },
      },

      // 自訂屬性
      // Custom attributes
      mediaId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-media-id'),
        renderHTML: (attributes) => {
          return {
            'data-media-id': attributes.mediaId,
          }
        },
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => {
          return {
            'data-align': attributes.align,
          }
        },
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width')
          return width ? parseInt(width) : null
        },
        renderHTML: (attributes) => {
          return attributes.width
            ? {
                width: attributes.width,
              }
            : {}
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element.getAttribute('height')
          return height ? parseInt(height) : null
        },
        renderHTML: (attributes) => {
          return attributes.height
            ? {
                height: attributes.height,
              }
            : {}
        },
      },
      caption: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-caption'),
        renderHTML: (attributes) => {
          return {
            'data-caption': attributes.caption,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) {
            return false
          }

          return {
            src: dom.getAttribute('src'),
            alt: dom.getAttribute('alt'),
            title: dom.getAttribute('title'),
            mediaId: dom.getAttribute('data-media-id'),
            align: dom.getAttribute('data-align') || 'center',
            width: dom.getAttribute('width') ? parseInt(dom.getAttribute('width')!) : null,
            height: dom.getAttribute('height') ? parseInt(dom.getAttribute('height')!) : null,
            caption: dom.getAttribute('data-caption'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { align = 'center', width, height, caption } = HTMLAttributes

    // 構建對齐樣式
    // Build alignment style
    const alignClass = {
      left: 'float-left mr-4',
      center: 'mx-auto block',
      right: 'float-right ml-4',
    }[align] || 'mx-auto block'

    return [
      'figure',
      { class: `tiptap-image-figure ${alignClass}` },
      [
        'img',
        mergeAttributes(this.options.HTMLAttributes, {
          ...HTMLAttributes,
          class: `tiptap-image ${alignClass}`,
          width: width,
          height: height,
        }),
      ],
      ...(caption
        ? [
            [
              'figcaption',
              { class: 'tiptap-image-caption text-sm text-gray-600 mt-2 text-center' },
              caption,
            ],
          ]
        : []),
    ]
  },

  addKeyboardShortcuts() {
    return {
      // 在圖片上按 Delete 鍵移除圖片
      // Remove image with Delete key
      Delete: ({ editor }) => {
        const { selection } = editor.state
        const { node } = selection.$anchor.parent

        if (node?.type.name === this.name) {
          editor.commands.deleteSelection()
          return true
        }

        return false
      },

      // 按 Backspace 時移除圖片
      // Remove image with Backspace
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        const { node } = selection.$anchor.parent

        if (node?.type.name === this.name) {
          editor.commands.deleteSelection()
          return true
        }

        return false
      },
    }
  },

  addNodeView() {
    return {
      // 返回 null 使用預設節點檢視
      // Return null to use default node view
    }
  },

  addCommands() {
    return {
      // 設定圖片屬性命令
      // Set image properties command
      setImageProperties:
        (attributes: {
          alt?: string
          title?: string
          align?: 'left' | 'center' | 'right'
          width?: number
          height?: number
          caption?: string
        }) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },

      // 插入圖片命令
      // Insert image command
      insertImage:
        (attributes: {
          src: string
          alt?: string
          title?: string
          mediaId?: string
          align?: 'left' | 'center' | 'right'
          width?: number
          height?: number
          caption?: string
        }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
    }
  },
})

/**
 * 從 HTML 內容中提取圖片節點
 * Extract image nodes from HTML content
 */
export function extractImageNodesFromHTML(html: string): Array<{
  src: string
  alt?: string
  title?: string
  mediaId?: string
  align?: string
  width?: number
  height?: number
  caption?: string
}> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const images: Array<{
    src: string
    alt?: string
    title?: string
    mediaId?: string
    align?: string
    width?: number
    height?: number
    caption?: string
  }> = []

  doc.querySelectorAll('img[src]').forEach((img) => {
    const figure = img.closest('figure')
    const caption = figure?.querySelector('figcaption')?.textContent

    images.push({
      src: img.getAttribute('src') || '',
      alt: img.getAttribute('alt') || undefined,
      title: img.getAttribute('title') || undefined,
      mediaId: img.getAttribute('data-media-id') || undefined,
      align: img.getAttribute('data-align') || undefined,
      width: img.getAttribute('width') ? parseInt(img.getAttribute('width')!) : undefined,
      height: img.getAttribute('height') ? parseInt(img.getAttribute('height')!) : undefined,
      caption: caption || undefined,
    })
  })

  return images
}

/**
 * 將圖片節點轉換為 HTML
 * Convert image node to HTML
 */
export function imageNodeToHTML(node: ProseMirrorNode): string {
  const {
    src,
    alt = '',
    title,
    mediaId,
    align = 'center',
    width,
    height,
    caption,
  } = node.attrs

  let html = `<figure data-align="${align}">`
  html += `<img src="${src}" alt="${alt}"`

  if (title) html += ` title="${title}"`
  if (mediaId) html += ` data-media-id="${mediaId}"`
  if (width) html += ` width="${width}"`
  if (height) html += ` height="${height}"`

  html += ` data-align="${align}"`
  html += '>'

  if (caption) {
    html += `<figcaption>${caption}</figcaption>`
  }

  html += '</figure>'

  return html
}

export default TipTapImageNode
