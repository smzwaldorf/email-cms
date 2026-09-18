import { createHmac } from 'node:crypto'
import { parseHTML } from 'linkedom'
import { runtimeEnvironment } from '#/runtime/environment'
import type { PersonalizedEmailResolvedBlock } from '#/types/personalization'

export function composeTrackedEmail(input: {
  html: string; parentId: string; newsletterId: string; batchId: string; recipientId: string;
  journeyId: string; appUrl: string; blocks: PersonalizedEmailResolvedBlock[];
}): string {
  const secret = runtimeEnvironment().JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is required for newsletter tracking')
  const origin = new URL(input.appUrl).origin
  const sign = (extra: Record<string, unknown>) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: input.parentId, nwl: input.newsletterId,
      jti: input.journeyId, batch: input.batchId, recipient: input.recipientId,
      exp: Math.floor(Date.now() / 1000) + 14 * 86400, ...extra })).toString('base64url')
    return `${header}.${payload}.${createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`
  }
  const { document } = parseHTML(/<html[\s>]/i.test(input.html) ? input.html : `<html><body>${input.html}</body></html>`)
  for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
    const href = anchor.getAttribute('href')!
    const block = input.blocks.find(item => item.url === href)
    if (!block) continue
    const destination = new URL(href, origin)
    if (destination.origin !== origin) continue
    destination.searchParams.set('jc', input.journeyId)
    const target = destination.toString()
    const click = new URL('/api/tracking/click', origin)
    click.searchParams.set('url', target)
    click.searchParams.set('t', sign({ target, article: block.blockId, cls: block.classId }))
    anchor.setAttribute('href', click.toString())
  }
  const pixel = document.createElement('img')
  const pixelUrl = new URL('/api/tracking/pixel', origin)
  pixelUrl.searchParams.set('t', sign({}))
  pixel.setAttribute('src', pixelUrl.toString())
  pixel.setAttribute('width', '1')
  pixel.setAttribute('height', '1')
  pixel.setAttribute('alt', '')
  document.body.appendChild(pixel)
  return document.toString()
}
