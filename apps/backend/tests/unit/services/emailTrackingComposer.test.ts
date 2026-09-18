import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
const insert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))
vi.mock('#/lib/supabase', () => ({ getSupabaseClient: () => {
  const chain = { select: () => chain, eq: () => chain, gt: () => chain, insert,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ count: 0, error: null })) }
  return { from: () => chain }
} }))
import { composeTrackedEmail } from '#/services/emailTrackingComposer'
import { emailTrackingEndpointService } from '#/services/emailTrackingEndpointService'
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
describe('sent HTML to tracking endpoint contract', () => {
  it('records a signed article click with journey attribution and rejects destination substitution', async () => {
    vi.stubEnv('JWT_SECRET', 'synthetic-secret')
    vi.stubEnv('APP_URL', 'http://localhost:5173')
    const html = composeTrackedEmail({ html: '<p><a href="http://localhost:5173/article/a1">Read</a></p>',
      parentId: 'p1', newsletterId: 'n1', batchId: 'b1', recipientId: 'r1', journeyId: 'j1',
      appUrl: 'http://localhost:5173', blocks: [{ blockId: 'a1', url: 'http://localhost:5173/article/a1', classId: 'c1', content: '', editorialOrder: 1, personalizationKey: 'a1' }] })
    const { document } = parseHTML(html)
    const click = new URL(document.querySelector('a')!.getAttribute('href')!)
    const result = await emailTrackingEndpointService.handleClick(click.searchParams.get('t'), click.searchParams.get('url'), { userAgent: 'Browser' })
    expect(result).toMatchObject({ status: 302, redirectUrl: 'http://localhost:5173/article/a1?jc=j1' })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ article_id: 'a1', newsletter_id: 'n1', metadata: expect.objectContaining({ journey_correlation_id: 'j1', batch_id: 'b1', recipient_id: 'r1' }) }))
    expect((await emailTrackingEndpointService.handleClick(click.searchParams.get('t'), 'http://localhost:5173/article/a2', {})).status).toBe(400)
    expect((await emailTrackingEndpointService.handleClick(null, 'https://evil.example/article/a1', {})).status).toBe(400)
    const pixel = new URL(document.querySelector('img')!.getAttribute('src')!)
    const opened = await emailTrackingEndpointService.handlePixel(pixel.searchParams.get('t'), { userAgent: 'GoogleImageProxy' })
    expect(opened.headers['Content-Type']).toBe('image/gif')
    expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({ event_type: 'email_open', metadata: expect.objectContaining({ qualification: 'automated_or_proxy' }) }))
  })
})
