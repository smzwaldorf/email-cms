
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Mock Deno environment
globalThis.Deno = {
  env: {
    get: vi.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://mock.supabase.co'
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'mock-key'
      if (key === 'JWT_SECRET') return 'mock-secret'
      return undefined
    })
  }
} as any

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

// Mock logging
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

// Mock Supabase Client and Chain
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockGt = vi.fn()

const mockSupabase = {
  from: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
  }))
}

const queryBuilder = {
  eq: mockEq,
  gt: mockGt,
  then: (resolve: any) => resolve({ count: 0, error: null })
}

// Logic implementations (mirrors Edge Functions)
// We define them here to unit test the LOGIC, as we can't easily import Deno files into Node Vitest
const handlePixelLogic = async (req: Request, verifyToken: (t: string) => Promise<any>) => {
  const url = new URL(req.url)
  const token = url.searchParams.get("t")

  if (!token) return { type: 'gif', status: 200 } // Early return

  // Supabase init (mocked)
  const supabase = createClient('url', 'key')

  try {
    const payload = await verifyToken(token)
    if (payload) {
      const { user_id, newsletter_id } = payload
      
      // Deduplication
      const { count } = await supabase.from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'email_open')
        .eq('user_id', user_id)
        .eq('newsletter_id', newsletter_id)
        .gt('created_at', new Date(Date.now() - 10000).toISOString()) as any

      if (count && count > 0) {
        console.log(`Duplicate email_open skipped for user ${user_id}`)
      } else {
        await supabase.from('analytics_events').insert({
          event_type: 'email_open',
          user_id,
          newsletter_id,
          metadata: {
             user_agent: req.headers.get("user-agent"),
             ip: req.headers.get("x-forwarded-for"),
          }
        })
      }
    }
  } catch (e) {
    console.error("Pixel Error:", e)
  }
  return { type: 'gif', status: 200 }
}

const handleRedirectLogic = async (req: Request, verifyToken: (t: string) => Promise<any>) => {
    const url = new URL(req.url)
    const token = url.searchParams.get("t")
    const targetUrl = url.searchParams.get("url")
    
    if (!targetUrl) return { status: 400, body: 'Missing URL' }
    
    const fallback = { status: 302, headers: { Location: targetUrl } }
    if (!token) return fallback
    
    const supabase = createClient('url', 'key')
    
    try {
        const payload = await verifyToken(token)
        if (payload) {
             const { user_id, newsletter_id } = payload
             
            // Deduplication
            const { count } = await supabase.from("analytics_events")
                .select("*", { count: 'exact', head: true })
                .eq("event_type", "link_click")
                .eq("user_id", user_id)
                .eq("newsletter_id", newsletter_id)
                .eq("metadata->>target_url", targetUrl)
                .gt("created_at", new Date(Date.now() - 10000).toISOString()) as any;

             if (count && count > 0) {
                 console.log(`Duplicate link_click skipped for user ${user_id}`)
             } else {
                 await supabase.from("analytics_events").insert({
                     event_type: "link_click",
                     user_id,
                     newsletter_id,
                     metadata: {
                         target_url: targetUrl,
                         user_agent: req.headers.get("user-agent"),
                         ip: req.headers.get("x-forwarded-for"),
                     }
                 })
             }
        }
    } catch (e) {
        console.error("Token verification failed:", e)
        return fallback
    }
    
    return { status: 302, headers: { Location: targetUrl } }
}

describe('Analytics API Endpoints (Logic)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(createClient as any).mockReturnValue(mockSupabase)
    
    mockSelect.mockReturnValue(queryBuilder)
    mockEq.mockReturnValue(queryBuilder)
    mockGt.mockReturnValue(queryBuilder)
    mockInsert.mockResolvedValue({ error: null })
  })

  describe('Tracking Pixel', () => {
    it('should return GIF and log event for valid token', async () => {
      const verifyToken = vi.fn().mockResolvedValue({ user_id: 'u1', newsletter_id: 'w1' })
      const req = new Request('https://api.com/pixel?t=validToken', {
          headers: { 'user-agent': 'TestAgent' }
      })

      await handlePixelLogic(req, verifyToken)

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'email_open',
        user_id: 'u1',
        newsletter_id: 'w1',
        metadata: expect.objectContaining({ user_agent: 'TestAgent' })
      }))
    })

    it('should deduplicate events within 10 seconds', async () => {
       const verifyToken = vi.fn().mockResolvedValue({ user_id: 'u1', newsletter_id: 'w1' })
       const req = new Request('https://api.com/pixel?t=validToken')
       
       // Mock existing event check returning count > 0
       queryBuilder.then = (resolve: any) => resolve({ count: 1, error: null })
       
       await handlePixelLogic(req, verifyToken)
       
       expect(mockInsert).not.toHaveBeenCalled()
       expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Duplicate'))
    })

    it('should fail silently and return GIF on error', async () => {
        const verifyToken = vi.fn().mockRejectedValue(new Error('Invalid'))
        const req = new Request('https://api.com/pixel?t=badToken')
        
        const res = await handlePixelLogic(req, verifyToken)
        
        expect(res.type).toBe('gif')
        expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('Tracking Redirect', () => {
      it('should redirect and log click for valid token', async () => {
          const verifyToken = vi.fn().mockResolvedValue({ user_id: 'u1', newsletter_id: 'w1' })
          const target = 'https://example.com'
          const req = new Request(`https://api.com/click?t=token&url=${target}`, {
               headers: { 'user-agent': 'Chrome' }
          })
          
          queryBuilder.then = (resolve: any) => resolve({ count: 0, error: null })

          const res = await handleRedirectLogic(req, verifyToken)
          
          expect(res.status).toBe(302)
          expect(res.headers.Location).toBe(target)
          expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
              event_type: 'link_click',
              metadata: expect.objectContaining({ target_url: target })
          }))
      })

      it('should redirect even if token is invalid (fallback)', async () => {
          const verifyToken = vi.fn().mockRejectedValue(new Error('Fail'))
          const target = 'https://example.com'
          const req = new Request(`https://api.com/click?t=bad&url=${target}`)
          
          const res = await handleRedirectLogic(req, verifyToken)
          
          expect(res.status).toBe(302)
          expect(res.headers.Location).toBe(target)
          // Should not log event
          expect(mockInsert).not.toHaveBeenCalled()
      })
      
      it('should 400 if url missing', async () => {
          const req = new Request(`https://api.com/click?t=token`)
          const res = await handleRedirectLogic(req, vi.fn())
          expect(res.status).toBe(400)
      })
  })
})
