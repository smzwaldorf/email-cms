import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NarrationPlayer } from '@/components/NarrationPlayer'
import { pdfArticleApi } from '@/services/pdfArticleApi'
vi.mock('@/services/pdfArticleApi', () => ({
  pdfArticleApi: { manifest: vi.fn(), audio: vi.fn(), generate: vi.fn() },
}))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:test')
      static revokeObjectURL = vi.fn()
    }
  )
  vi.mocked(pdfArticleApi.audio).mockResolvedValue(
    new Blob(['audio'], { type: 'audio/mpeg' })
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('plays sections in order and revokes object URLs', async () => {
  vi.mocked(pdfArticleApi.manifest).mockResolvedValue({
    parts: [
      { part_index: 0, ready: true },
      { part_index: 1, ready: true },
    ],
  })
  const { container, unmount } = render(
    <NarrationPlayer articleId="article-1" editable={false} />
  )
  await waitFor(() =>
    expect(container.querySelector('audio')).toBeInTheDocument()
  )
  expect(screen.getByText('文章朗讀 · AI 生成語音')).toBeInTheDocument()
  fireEvent.ended(container.querySelector('audio')!)
  await waitFor(() =>
    expect(pdfArticleApi.audio).toHaveBeenCalledWith(
      'article-1',
      1,
      expect.any(AbortSignal)
    )
  )
  expect(screen.getByLabelText('朗讀段落')).toHaveValue('1')
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
})
it('offers generation recovery only in the editor', async () => {
  vi.mocked(pdfArticleApi.manifest).mockResolvedValue({
    parts: [{ part_index: 0, ready: false }],
  })
  const { rerender } = render(
    <NarrationPlayer articleId="article-1" editable={false} />
  )
  await screen.findByText('此段語音尚未產生。')
  expect(screen.queryByText('繼續產生未完成的語音')).not.toBeInTheDocument()
  rerender(<NarrationPlayer articleId="article-1" editable />)
  expect(screen.getByText('繼續產生未完成的語音')).toBeInTheDocument()
})
