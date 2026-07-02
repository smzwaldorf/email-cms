import { describe, expect, it } from 'vitest'

import {
  createFileEmailTemplateRegistry,
  renderLoadedFileEmailTemplatePreview,
} from '@/services/fileEmailTemplateLoader'
import type { FileEmailTemplateRenderContext } from '@/types/fileEmailTemplate'

const rawFiles: Record<string, string> = {
  '/templates/email/mixed/metadata.json': JSON.stringify({
    sourceId: 'mixed',
    name: 'Mixed file template',
    subject: 'subject.hbs',
    blocks: [
      {
        id: 'header',
        mode: 'static',
        type: 'header',
        file: 'blocks/header.hbs',
        order: 0,
      },
      {
        id: 'featured',
        mode: 'article-repeat',
        type: 'shared-article-feature',
        file: 'blocks/article.hbs',
        order: 1,
        articleSource: 'sharedArticles',
        config: { maxItems: 3 },
      },
      {
        id: 'class-news',
        mode: 'class-article-repeat',
        type: 'class-article-feature',
        file: 'blocks/class-article.hbs',
        order: 2,
        config: { maxItemsPerClass: 2 },
      },
      {
        id: 'body-slot',
        mode: 'custom-html',
        type: 'custom-html',
        file: 'blocks/custom-html.hbs',
        order: 3,
        htmlSlot: 'bodySlot',
      },
      {
        id: 'footer',
        mode: 'static',
        type: 'footer',
        file: 'blocks/footer.hbs',
        order: 4,
      },
    ],
  }),
  '/templates/email/mixed/subject.hbs': 'Hello {{guardian.email}}',
  '/templates/email/mixed/blocks/header.hbs': '<h1>{{newsletter.id}}</h1>',
  '/templates/email/mixed/blocks/article.hbs': '<article>{{article.title}}</article>',
  '/templates/email/mixed/blocks/class-article.hbs': '<section>{{class.name}}:{{article.title}}</section>',
  '/templates/email/mixed/blocks/custom-html.hbs': '<main>{{{html.bodySlot}}}</main>',
  '/templates/email/mixed/blocks/footer.hbs': '<footer>{{classes.count}}</footer>',
}

function renderPreview(contextOverrides: Partial<FileEmailTemplateRenderContext> = {}) {
  const registry = createFileEmailTemplateRegistry(rawFiles)
  const loaded = registry.loadSource('mixed')
  if (!loaded) {
    throw new Error('Expected test file template source to load.')
  }
  return renderLoadedFileEmailTemplatePreview(loaded, {
    templateContext: {
      guardian: { id: 'guardian-1', email: 'guardian@example.com' },
      family: { id: 'family-1' },
      newsletter: { id: 'newsletter-1', revisionId: 'revision-1' },
      classes: { ids: ['class-a', 'class-b'] },
    },
    sharedArticles: [
      { id: 'a', title: 'A', excerpt: 'A excerpt', url: 'https://example.com/a' },
      { id: 'b', title: 'B', excerpt: 'B excerpt', url: 'https://example.com/b' },
      { id: 'c', title: 'C', excerpt: 'C excerpt', url: 'https://example.com/c' },
    ],
    classes: [
      {
        id: 'class-a',
        code: 'A',
        name: 'Class A',
        articles: [
          { id: 'a1', title: 'A1', excerpt: 'A1 excerpt', url: 'https://example.com/a1' },
          { id: 'a2', title: 'A2', excerpt: 'A2 excerpt', url: 'https://example.com/a2' },
        ],
      },
      {
        id: 'class-b',
        code: 'B',
        name: 'Class B',
        articles: [
          { id: 'b1', title: 'B1', excerpt: 'B1 excerpt', url: 'https://example.com/b1' },
        ],
      },
    ],
    weeklyItems: [],
    injectedHtml: {
      bodySlot: '<strong>Injected once</strong>',
    },
    ...contextOverrides,
  })
}

describe('fileEmailTemplateLoader', () => {
  it('maps mixed manifest blocks to ordered visible EmailTemplateBlock records', () => {
    const preview = renderPreview()

    expect(preview.valid).toBe(true)
    expect(preview.blocks.map((block) => block.type)).toEqual([
      'header',
      'shared-article-feature',
      'class-article-feature',
      'custom-html',
      'footer',
    ])
    expect(preview.blocks.map((block) => block.order)).toEqual([0, 1, 2, 3, 4])
    expect(preview.blocks.every((block) => block.visible)).toBe(true)
    expect(preview.blocks[1].bodyHtml).toBe('<article>{{article.title}}</article>')
  })

  it('renders one article-repeat preview fragment per shared article in order', () => {
    const preview = renderPreview()

    expect(preview.blockPreviews[1].renderedFragments).toEqual([
      '<article>A</article>',
      '<article>B</article>',
      '<article>C</article>',
    ])
  })

  it('renders class-article-repeat fragments in class and article order', () => {
    const preview = renderPreview()

    expect(preview.blockPreviews[2].renderedFragments).toEqual([
      '<section>Class A:A1</section>',
      '<section>Class A:A2</section>',
      '<section>Class B:B1</section>',
    ])
  })

  it('renders custom-html exactly once without expanding over shared articles', () => {
    const preview = renderPreview()

    expect(preview.blockPreviews[3].renderedFragments).toEqual([
      '<main><strong>Injected once</strong></main>',
    ])
    expect(preview.bodyHtml.match(/Injected once/g)).toHaveLength(1)
  })
})
