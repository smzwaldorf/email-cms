import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedViewer } from '#/auth'
const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  query: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  fetch: vi.fn(),
}))
vi.mock('#/services/r2MediaService', () => ({
  mediaBucket: () => ({ put: mocks.put, get: mocks.get, delete: mocks.delete }),
  mediaStorageConfiguration: () => ({ environment: 'development', bucket: 'smz-cms-media-dev-staging' }),
}))
vi.mock('#/lib/db', () => ({
  query: mocks.query,
  withTransaction: (fn: () => unknown) => fn(),
}))
vi.mock('#/services/adminService', () => ({
  adminService: { createArticleForNewsletter: mocks.create },
}))
vi.mock('#/services/readerService', () => ({
  readerService: { getReaderArticle: mocks.read },
}))
import {
  pdfArticleService,
  narrationContent,
  speechChunks,
} from '#/services/pdfArticleService'
const admin = {
  id: '22222222-2222-4222-8222-222222222222',
  roles: ['admin'],
} as AuthenticatedViewer
const articleId = '11111111-1111-4111-8111-111111111111'
const input = {
  filename: '學校.pdf',
  data: Buffer.from('%PDF-1.4\ntest').toString('base64'),
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.put.mockResolvedValue({ key: 'stored' })
  vi.stubEnv('OPENAI_API_KEY', 'test-key')
  vi.stubGlobal('fetch', mocks.fetch)
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('RETURNING part_index') ? [{ part_index: 0 }] : [] }))
  mocks.create.mockResolvedValue({ id: articleId })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
const extraction = (text = '中文文章\n\n第二段') =>
  new Response(
    JSON.stringify({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
    })
  )
