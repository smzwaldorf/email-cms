/**
 * TipTap 圖片節點適配器 - 簡化版本
 * TipTap Image Node Adapter - Simplified version
 *
 * 注意: 目前使用 @tiptap/extension-image 的基礎功能
 * Note: Currently using basic functionality of @tiptap/extension-image
 */

import Image from '@tiptap/extension-image'

/**
 * TipTap 圖片節點 - 擴展基礎 Image 擴展
 * TipTap Image Node - Extends base Image extension
 *
 * 支援的屬性:
 * - src: 圖片 URL
 * - alt: 替代文字
 * - title: 圖片標題
 * - caption: 圖片標題 (可選，顯示在圖片下方中間)
 * - data-media-id: 媒體檔案 ID (用於追蹤)
 * - data-align: 對齐方式 (left, center, right)
 * - width: 圖片寬度
 * - height: 圖片高度
 */
export const TipTapImageNode = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-caption'),
        renderHTML: (attributes) => ({
          'data-caption': attributes.caption,
        }),
      },
    }
  },
}).configure({
  allowBase64: true,
  HTMLAttributes: {
    class: 'tiptap-image',
  },
})

/**
 * 輔助函數: 從 HTML 中提取圖片資訊
 * Helper function: Extract image information from HTML
 */
export function extractImageNodesFromHTML(html: string): Array<{
  src: string
  alt?: string
  title?: string
  mediaId?: string
  align?: string
  width?: number
  height?: number
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
  }> = []

  doc.querySelectorAll('img[src]').forEach((img) => {
    images.push({
      src: img.getAttribute('src') || '',
      alt: img.getAttribute('alt') || undefined,
      title: img.getAttribute('title') || undefined,
      mediaId: img.getAttribute('data-media-id') || undefined,
      align: img.getAttribute('data-align') || undefined,
      width: img.getAttribute('width') ? parseInt(img.getAttribute('width')!) : undefined,
      height: img.getAttribute('height') ? parseInt(img.getAttribute('height')!) : undefined,
    })
  })

  return images
}

export default TipTapImageNode
