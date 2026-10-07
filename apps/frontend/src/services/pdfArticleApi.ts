import { backendRequest, backendRequestOptional } from './backendApi'
import { backendBaseUrl, getAccessTokenOrNull } from './backendClient'
import { serverSessionMode } from './serverSessionMode'
export interface NarrationManifest {
  parts: Array<{ part_index: number; ready: boolean }>
}
export const pdfArticleApi = {
  async extract(file: File): Promise<{ title: string; text: string }> {
    if (
      !file.name.toLowerCase().endsWith('.pdf') ||
      !file.size ||
      file.size > 10 * 1024 * 1024
    )
      throw new Error('請選擇 10 MB 以內的 PDF。')
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = () => reject(new Error('無法讀取 PDF。'))
      reader.readAsDataURL(file)
    })
    return backendRequest('/api/admin/pdf-articles/extract', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, data }),
    })
  },
  create(input: {
    newsletterId: string
    requestId: string
    title: string
    text: string
  }): Promise<{ articleId: string }> {
    return backendRequest('/api/admin/pdf-articles', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  manifest(articleId: string): Promise<NarrationManifest> {
    return backendRequestOptional(
      `/api/narrations/${encodeURIComponent(articleId)}`
    )
  },
  generate(articleId: string, index: number): Promise<{ ready: boolean }> {
    return backendRequest(
      `/api/admin/pdf-articles/${encodeURIComponent(articleId)}/parts/${index}`,
      { method: 'POST' }
    )
  },
  async audio(
    articleId: string,
    index: number,
    signal?: AbortSignal
  ): Promise<Blob> {
    const token = getAccessTokenOrNull()
    const response = await fetch(
      `${backendBaseUrl()}/api/narrations/${encodeURIComponent(articleId)}/${index}`,
      {
        signal,
        cache: 'no-store',
        credentials: serverSessionMode ? 'same-origin' : 'omit',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )
    if (!response.ok)
      throw new Error('無法載入語音，請確認登入狀態或稍後重試。')
    return response.blob()
  },
}