describe('PDF extraction', () => {
  it('sends inline PDF with storage disabled and preserves original text', async () => {
    mocks.fetch.mockResolvedValue(extraction())
    expect(await pdfArticleService.extract(input, admin)).toEqual({
      title: '學校',
      text: '中文文章\n\n第二段',
    })
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body)
    expect(body.store).toBe(false)
    expect(body.input[0].content[0].file_data).toBe(
      `data:application/pdf;base64,${input.data}`
    )
  })
  it.each(['parent', 'teacher'])(
    'denies %s before calling OpenAI',
    async (role) => {
      await expect(
        pdfArticleService.extract(input, {
          roles: [role],
        } as AuthenticatedViewer)
      ).rejects.toMatchObject({ status: 403 })
      expect(mocks.fetch).not.toHaveBeenCalled()
    }
  )
  it.each([
    { ...input, data: 'not-pdf' },
    { ...input, filename: 'test.txt' },
    { ...input, data: 'A'.repeat(14_000_000) },
  ])('rejects invalid inputs before billing', async (data) => {
    await expect(pdfArticleService.extract(data, admin)).rejects.toMatchObject({
      status: 400,
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('reports missing configuration without sending requests', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    await expect(pdfArticleService.extract(input, admin)).rejects.toMatchObject(
      { status: 503 }
    )
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it.each([
    extraction(''),
    extraction('文'.repeat(12001)),
    new Response(JSON.stringify({ status: 'incomplete', output: [] })),
  ])('rejects empty, oversized and truncated output', async (response) => {
    mocks.fetch.mockResolvedValue(response)
    await expect(pdfArticleService.extract(input, admin)).rejects.toMatchObject(
      { status: 422 }
    )
  })
  it('does not leak provider error bodies', async () => {
    mocks.fetch.mockResolvedValue(
      new Response('sensitive provider body', { status: 401 })
    )
    await expect(pdfArticleService.extract(input, admin)).rejects.toMatchObject(
      { status: 502, message: 'OpenAI 處理失敗，請檢查設定或稍後重試。' }
    )
  })
})
it('chunks Unicode without losing or duplicating text', () => {
  const text = '學校😀很美。\n'.repeat(1900).slice(0, 15000)
  const chunks = speechChunks(text)
  expect(chunks.join('')).toBe(text)
  expect(chunks.every((chunk) => Array.from(chunk).length <= 600)).toBe(true)
})
it('puts narration before escaped text', () => {
  const html = narrationContent(
    articleId,
    '<script>alert("x")</script>\n\n文字'
  )
  expect(html.indexOf('data-audio-node')).toBeLessThan(html.indexOf('<p>'))
  expect(html).not.toContain('<script>')
  expect(html).toContain('&lt;script&gt;')
  expect(html).toContain('AI 生成語音')
})
it('creates one durable draft and transcripts using reviewed text', async () => {
  await pdfArticleService.create(
    {
      newsletterId: articleId,
      requestId: articleId,
      title: '標題',
      text: '文'.repeat(800),
    },
    admin
  )
  expect(mocks.create).toHaveBeenCalledTimes(1)
  const inserts = mocks.query.mock.calls.filter(([sql]) =>
    sql.startsWith('INSERT INTO article_narration_parts')
  )
  expect(inserts).toHaveLength(2)
  expect(inserts.map(([, args]) => args[2]).join('')).toBe('文'.repeat(800))
})
it('reuses an idempotent import without creating another draft', async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ article_id: articleId }] })
  expect(
    await pdfArticleService.create(
      {
        newsletterId: articleId,
        requestId: articleId,
        title: '標題',
        text: '文字',
      },
      admin
    )
  ).toEqual({ articleId })
  expect(mocks.create).not.toHaveBeenCalled()
})
it('persists generated MP3 bytes against the acquired lease', async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [{ id: articleId }] })
    .mockResolvedValueOnce({ rows: [{ transcript: '文字' }] })
  mocks.fetch.mockResolvedValue(
    new Response(new Uint8Array([73, 68, 51]), {
      headers: { 'content-type': 'audio/mpeg' },
    })
  )
  await expect(
    pdfArticleService.generate(articleId, 0, admin)
  ).resolves.toEqual({ ready: true })
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({
    input: '文字',
    response_format: 'mp3',
  })
  expect(mocks.put.mock.calls[0][1]).toEqual(Buffer.from('ID3'))
  expect(mocks.query.mock.calls.at(-1)?.[1][3]).toMatch(/^development\/narrations\/.+\.mp3$/)
  expect(mocks.query.mock.calls.at(-1)?.[1][4]).toBe('smz-cms-media-dev-staging')
})
it('reuses completed speech without calling OpenAI', async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [{ id: articleId }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ ready: true }] })
  await expect(
    pdfArticleService.generate(articleId, 0, admin)
  ).resolves.toEqual({ ready: true })
  expect(mocks.fetch).not.toHaveBeenCalled()
})
it('rejects concurrent generation without billing', async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [{ id: articleId }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ ready: false }] })
  await expect(
    pdfArticleService.generate(articleId, 0, admin)
  ).rejects.toMatchObject({ status: 409 })
  expect(mocks.fetch).not.toHaveBeenCalled()
})
it('releases the lease on provider failure so generation can resume', async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [{ id: articleId }] })
    .mockResolvedValueOnce({ rows: [{ transcript: '文字' }] })
  mocks.fetch.mockResolvedValue(new Response('', { status: 429 }))
  await expect(
    pdfArticleService.generate(articleId, 0, admin)
  ).rejects.toMatchObject({ status: 429 })
  expect(mocks.query.mock.calls.at(-1)?.[0]).toContain(
    'SET generating_at = NULL, lease_id = NULL'
  )
})
it('checks reader visibility before returning audio', async () => {
  mocks.query.mockResolvedValueOnce({ rows: [{ id: articleId }] })
  mocks.read.mockRejectedValueOnce(new Error('Article not found'))
  await expect(pdfArticleService.audio(articleId, 0, null)).rejects.toThrow(
    'Article not found'
  )
  expect(mocks.query).toHaveBeenCalledTimes(1)
})
it('never serves audio from a deleted article, even to admins', async () => {
  await expect(
    pdfArticleService.audio(articleId, 0, admin)
  ).rejects.toMatchObject({ status: 404 })
  expect(mocks.query).toHaveBeenCalledTimes(1)
})

