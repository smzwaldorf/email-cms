import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  viewer: vi.fn(),
  optional: vi.fn(),
  extract: vi.fn(),
  audio: vi.fn(),
}))
vi.mock('#/auth', async (original) => ({
  ...(await original<typeof import('#/auth')>()),
  requireViewer: mocks.viewer,
  optionalViewer: mocks.optional,
}))
vi.mock('#/services/pdfArticleService', () => ({
  MAX_PDF_BYTES: 10 * 1024 * 1024,
  pdfArticleService: { extract: mocks.extract, audio: mocks.audio },
}))
import { handleApiRequest } from '#/routes'
import { HttpError } from '#/auth'
import { getSupabaseClient } from '#/lib/supabase'
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CMS_SESSION_ENABLED', 'false')
})
afterEach(() => vi.unstubAllEnvs())
async function request(path: string, method = 'POST', body = '{}') {
  const req = Readable.from([body]) as IncomingMessage
  req.url = path
  req.method = method
  req.headers = {}
  const writeHead = vi.fn(),
    end = vi.fn()
  await handleApiRequest(req, { writeHead, end } as unknown as ServerResponse, {
    supabase: getSupabaseClient(),
    corsOrigin: 'http://localhost:5173',
  })
  return {
    status: writeHead.mock.calls[0][0],
    headers: writeHead.mock.calls[0][1],
    body: end.mock.calls[0][0],
  }
}
it('requires authentication before extracting', async () => {
  mocks.viewer.mockRejectedValue(new HttpError(401, 'Login required'))
  expect((await request('/api/admin/pdf-articles/extract')).status).toBe(401)
  expect(mocks.extract).not.toHaveBeenCalled()
})
it('requires CMS management permission before extracting', async () => {
  mocks.viewer.mockResolvedValue({ roles: ['parent'] })
  expect((await request('/api/admin/pdf-articles/extract')).status).toBe(403)
  expect(mocks.extract).not.toHaveBeenCalled()
})
it('rejects malformed JSON without processing a PDF', async () => {
  mocks.viewer.mockResolvedValue({ roles: ['admin'] })
  expect(
    (await request('/api/admin/pdf-articles/extract', 'POST', '{bad')).status
  ).toBe(400)
  expect(mocks.extract).not.toHaveBeenCalled()
})
it('returns extraction for an authorized manager', async () => {
  mocks.viewer.mockResolvedValue({ roles: ['admin'] })
  mocks.extract.mockResolvedValue({ title: '標題', text: '文字' })
  const result = await request('/api/admin/pdf-articles/extract')
  expect(result.status).toBe(200)
  expect(JSON.parse(result.body)).toEqual({ title: '標題', text: '文字' })
})
it('serves protected MP3 bytes without public caching', async () => {
  const viewer = { roles: ['parent'] }
  mocks.optional.mockResolvedValue(viewer)
  mocks.audio.mockResolvedValue(Buffer.from('ID3'))
  const result = await request(
    '/api/narrations/11111111-1111-4111-8111-111111111111/0',
    'GET'
  )
  expect(result.status).toBe(200)
  expect(result.headers).toMatchObject({
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'private, no-store',
  })
  expect(mocks.audio).toHaveBeenCalledWith(
    '11111111-1111-4111-8111-111111111111',
    0,
    viewer
  )
})
