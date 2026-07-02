import { describe, expect, it } from 'vitest'

import { normalizeCanvaEmailHtml } from '@/services/canvaEmailImport'

describe('canvaEmailImport', () => {
  it('extracts the body fragment from a full HTML document', () => {
    const result = normalizeCanvaEmailHtml(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
        </head>
        <body>
          <table role="presentation"><tr><td><p>Hello world</p></td></tr></table>
        </body>
      </html>
    `)

    expect(result.hasBlockingIssues).toBe(false)
    expect(result.normalizedHtml).toContain('<table role="presentation">')
    expect(result.normalizedHtml).not.toContain('<html')
    expect(result.normalizedHtml).not.toContain('<body')
  })

  it('flags unsupported tags and removes them from normalized output', () => {
    const result = normalizeCanvaEmailHtml(`
      <html>
        <body>
          <div>Safe</div>
          <script>alert('xss')</script>
          <iframe src="https://example.com/embed"></iframe>
        </body>
      </html>
    `)

    expect(result.hasBlockingIssues).toBe(true)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['unsupported_tag']),
    )
    expect(result.normalizedHtml).toContain('<div>Safe</div>')
    expect(result.normalizedHtml).not.toContain('<script')
    expect(result.normalizedHtml).not.toContain('<iframe')
  })

  it('rejects non-https asset URLs and scrubs them from the candidate output', () => {
    const result = normalizeCanvaEmailHtml(`
      <body>
        <img src="http://cdn.example.com/image.png" alt="bad" />
        <a href="javascript:alert('xss')">Bad link</a>
      </body>
    `)

    expect(result.hasBlockingIssues).toBe(true)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['unsafe_asset_protocol']),
    )
    expect(result.normalizedHtml).not.toContain('http://cdn.example.com/image.png')
    expect(result.normalizedHtml).not.toContain(`href="javascript:alert('xss')"`)
  })

  it('treats stylesheet-based imports without usable body content as incompatible', () => {
    const result = normalizeCanvaEmailHtml(`
      <html>
        <head>
          <style>.hero { color: pink; }</style>
        </head>
        <body></body>
      </html>
    `)

    expect(result.hasBlockingIssues).toBe(true)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['unsupported_stylesheet', 'empty_body']),
    )
  })
})
