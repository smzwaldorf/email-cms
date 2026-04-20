import { describe, expect, it } from 'vitest'

import {
  EMAIL_TEMPLATE_TOKENS,
  renderEmailTemplatePreview,
  validateEmailTemplate,
} from '@/services/emailTemplateTokens'

describe('emailTemplateTokens', () => {
  it('validates unsupported tokens', () => {
    const result = validateEmailTemplate(
      'Hello {{guardian.email}} {{bad.token}}',
      'Body {{newsletter.id}}',
    )

    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_token',
          token: 'bad.token',
        }),
      ]),
    )
  })

  it('renders deterministic preview and warnings for missing values', () => {
    const preview = renderEmailTemplatePreview(
      'Hello {{guardian.email}}',
      'Family: {{family.id}}',
      {
        guardian: { id: 'g-1', email: 'demo@example.com' },
        family: { id: null },
        newsletter: { id: 'newsletter-1', revisionId: 'rev-1' },
        classes: { ids: ['A1', 'B1'] },
      },
    )

    expect(preview.subject).toBe('Hello demo@example.com')
    expect(preview.body).toBe('Family: ')
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          token: 'family.id',
        }),
      ]),
    )
  })

  it('keeps token registry stable for admin and render pipelines', () => {
    expect(EMAIL_TEMPLATE_TOKENS).toContain('newsletter.revisionId')
    expect(EMAIL_TEMPLATE_TOKENS).toContain('classes.list')
  })

  it('accepts article-scoped tokens inside a shared-article-feature block', () => {
    const result = validateEmailTemplate('Weekly {{newsletter.id}}', '', [
      {
        type: 'shared-article-feature',
        order: 0,
        visible: true,
        bodyHtml: '<p>{{article.title}} {{article.url}}</p>',
        config: {},
      },
    ])
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('rejects tokens that are not in global or block inner scope', () => {
    const result = validateEmailTemplate('Hello', '', [
      {
        type: 'shared-article-feature',
        order: 0,
        visible: true,
        bodyHtml: '<p>{{article.unknown}}</p>',
        config: {},
      },
    ])
    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_token',
          token: 'article.unknown',
        }),
      ]),
    )
  })

  it('rejects invalid tokens in subject even when blocks are present', () => {
    const result = validateEmailTemplate('{{not.a.token}}', '', [
      {
        type: 'custom-html',
        order: 0,
        visible: true,
        bodyHtml: '<p>{{guardian.email}}</p>',
        config: {},
      },
    ])
    expect(result.valid).toBe(false)
  })
})