it('persists a normal long narration above the former 2 MiB limit', async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [{ id: articleId }] })
    .mockResolvedValueOnce({ rows: [{ transcript: '中文朗讀。'.repeat(100) }] })
  const audio = new Uint8Array(3 * 1024 * 1024)
  mocks.fetch.mockResolvedValue(new Response(audio))
  await expect(
    pdfArticleService.generate(articleId, 2, admin)
  ).resolves.toEqual({ ready: true })
  expect(mocks.put.mock.calls[0][1].length).toBe(audio.length)
})

it('still rejects oversized streams and releases the generation lease', async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [{ id: articleId }] })
    .mockResolvedValueOnce({ rows: [{ transcript: '文字' }] })
  const cancel = vi.fn()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1))
    },
    cancel,
  })
  mocks.fetch.mockResolvedValue(new Response(stream))
  await expect(
    pdfArticleService.generate(articleId, 2, admin)
  ).rejects.toMatchObject({ status: 502 })
  expect(cancel).toHaveBeenCalledOnce()
  expect(mocks.query.mock.calls.at(-1)?.[0]).toContain(
    'SET generating_at = NULL, lease_id = NULL'
  )
  expect(
    mocks.query.mock.calls.some(([sql]) => sql.includes('SET audio ='))
  ).toBe(false)
})

it('does not mark failed R2 uploads ready and releases the lease', async () => {
  mocks.query.mockResolvedValueOnce({ rows: [{ id: articleId }] }).mockResolvedValueOnce({ rows: [{ transcript: '文字' }] })
  mocks.fetch.mockResolvedValue(new Response('ID3'))
  mocks.put.mockRejectedValue(new Error('R2 unavailable'))
  await expect(pdfArticleService.generate(articleId, 0, admin)).rejects.toThrow('R2 unavailable')
  expect(mocks.query.mock.calls.some(([sql]) => sql.includes('SET audio_object_key'))).toBe(false)
  expect(mocks.query.mock.calls.at(-1)?.[0]).toContain('SET generating_at = NULL')
})
it('cleans up an upload when its generation lease was lost', async () => {
  mocks.query.mockResolvedValueOnce({ rows: [{ id: articleId }] }).mockResolvedValueOnce({ rows: [{ transcript: '文字' }] }).mockResolvedValueOnce({ rows: [] })
  mocks.fetch.mockResolvedValue(new Response('ID3'))
  await expect(pdfArticleService.generate(articleId, 0, admin)).rejects.toMatchObject({ status: 409 })
  expect(mocks.delete).toHaveBeenCalledWith(mocks.put.mock.calls[0][0])
})
it('serves R2 audio through the authorized narration route', async () => {
  const key = `development/narrations/${articleId}/0/lease.mp3`
  mocks.query.mockResolvedValueOnce({ rows: [{ id: articleId }] }).mockResolvedValueOnce({ rows: [{ audio_object_key: key, audio_bucket: 'smz-cms-media-dev-staging' }] })
  mocks.get.mockResolvedValue({ arrayBuffer: async () => new TextEncoder().encode('ID3').buffer })
  expect(await pdfArticleService.audio(articleId, 0, admin)).toEqual(Buffer.from('ID3'))
  expect(mocks.get).toHaveBeenCalledWith(key)
})
it('keeps legacy database audio playable', async () => {
  mocks.query.mockResolvedValueOnce({ rows: [{ id: articleId }] }).mockResolvedValueOnce({ rows: [{ audio: Buffer.from('ID3') }] })
  expect(await pdfArticleService.audio(articleId, 0, admin)).toEqual(Buffer.from('ID3'))
  expect(mocks.get).not.toHaveBeenCalled()
})
it('refuses references from a different environment', async () => {
  mocks.query.mockResolvedValueOnce({ rows: [{ id: articleId }] }).mockResolvedValueOnce({ rows: [{ audio_object_key: `production/narrations/${articleId}/0/x.mp3`, audio_bucket: 'smz-cms-media-production' }] })
  await expect(pdfArticleService.audio(articleId, 0, admin)).rejects.toMatchObject({ status: 503 })
  expect(mocks.get).not.toHaveBeenCalled()
})
