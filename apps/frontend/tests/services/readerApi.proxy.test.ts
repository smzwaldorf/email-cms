import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BackendApiError, readerApi } from '@/services/backendApi'
import { setAccessToken } from '@/services/backendClient'

describe('readerApi proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAccessToken(null)
    vi.stubGlobal('fetch', vi.fn())
  })

  it('loads a week bundle without requiring a session', async () => {
    const bundle = {
      newsletter: { id: 'nl-1', week_number: '2026-W01' },
      articles: [{ id: 'art-1', title: 'Hello' }],
    }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(bundle),
    } as Response)

    await expect(readerApi.getWeek('2026-W01')).resolves.toEqual(bundle)
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8787/api/reader/weeks/2026-W01',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      }),
    )
  })

  it('forwards a session token when the reader is signed in', async () => {
    setAccessToken('reader-token')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: 'art-1' }),
    } as Response)

    await readerApi.getArticle('art-1', 'nl-1')

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8787/api/reader/articles/art-1?newsletterId=nl-1',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer reader-token',
        }),
      }),
    )
  })

  it('surfaces backend 404s as BackendApiError', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: 'Newsletter not found' }),
    } as Response)

    await expect(readerApi.getWeek('missing')).rejects.toMatchObject({
      name: 'BackendApiError',
      status: 404,
      message: 'Newsletter not found',
    } satisfies Partial<BackendApiError>)
  })
})
