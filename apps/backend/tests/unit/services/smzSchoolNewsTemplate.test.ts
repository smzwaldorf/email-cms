import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  loadFileEmailTemplateSource,
  renderLoadedFileEmailTemplatePreview,
} from '@/services/fileEmailTemplateLoader'
import { createDefaultFileEmailTemplateRenderContext } from '@/services/fileEmailTemplatePreviewContext'
import { composePersonalizedEmails } from '@/services/personalizedEmailComposer'
import type { ComposePersonalizedEmailInput } from '@/types/personalization'
import type { FileEmailTemplatePreviewResult } from '@/types/fileEmailTemplate'

/** Cloudflare Pages project that serves the sliced design artwork (scripts/email-assets-deploy.mjs). */
const ASSET_BASE_URL = 'https://smz-email-assets.pages.dev/smz-school-news'

function loadPreview(): FileEmailTemplatePreviewResult {
  const loaded = loadFileEmailTemplateSource('smz-school-news')
  if (!loaded) {
    throw new Error('Expected bundled smz-school-news template source to load from disk.')
  }
  return renderLoadedFileEmailTemplatePreview(loaded, createDefaultFileEmailTemplateRenderContext())
}

function buildComposeInput(preview: FileEmailTemplatePreviewResult): ComposePersonalizedEmailInput {
  const displayDate = 'Monday September 2025'
  return {
    rulesVersion: 'v1',
    snapshotCapturedAt: '2025-09-15T08:00:00.000Z',
    classes: [
      { id: 'class-a', classCode: 'A1', className: '癸卯班', canonicalSortKey: '01-A' },
      { id: 'class-b', classCode: 'B1', className: '癸巳班', canonicalSortKey: '02-B' },
    ],
    newsletter: {
      newsletterId: 'newsletter-w38',
      newsletterRevisionId: 'rev-w38',
      title: '第38週校園週報',
      url: 'https://school.example/week/2025-W38',
      sharedBlocks: [
        {
          blockId: 'shared-feature',
          title: '中小學善話',
          content: '<p>今年的教師節我們所有的老師都得到了一個非常了不起的驚喜。</p>',
          url: 'https://school.example/week/2025-W38/shared-feature',
          imageUrl: 'https://school.example/media/shared-feature.jpg',
          date: displayDate,
          sourceTag: null,
          editorialOrder: 1,
          personalizationKey: 'article:shared-feature',
        },
        {
          blockId: 'weekly-admin-notice',
          title: '行政處公告',
          content: '<p>一早孩子和開心的在校園預備，像小螞蟻一樣合力搬著大桌椅。</p>',
          url: 'https://school.example/week/2025-W38/weekly-admin-notice',
          imageUrl: 'https://school.example/media/weekly-admin-notice.jpg',
          date: displayDate,
          sourceTag: 'weekly',
          editorialOrder: 2,
          personalizationKey: 'article:weekly-admin-notice',
        },
      ],
      classBlocks: [
        {
          blockId: 'class-a-story',
          classId: 'class-a',
          title: '癸卯班大小事',
          content: '<p>開學至今，我們一步步預備著週開幕慶典。</p>',
          url: 'https://school.example/week/2025-W38/class-a-story',
          imageUrl: 'https://school.example/media/class-a-story.jpg',
          date: displayDate,
          sourceTag: null,
          editorialOrder: 3,
          personalizationKey: 'article:class-a-story',
        },
        {
          blockId: 'class-b-story',
          classId: 'class-b',
          title: '癸巳班成果發表',
          content: '<p>太陽帶著愛的光芒 給我明亮的一天。</p>',
          url: 'https://school.example/week/2025-W38/class-b-story',
          imageUrl: 'https://school.example/media/class-b-story.jpg',
          date: displayDate,
          sourceTag: null,
          editorialOrder: 4,
          personalizationKey: 'article:class-b-story',
        },
      ],
    },
    template: {
      templateId: 'template-smz',
      templateRevisionId: 'template-smz-rev-1',
      subjectTemplate: preview.subjectTemplate,
      bodyTemplate: preview.bodyHtml,
      blocks: preview.blocks,
    },
    guardians: [
      {
        guardianId: 'guardian-a',
        guardianEmail: 'parent.a@example.com',
        familyId: 'family-a',
        children: [{ studentId: 'student-a', studentName: '小明', classId: 'class-a' }],
      },
      {
        guardianId: 'guardian-b',
        guardianEmail: 'parent.b@example.com',
        familyId: 'family-b',
        children: [{ studentId: 'student-b', studentName: '小華', classId: 'class-b' }],
      },
    ],
  }
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

describe('smz-school-news file template bundle', () => {
  it('loads from disk and passes validation', () => {
    const preview = loadPreview()

    expect(preview.valid).toBe(true)
    expect(preview.issues.filter((issue) => issue.severity === 'error')).toHaveLength(0)
    expect(preview.blocks.map((block) => block.type)).toEqual([
      'header',
      'shared-article-feature',
      'class-article-feature',
      'section-divider',
      'weekly-summary-list',
      'custom-html',
      'custom-html',
      'about',
      'footer',
    ])
  })

  it('hides optional brand assets and links until they are configured', () => {
    const preview = loadPreview()
    const blockById = new Map(
      preview.blocks.map((block) => [String(block.config.fileTemplateBlockId), block]),
    )

    // The masthead is a single slice of the design (logo, lettering and script title).
    const header = blockById.get('header')
    expect(header?.bodyHtml).toContain(`<img src="${ASSET_BASE_URL}/header-banner.jpg" width="640"`)
    expect(header?.bodyHtml).toContain('alt="善美真華德福教育 — SMZ School News"')

    // About panel renders the mission text-only when no portrait is configured.
    const about = blockById.get('about')
    expect(about?.bodyHtml).toContain('認識 善美真')
    expect(about?.bodyHtml).toContain('取名「善美真」')
    expect(about?.bodyHtml).toContain(`src="${ASSET_BASE_URL}/about-title.png"`)
    expect(about?.bodyHtml).not.toContain('border-radius:46%')

    // Footer only renders social icons for configured destinations.
    const footer = blockById.get('footer')
    expect(footer?.bodyHtml).toContain('https://www.facebook.com/smzwaldorf')
    expect(footer?.bodyHtml).toContain('alt="Facebook"')
    expect(footer?.bodyHtml).toContain('04-26263111')
    expect(footer?.bodyHtml).not.toContain('mailto:')
    expect(footer?.bodyHtml).not.toContain('alt="Instagram"')
    expect(footer?.bodyHtml).not.toContain('alt="Website"')
  })

  it('references the sliced design artwork over https (Resend rejects data: URIs)', () => {
    const preview = loadPreview()
    const blockById = new Map(
      preview.blocks.map((block) => [String(block.config.fileTemplateBlockId), block]),
    )

    // Partials are resolved at sync time, so no `{{> asset...}}` references leak into blocks.
    for (const block of preview.blocks) {
      expect(block.bodyHtml).not.toContain('{{>')
      expect(block.bodyHtml).not.toContain('data:image/')
    }
    expect(blockById.get('weekly-divider')?.bodyHtml).toContain(
      `<img src="${ASSET_BASE_URL}/weekly-banner.jpg" width="640"`,
    )
    expect(blockById.get('footer')?.bodyHtml).toContain(`<img src="${ASSET_BASE_URL}/rule.jpg" width="568"`)
    expect(blockById.get('footer')?.bodyHtml).toContain(`<img src="${ASSET_BASE_URL}/icon-facebook.jpg"`)

    // Every referenced asset ships in the template's assets/ folder (published by scripts/email-assets-deploy.mjs).
    const referenced = Array.from(preview.bodyHtml.matchAll(new RegExp(`${ASSET_BASE_URL}/([a-z0-9.-]+)`, 'g'))).map(
      (match) => match[1],
    )
    expect(referenced.length).toBeGreaterThan(0)
    for (const file of new Set(referenced)) {
      expect(existsSync(path.resolve(__dirname, '../../../templates/email/smz-school-news/assets', file))).toBe(true)
    }
  })

  it('preserves delivery tokens in the synced block snapshot', () => {
    const preview = loadPreview()
    const blockById = new Map(
      preview.blocks.map((block) => [String(block.config.fileTemplateBlockId), block]),
    )

    const featured = blockById.get('featured-school-articles')
    expect(featured?.bodyHtml).toContain('{{article.title}}')
    expect(featured?.bodyHtml).toContain('{{article.image_url}}')
    expect(featured?.bodyHtml).toContain('{{article.url}}')
    expect(featured?.config.excludeSourceTag).toBe('weekly')

    const classNews = blockById.get('class-news')
    expect(classNews?.bodyHtml).toContain('{{class.name}}')
    expect(classNews?.bodyHtml).toContain('{{article.image_url}}')

    const weeklyItems = blockById.get('weekly-items')
    expect(weeklyItems?.bodyHtml).toContain('{{article.date}}')
    expect(weeklyItems?.config.sourceTag).toBe('weekly')

    const readMore = blockById.get('read-more-cta')
    expect(readMore?.bodyHtml).toContain('{{newsletter.url}}')

    // Static copy from the manifest config is baked at sync time.
    const header = blockById.get('header')
    expect(header?.bodyHtml).toContain('善美真華德福教育')
    expect(header?.bodyHtml).toContain('SMZ School News')
  })

  it('mail-merges per class: each parent only sees their classes and all tokens resolve', () => {
    const preview = loadPreview()
    const result = composePersonalizedEmails(buildComposeInput(preview))

    expect(result.payloads).toHaveLength(2)
    const [payloadA, payloadB] = result.payloads

    // Subject comes from the template subject line.
    expect(payloadA.renderedSubject).toBe('SMZ School News｜第38週校園週報')

    const bodyA = payloadA.renderedBody ?? ''
    const bodyB = payloadB.renderedBody ?? ''

    // Class targeting: parents only receive their own class news.
    expect(bodyA).toContain('癸卯班大小事')
    expect(bodyA).not.toContain('癸巳班成果發表')
    expect(bodyB).toContain('癸巳班成果發表')
    expect(bodyB).not.toContain('癸卯班大小事')

    // Shared featured card renders for everyone (title appears in image alt + heading).
    expect(countOccurrences(bodyA, '中小學善話')).toBe(2)

    // Weekly-tagged article renders once in the announcements list, not as a card.
    expect(countOccurrences(bodyA, '行政處公告')).toBe(1)
    expect(bodyA).toContain('Monday September 2025')

    // Mail-merge values resolve: images, article links, newsletter link.
    expect(bodyA).toContain('https://school.example/media/shared-feature.jpg')
    expect(bodyA).toContain('https://school.example/media/class-a-story.jpg')
    expect(bodyA).toContain('https://school.example/week/2025-W38/class-a-story')
    expect(bodyA).toContain('https://school.example/week/2025-W38')

    // Design copy from the manifest survives into the personalized email.
    expect(bodyA).toContain('本週重要事情佈達')
    expect(bodyA).toContain('The weekly news')
    expect(bodyA).toContain('REGARDING SCHOOL')
    expect(bodyA).toContain('CLASS NEWS &amp; EVENTS · 癸卯班')
    expect(bodyA).toContain('About us')
    expect(bodyA).toContain('善美真華德福實驗教育機構')
    // Hosted artwork survives personalization untouched.
    expect(bodyA).toContain(`src="${ASSET_BASE_URL}/header-banner.jpg"`)

    // Wrapped as a complete HTML document for delivery.
    expect(bodyA).toContain('<!doctype html>')

    // No unresolved template values: preparation must not block any recipient.
    expect(result.warnings.filter((warning) => warning.code === 'missing_template_value')).toEqual([])
  })
})
