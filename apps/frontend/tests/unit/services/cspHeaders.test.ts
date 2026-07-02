/**
 * 內容安全策略標頭服務測試
 * CSP Headers Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  buildCSPHeader,
  getCSPHeaders,
  logCSPViolation,
  CSP_DEVELOPMENT,
  CSP_PRODUCTION,
  type CSPPolicy,
} from '@/services/cspHeaders'

describe('CSP Headers Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('buildCSPHeader', () => {
    it('should build valid CSP header string', () => {
      const policy: CSPPolicy = {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", 'https://cdn.example.com'],
          'style-src': ["'self'", "'unsafe-inline'"],
        },
      }

      const header = buildCSPHeader(policy)

      expect(header).toContain("default-src 'self'")
      expect(header).toContain("script-src 'self' https://cdn.example.com")
      expect(header).toContain("style-src 'self' 'unsafe-inline'")
    })

    it('should include upgrade-insecure-requests directive', () => {
      const policy: CSPPolicy = {
        directives: { 'default-src': ["'self'"] },
        upgradeInsecureRequests: true,
      }

      const header = buildCSPHeader(policy)

      expect(header).toContain('upgrade-insecure-requests')
    })

    it('should include block-all-mixed-content directive', () => {
      const policy: CSPPolicy = {
        directives: { 'default-src': ["'self'"] },
        blockAllMixedContent: true,
      }

      const header = buildCSPHeader(policy)

      expect(header).toContain('block-all-mixed-content')
    })

    it('should include report-uri directive', () => {
      const policy: CSPPolicy = {
        directives: { 'default-src': ["'self'"] },
        reportUri: '/api/csp-report',
      }

      const header = buildCSPHeader(policy)

      expect(header).toContain('report-uri /api/csp-report')
    })

    it('should skip empty directive values', () => {
      const policy: CSPPolicy = {
        directives: {
          'default-src': ["'self'"],
          'plugin-types': [], // Empty
          'script-src': ["'self'"],
        },
      }

      const header = buildCSPHeader(policy)

      expect(header).not.toContain('plugin-types')
      expect(header).toContain('default-src')
      expect(header).toContain('script-src')
    })

    it('should format directives as semicolon-separated list', () => {
      const policy: CSPPolicy = {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'"],
        },
      }

      const header = buildCSPHeader(policy)

      // Should contain semicolons between directives
      expect(header).toMatch(/;/)
      const directives = header.split('; ')
      expect(directives.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('CSP_DEVELOPMENT config', () => {
    it('should include unsafe-inline for scripts', () => {
      const scriptDirective = CSP_DEVELOPMENT.directives['script-src']
      expect(scriptDirective).toContain("'unsafe-inline'")
    })

    it('should include localhost Supabase URL', () => {
      const connectDirective = CSP_DEVELOPMENT.directives['connect-src']
      expect(connectDirective).toContain('http://localhost:54321')
    })

    it('should allow unsafe-inline styles for Tailwind', () => {
      const styleDirective = CSP_DEVELOPMENT.directives['style-src']
      expect(styleDirective).toContain("'unsafe-inline'")
    })

    it('should include YouTube iframe source', () => {
      const frameDirective = CSP_DEVELOPMENT.directives['frame-src']
      expect(frameDirective).toContain('https://www.youtube.com')
    })
  })

  describe('CSP_PRODUCTION config', () => {
    it('should NOT include unsafe-inline for scripts', () => {
      const scriptDirective = CSP_PRODUCTION.directives['script-src']
      expect(scriptDirective).not.toContain("'unsafe-inline'")
    })

    it('should NOT include localhost URLs', () => {
      const connectDirective = CSP_PRODUCTION.directives['connect-src']
      expect(connectDirective).not.toContain('localhost')
    })

    it('should enable upgradeInsecureRequests', () => {
      expect(CSP_PRODUCTION.upgradeInsecureRequests).toBe(true)
    })

    it('should enable blockAllMixedContent', () => {
      expect(CSP_PRODUCTION.blockAllMixedContent).toBe(true)
    })

    it('should have reportUri configured', () => {
      expect(CSP_PRODUCTION.reportUri).toBe('/api/csp-report')
    })

    it('should block frame ancestors', () => {
      const frameAncestors = CSP_PRODUCTION.directives['frame-ancestors']
      expect(frameAncestors).toContain("'none'")
    })
  })

  describe('getCSPHeaders', () => {
    it('should return required security headers', () => {
      const headers = getCSPHeaders()

      expect(headers).toHaveProperty('Content-Security-Policy')
      expect(headers).toHaveProperty('X-Content-Security-Policy')
      expect(headers).toHaveProperty('X-Content-Type-Options')
      expect(headers).toHaveProperty('X-Frame-Options')
      expect(headers).toHaveProperty('X-XSS-Protection')
      expect(headers).toHaveProperty('Referrer-Policy')
      expect(headers).toHaveProperty('Permissions-Policy')
    })

    it('should prevent MIME sniffing', () => {
      const headers = getCSPHeaders()
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
    })

    it('should prevent clickjacking', () => {
      const headers = getCSPHeaders()
      expect(headers['X-Frame-Options']).toBe('DENY')
    })

    it('should enable XSS protection', () => {
      const headers = getCSPHeaders()
      expect(headers['X-XSS-Protection']).toBe('1; mode=block')
    })

    it('should set strict referrer policy', () => {
      const headers = getCSPHeaders()
      expect(headers['Referrer-Policy']).toBe('strict-no-referrer')
    })

    it('should disable sensitive permissions', () => {
      const headers = getCSPHeaders()
      expect(headers['Permissions-Policy']).toContain('geolocation=()')
      expect(headers['Permissions-Policy']).toContain('microphone=()')
      expect(headers['Permissions-Policy']).toContain('camera=()')
    })

    it('should use development config in dev mode', () => {
      process.env.NODE_ENV = 'development'
      const headers = getCSPHeaders()
      const csp = headers['Content-Security-Policy']

      expect(csp).toContain("'unsafe-inline'")
      expect(csp).toContain('localhost')

      process.env.NODE_ENV = 'test'
    })

    it('should use production config in prod mode', () => {
      process.env.NODE_ENV = 'production'
      const headers = getCSPHeaders()
      const csp = headers['Content-Security-Policy']

      expect(csp).not.toContain("'unsafe-inline'") // For scripts
      expect(csp).not.toContain('localhost')
      expect(csp).toContain('upgrade-insecure-requests')
      expect(csp).toContain('block-all-mixed-content')

      process.env.NODE_ENV = 'test'
    })
  })

  describe('logCSPViolation', () => {
    it('should log CSP violation in development', () => {
      process.env.NODE_ENV = 'development'
      const warnSpy = vi.spyOn(console, 'warn')

      const report = {
        'document-uri': 'https://example.com/page',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.com/script.js',
        'source-file': 'https://example.com/app.js',
        'line-number': 42,
      }

      logCSPViolation(report)

      expect(warnSpy).toHaveBeenCalled()
      const callArgs = warnSpy.mock.calls[0][0]
      expect(callArgs).toContain('CSP Violation')
      expect(callArgs).toContain('https://example.com/page')
      expect(callArgs).toContain('script-src')

      warnSpy.mockRestore()
      process.env.NODE_ENV = 'test'
    })

    it('should log CSP violation in production', () => {
      process.env.NODE_ENV = 'production'
      const warnSpy = vi.spyOn(console, 'warn')

      const report = {
        'document-uri': 'https://example.com/page',
        'violated-directive': 'img-src',
        'blocked-uri': 'https://evil.com/image.jpg',
      }

      logCSPViolation(report)

      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
      process.env.NODE_ENV = 'test'
    })

    it('should handle partial report data', () => {
      const warnSpy = vi.spyOn(console, 'warn')

      const report = {
        'violated-directive': 'script-src',
      }

      expect(() => {
        logCSPViolation(report)
      }).not.toThrow()

      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })

  describe('Security directives validation', () => {
    it('should have strict default-src', () => {
      const defaultSrc = CSP_PRODUCTION.directives['default-src']
      expect(defaultSrc).toEqual(["'self'"])
    })

    it('should block plugins', () => {
      const objectSrc = CSP_PRODUCTION.directives['object-src']
      expect(objectSrc).toEqual(["'none'"])
    })

    it('should block framing', () => {
      const frameAncestors = CSP_PRODUCTION.directives['frame-ancestors']
      expect(frameAncestors).toEqual(["'none'"])
    })

    it('should restrict form submissions', () => {
      const formAction = CSP_PRODUCTION.directives['form-action']
      expect(formAction).toEqual(["'self'"])
    })

    it('should restrict base URI', () => {
      const baseUri = CSP_PRODUCTION.directives['base-uri']
      expect(baseUri).toEqual(["'self'"])
    })

    it('should allow HTTPS images', () => {
      const imgSrc = CSP_PRODUCTION.directives['img-src']
      expect(imgSrc).toContain('https:')
    })

    it('should allow blob URLs for media', () => {
      const mediaSrc = CSP_PRODUCTION.directives['media-src']
      expect(mediaSrc).toContain('blob:')
    })

    it('should allow data URLs for fonts', () => {
      const fontSrc = CSP_PRODUCTION.directives['font-src']
      expect(fontSrc).toContain('data:')
    })
  })
})
