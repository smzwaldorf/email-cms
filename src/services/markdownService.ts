/**
 * Markdown 轉換服務
 * 將 Markdown 內容轉換為 HTML
 */

/**
 * 將 Markdown 轉換為 HTML
 * @param markdown - Markdown 格式的文本
 * @returns HTML 字符串
 */
export async function convertMarkdownToHtml(markdown: string): Promise<string> {
  try {
    // 基本的 Markdown 轉 HTML 轉換實現
    // 在實際應用中，應該使用完整的 Markdown 解析庫
    let html = escapeHtml(markdown)

    // 基本轉換規則
    html = html
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br />')

    return `<p>${html}</p>`
  } catch (error) {
    console.error('Markdown conversion error:', error)
    // 在出錯時返回原始文本，用 <pre> 標籤包裝
    return `<pre>${escapeHtml(markdown)}</pre>`
  }
}

/**
 * 轉義 HTML 特殊字符
 * @param text - 要轉義的文本
 * @returns 轉義後的文本
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}
