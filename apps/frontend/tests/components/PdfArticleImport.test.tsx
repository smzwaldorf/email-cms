import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfArticleImport } from '@/components/admin/PdfArticleImport'
import { pdfArticleApi } from '@/services/pdfArticleApi'
vi.mock('@/services/pdfArticleApi', () => ({
  pdfArticleApi: {
    extract: vi.fn(),
    create: vi.fn(),
    manifest: vi.fn(),
    generate: vi.fn(),
  },
}))
beforeEach(() => vi.clearAllMocks())
async function review() {
  fireEvent.click(screen.getByText('從 PDF 建立有聲文章'))
  fireEvent.change(screen.getByLabelText('PDF 檔案'), {
    target: {
      files: [new File(['%PDF-'], 'test.pdf', { type: 'application/pdf' })],
    },
  })
  fireEvent.click(screen.getByText('擷取文字'))
  await screen.findByLabelText('確認擷取文字')
}
it('reviews text, creates a draft, and retries only unfinished speech', async () => {
  vi.mocked(pdfArticleApi.extract).mockResolvedValue({
    title: 'PDF title',
    text: 'Original text',
  })
  vi.mocked(pdfArticleApi.create).mockResolvedValue({ articleId: 'article-1' })
  vi.mocked(pdfArticleApi.manifest)
    .mockResolvedValueOnce({
      parts: [
        { part_index: 0, ready: false },
        { part_index: 1, ready: false },
      ],
    })
    .mockResolvedValueOnce({
      parts: [
        { part_index: 0, ready: true },
        { part_index: 1, ready: false },
      ],
    })
  vi.mocked(pdfArticleApi.generate)
    .mockResolvedValueOnce({ ready: true })
    .mockRejectedValueOnce(new Error('Try again'))
    .mockResolvedValueOnce({ ready: true })
  const created = vi.fn()
  render(<PdfArticleImport newsletterId="newsletter-1" onCreated={created} />)
  await review()
  fireEvent.change(screen.getByLabelText('確認擷取文字'), {
    target: { value: 'Reviewed text' },
  })
  fireEvent.click(screen.getByText('產生語音並建立草稿'))
  await screen.findByRole('alert')
  expect(pdfArticleApi.create).toHaveBeenCalledWith(
    expect.objectContaining({
      text: 'Reviewed text',
      newsletterId: 'newsletter-1',
    })
  )
  expect(created).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('重試未完成的語音'))
  await waitFor(() => expect(created).toHaveBeenCalledWith('article-1'))
  expect(pdfArticleApi.create).toHaveBeenCalledTimes(1)
  expect(vi.mocked(pdfArticleApi.generate).mock.calls).toEqual([
    ['article-1', 0],
    ['article-1', 1],
    ['article-1', 1],
  ])
})
it('does not create an article when extraction fails', async () => {
  vi.mocked(pdfArticleApi.extract).mockRejectedValue(
    new Error('No readable text')
  )
  render(<PdfArticleImport newsletterId="newsletter-1" onCreated={vi.fn()} />)
  fireEvent.click(screen.getByText('從 PDF 建立有聲文章'))
  fireEvent.change(screen.getByLabelText('PDF 檔案'), {
    target: { files: [new File(['x'], 'test.pdf')] },
  })
  fireEvent.click(screen.getByText('擷取文字'))
  expect(await screen.findByRole('alert')).toHaveTextContent('No readable text')
  expect(pdfArticleApi.create).not.toHaveBeenCalled()
})
