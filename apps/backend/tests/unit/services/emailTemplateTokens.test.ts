import { describe, expect, it } from 'vitest'

import { createStarterEmailBlocks } from '@/services/emailTemplateBlocks'
import { validateEmailTemplate } from '@/services/emailTemplateTokens'

describe('validateEmailTemplate (block config tokens)', () => {
  it('accepts the starter block set without unsupported-token issues', () => {
    // Header/footer starter bodies reference their own config keys
    // ({{brandName}}, {{tel}}, ...) which the renderer substitutes, so the
    // default new-template shape must be saveable.
    const result = validateEmailTemplate('Weekly {{newsletter.title}}', '', createStarterEmailBlocks())

    expect(result.issues).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('only allows scalar config values as tokens', () => {
    const result = validateEmailTemplate('Hello', '', [
      {
        type: 'footer',
        order: 0,
        visible: true,
        bodyHtml: '<p>{{tel}} {{socials}} {{guardian.email}}</p>',
        config: { tel: '+886', socials: [] },
      },
    ])

    expect(result.valid).toBe(false)
    expect(result.issues.map((issue) => issue.token)).toEqual(['socials'])
  })
})
