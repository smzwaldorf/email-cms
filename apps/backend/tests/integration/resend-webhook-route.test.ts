import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, expect, it, vi } from 'vitest'
const handler = vi.hoisted(() => vi.fn())
vi.mock('#/services/resendWebhookService', () => ({ handleResendWebhook: handler }))
import { handleApiRequest } from '#/routes'
import { getSupabaseClient } from '#/lib/supabase'
afterEach(() => vi.unstubAllEnvs())
it('routes without a CMS login and preserves raw body and Svix headers', async () => {
  vi.stubEnv('CMS_SESSION_ENABLED', 'false')
  const raw = '{ "type": "email.opened" }\n'
  const request = Readable.from([raw]) as IncomingMessage
  request.url = '/api/webhooks/resend'; request.method = 'POST'
  request.headers = { 'svix-id': 'msg-1', 'svix-timestamp': '123', 'svix-signature': 'v1,test' }
  handler.mockResolvedValue({ status: 503, body: { error: 'retry' } })
  const writeHead = vi.fn(); const end = vi.fn()
  await handleApiRequest(request, { writeHead, end } as unknown as ServerResponse, { supabase: getSupabaseClient(), corsOrigin: 'http://localhost:5173' })
  expect(handler.mock.calls[0][0]).toBe(raw)
  expect(handler.mock.calls[0][1].get('svix-id')).toBe('msg-1')
  expect(writeHead.mock.calls[0][0]).toBe(503)
  expect(JSON.parse(end.mock.calls[0][0])).toEqual({ error: 'retry' })
})
