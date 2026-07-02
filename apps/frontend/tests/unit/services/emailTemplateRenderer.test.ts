import { describe, expect, it } from 'vitest'

import { renderTemplateForRecipient, type RecipientRenderContext } from '@/services/emailTemplateRenderer'
import type { EmailTemplateBlock } from '@/types/emailTemplate'

function baseContext(overrides: Partial<RecipientRenderContext> = {}): RecipientRenderContext {
  return {
    templateContext: {
      guardian: { id: 'g-1', email: 'guardian@example.com' },
      family: { id: 'family-1' },
      newsletter: { id: 'news-1', revisionId: 'rev-1' },
      classes: { ids: ['A', 'B'] },
    },
    sharedArticles: [
      { id: 'sa-1', title: 'Shared Title', excerpt: 'Shared excerpt text', url: 'https://example.com/s1' },
    ],
    classes: [
      {
        id: 'A',
        code: 'A1',
        name: 'Grade A',
        articles: [
          { id: 'ca-1', title: 'Class Article', excerpt: 'Class excerpt', url: 'https://example.com/c1' },
        ],
      },
    ],
    weeklyItems: [
      {
        id: 'w-1',
        title: 'Weekly bullet',
        excerpt: 'Weekly excerpt',
        url: 'https://example.com/w1',
        sourceTag: 'weekly',
      },
    ],
    ...overrides,
  }
}

describe('renderTemplateForRecipient', () => {
  it('renders a static block with global tokens and config keys', () => {
    const blocks: EmailTemplateBlock[] = [
      {
        type: 'custom-html',
        order: 0,
        visible: true,
        bodyHtml: '<p>{{guardian.email}} | {{newsletter.id}}</p>',
        config: {},
      },
    ]
    const result = renderTemplateForRecipient(blocks, baseContext(), { wrapInDocumentShell: false })
    expect(result.html).toBe('<p>guardian@example.com | news-1</p>')
    expect(result.missingTokens).toHaveLength(0)
    expect(result.renderedBlockCount).toBe(1)
    expect(result.skippedBlockCount).toBe(0)
  })

  it('expands shared-article-feature over sharedArticles', () => {
    const blocks: EmailTemplateBlock[] = [
      {
        type: 'shared-article-feature',
        order: 0,
        visible: true,
        bodyHtml: '<div>{{article.title}}:{{article.excerpt}}</div>',
        config: { maxItems: 1, eyebrow: 'E', ctaLabel: 'Go', excerptLength: 100 },
      },
    ]
    const result = renderTemplateForRecipient(blocks, baseContext(), { wrapInDocumentShell: false })
    expect(result.html).toContain('Shared Title')
    expect(result.html).toContain('Shared excerpt text')
    expect(result.renderedBlockCount).toBe(1)
  })

  it('expands class-article-feature per class and article', () => {
    const blocks: EmailTemplateBlock[] = [
      {
        type: 'class-article-feature',
        order: 0,
        visible: true,
        bodyHtml: '<p>{{class.name}} — {{article.title}}</p>',
        config: { maxItemsPerClass: 2, eyebrow: 'Eyebrow', ctaLabel: 'Read more', excerptLength: 200 },
      },
    ]
    const result = renderTemplateForRecipient(blocks, baseContext(), { wrapInDocumentShell: false })
    expect(result.html).toContain('Grade A')
    expect(result.html).toContain('Class Article')
  })

  it('expands weekly-summary-list using weeklyItems filtered by sourceTag', () => {
    const blocks: EmailTemplateBlock[] = [
      {
        type: 'weekly-summary-list',
        order: 0,
        visible: true,
        bodyHtml: '<li>{{article.title}}</li>',
        config: { sectionTitle: 'Weekly', sourceTag: 'weekly', excerptLength: 120 },
      },
    ]
    const result = renderTemplateForRecipient(blocks, baseContext(), { wrapInDocumentShell: false })
    expect(result.html).toContain('Weekly bullet')
  })

  it('skips blocks with visible: false', () => {
    const blocks: EmailTemplateBlock[] = [
      {
        type: 'custom-html',
        order: 0,
        visible: false,
        bodyHtml: '<p>hidden</p>',
        config: {},
      },
      {
        type: 'custom-html',
        order: 1,
        visible: true,
        bodyHtml: '<p>shown</p>',
        config: {},
      },
    ]
    const result = renderTemplateForRecipient(blocks, baseContext(), { wrapInDocumentShell: false })
    expect(result.html).toBe('<p>shown</p>')
    expect(result.skippedBlockCount).toBe(1)
    expect(result.renderedBlockCount).toBe(1)
  })

  it('sorts blocks by order ascending', () => {
    const blocks: EmailTemplateBlock[] = [
      {
        type: 'custom-html',
        order: 2,
        visible: true,
        bodyHtml: '<p>second</p>',
        config: {},
      },
      {
        type: 'custom-html',
        order: 1,
        visible: true,
        bodyHtml: '<p>first</p>',
        config: {},
      },
    ]
    const result = renderTemplateForRecipient(blocks, baseContext(), { wrapInDocumentShell: false })
    expect(result.html.indexOf('first')).toBeLessThan(result.html.indexOf('second'))
  })

  it('wraps output in a document shell by default', () => {
    const blocks: EmailTemplateBlock[] = [
      {
        type: 'custom-html',
        order: 0,
        visible: true,
        bodyHtml: '<p>x</p>',
        config: {},
      },
    ]
    const result = renderTemplateForRecipient(blocks, baseContext(), {
      subjectForDocumentTitle: 'Test subject',
      wrapInDocumentShell: true,
    })
    expect(result.html).toContain('<!doctype html>')
    expect(result.html).toContain('<title>Test subject</title>')
    expect(result.html).toContain('<p>x</p>')
  })

  it('returns empty inner when blocks array is empty', () => {
    const result = renderTemplateForRecipient([], baseContext(), { wrapInDocumentShell: false })
    expect(result.html).toBe('')
    expect(result.renderedBlockCount).toBe(0)
  })
})
