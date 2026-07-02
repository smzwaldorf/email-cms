import type {
  EmailBlockType,
  EmailTemplateBlock,
  EmailTemplateBlockConfig,
} from '@/types/emailTemplate'

export type RepeaterDataSource =
  | 'shared-articles'
  | 'class-articles'
  | 'weekly-items'
  | null

export interface EmailBlockTypeDefinition {
  type: EmailBlockType
  label: string
  description: string
  isRepeater: boolean
  repeaterDataSource: RepeaterDataSource
  defaultConfig: EmailTemplateBlockConfig
  /** Tokens allowed inside this block's bodyHtml in addition to the global scope. */
  innerScopeTokens: string[]
  defaultBodyHtml: string
}

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang TC', 'Microsoft JhengHei', sans-serif`

const HEADER_DEFAULT_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1f3a5f;padding:24px;">
  <tr>
    <td align="center" style="color:#ffffff;font-family:${FONT_STACK};">
      <div style="font-size:24px;font-weight:700;letter-spacing:1px;">{{brandName}}</div>
      <div style="font-size:14px;margin-top:6px;opacity:0.85;">{{tagline}}</div>
    </td>
  </tr>
</table>
`.trim()

const SHARED_ARTICLE_FEATURE_DEFAULT_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e3e7ec;border-radius:8px;margin:16px 0;">
  <tr>
    <td style="padding:20px;font-family:${FONT_STACK};color:#1f2937;">
      <div style="text-transform:uppercase;font-size:12px;letter-spacing:1.5px;color:#1f3a5f;margin-bottom:8px;">{{eyebrow}}</div>
      <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f172a;">{{article.title}}</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">{{article.excerpt}}</p>
      <a href="{{article.url}}" style="display:inline-block;padding:10px 18px;background:#1f3a5f;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;">{{ctaLabel}}</a>
    </td>
  </tr>
</table>
`.trim()

const CLASS_ARTICLE_FEATURE_DEFAULT_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-left:4px solid #1f3a5f;margin:16px 0;">
  <tr>
    <td style="padding:18px;font-family:${FONT_STACK};color:#1f2937;">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#1f3a5f;margin-bottom:6px;">{{eyebrow}} · {{class.name}}</div>
      <h3 style="margin:0 0 10px;font-size:18px;line-height:1.3;color:#0f172a;">{{article.title}}</h3>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">{{article.excerpt}}</p>
      <a href="{{article.url}}" style="display:inline-block;padding:8px 14px;background:#1f3a5f;color:#ffffff;text-decoration:none;border-radius:4px;font-size:13px;">{{ctaLabel}}</a>
    </td>
  </tr>
</table>
`.trim()

const WEEKLY_SUMMARY_LIST_DEFAULT_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;font-family:${FONT_STACK};color:#1f2937;">
  <tr>
    <td>
      <h3 style="margin:0 0 12px;font-size:18px;color:#0f172a;">{{sectionTitle}}</h3>
      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#334155;">
        <li><a href="{{article.url}}" style="color:#1f3a5f;text-decoration:none;">{{article.title}}</a> — {{article.excerpt}}</li>
      </ul>
    </td>
  </tr>
</table>
`.trim()

const SECTION_DIVIDER_DEFAULT_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="border-top:1px solid #e3e7ec;height:1px;line-height:0;font-size:0;">&nbsp;</td>
  </tr>
</table>
`.trim()

const ABOUT_DEFAULT_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;margin:24px 0;border-radius:6px;">
  <tr>
    <td style="padding:20px;font-family:${FONT_STACK};color:#1f2937;">
      <h3 style="margin:0 0 10px;font-size:16px;color:#0f172a;">About us · 認識 善美真</h3>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">{{schoolMission}}</p>
    </td>
  </tr>
</table>
`.trim()

const FOOTER_DEFAULT_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;color:#cbd5f5;margin-top:24px;">
  <tr>
    <td style="padding:20px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;">
      <div style="margin-bottom:6px;">TEL: {{tel}} · FAX: {{fax}}</div>
      <div>{{address}}</div>
    </td>
  </tr>
</table>
`.trim()

const CUSTOM_HTML_DEFAULT_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:16px;font-family:${FONT_STACK};color:#1f2937;font-size:14px;line-height:1.6;">
      Replace this block with your own HTML.
    </td>
  </tr>
</table>
`.trim()

const ARTICLE_INNER_SCOPE = ['article.title', 'article.excerpt', 'article.url', 'article.image_url']
const CLASS_INNER_SCOPE = ['class.id', 'class.code', 'class.name']

const REGISTRY: Record<EmailBlockType, EmailBlockTypeDefinition> = {
  header: {
    type: 'header',
    label: 'Header',
    description: 'Brand header with school name and tagline.',
    isRepeater: false,
    repeaterDataSource: null,
    defaultConfig: {
      brandName: 'SMZ School News',
      tagline: '善美真學校週報',
    },
    innerScopeTokens: [],
    defaultBodyHtml: HEADER_DEFAULT_HTML,
  },
  'shared-article-feature': {
    type: 'shared-article-feature',
    label: 'Shared article feature',
    description: 'Repeats once per shared article (capped by maxItems).',
    isRepeater: true,
    repeaterDataSource: 'shared-articles',
    defaultConfig: {
      eyebrow: 'Regarding school',
      maxItems: 3,
      excerptLength: 240,
      ctaLabel: 'Read more',
    },
    innerScopeTokens: ARTICLE_INNER_SCOPE,
    defaultBodyHtml: SHARED_ARTICLE_FEATURE_DEFAULT_HTML,
  },
  'class-article-feature': {
    type: 'class-article-feature',
    label: 'Class article feature',
    description: 'Repeats once per (class × article) for the recipient.',
    isRepeater: true,
    repeaterDataSource: 'class-articles',
    defaultConfig: {
      eyebrow: 'Class news & events',
      maxItemsPerClass: 2,
      excerptLength: 200,
      ctaLabel: 'Read more',
    },
    innerScopeTokens: [...ARTICLE_INNER_SCOPE, ...CLASS_INNER_SCOPE],
    defaultBodyHtml: CLASS_ARTICLE_FEATURE_DEFAULT_HTML,
  },
  'weekly-summary-list': {
    type: 'weekly-summary-list',
    label: 'Weekly summary list',
    description: 'Repeats once per weekly item filtered by sourceTag.',
    isRepeater: true,
    repeaterDataSource: 'weekly-items',
    defaultConfig: {
      sectionTitle: 'The weekly news / 本週重要事情佈達',
      sourceTag: 'weekly',
      excerptLength: 120,
    },
    innerScopeTokens: ARTICLE_INNER_SCOPE,
    defaultBodyHtml: WEEKLY_SUMMARY_LIST_DEFAULT_HTML,
  },
  'section-divider': {
    type: 'section-divider',
    label: 'Section divider',
    description: 'Visual separator between sections.',
    isRepeater: false,
    repeaterDataSource: null,
    defaultConfig: {},
    innerScopeTokens: [],
    defaultBodyHtml: SECTION_DIVIDER_DEFAULT_HTML,
  },
  about: {
    type: 'about',
    label: 'About us',
    description: 'School mission paragraph.',
    isRepeater: false,
    repeaterDataSource: null,
    defaultConfig: {
      schoolMission:
        '善美真小學致力於以全人教育與藝術人文涵養孩子的成長,陪伴每一位學生在愛與紀律中發展。',
    },
    innerScopeTokens: [],
    defaultBodyHtml: ABOUT_DEFAULT_HTML,
  },
  footer: {
    type: 'footer',
    label: 'Footer',
    description: 'Contact information block.',
    isRepeater: false,
    repeaterDataSource: null,
    defaultConfig: {
      tel: '+886-0-000-0000',
      fax: '+886-0-000-0000',
      address: '善美真小學 · School address',
      socials: [],
    },
    innerScopeTokens: [],
    defaultBodyHtml: FOOTER_DEFAULT_HTML,
  },
  'custom-html': {
    type: 'custom-html',
    label: 'Custom HTML',
    description: 'Free-form HTML block. Use sparingly.',
    isRepeater: false,
    repeaterDataSource: null,
    defaultConfig: {},
    innerScopeTokens: [],
    defaultBodyHtml: CUSTOM_HTML_DEFAULT_HTML,
  },
}

export const EMAIL_BLOCK_TYPES = Object.keys(REGISTRY) as EmailBlockType[]

export function isEmailBlockType(value: unknown): value is EmailBlockType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(REGISTRY, value)
}

export function getEmailBlockTypeDefinition(type: EmailBlockType): EmailBlockTypeDefinition {
  return REGISTRY[type]
}

export function listEmailBlockTypeDefinitions(): EmailBlockTypeDefinition[] {
  return EMAIL_BLOCK_TYPES.map((type) => REGISTRY[type])
}

export function createDefaultBlock(type: EmailBlockType, order: number): EmailTemplateBlock {
  const definition = REGISTRY[type]
  return {
    type,
    order,
    visible: true,
    bodyHtml: definition.defaultBodyHtml,
    config: { ...definition.defaultConfig },
  }
}

/**
 * Default block layout: header → main `custom-html` → footer.
 * Use for new templates, expanding legacy single-`custom-html` revisions, and import fallback.
 */
export function createStarterEmailBlocks(options?: {
  mainBodyHtml?: string
  mainConfig?: EmailTemplateBlockConfig
}): EmailTemplateBlock[] {
  const middle: EmailTemplateBlock = {
    ...createDefaultBlock('custom-html', 1),
    ...(options?.mainBodyHtml !== undefined ? { bodyHtml: options.mainBodyHtml } : {}),
    ...(options?.mainConfig !== undefined ? { config: options.mainConfig } : {}),
  }
  return [createDefaultBlock('header', 0), middle, createDefaultBlock('footer', 2)]
}

export function isRepeaterBlockType(type: EmailBlockType): boolean {
  return REGISTRY[type].isRepeater
}

/**
 * Best-effort coercion of arbitrary JSON (typically from a JSONB column) into
 * a typed `EmailTemplateBlock[]`. Unknown block types are dropped; missing
 * fields are filled from the registry defaults. Order is normalized to the
 * 0..n-1 sequence based on the input array order if `order` is missing.
 */
export function coerceEmailTemplateBlocks(value: unknown): EmailTemplateBlock[] {
  if (!Array.isArray(value)) {
    return []
  }
  const result: EmailTemplateBlock[] = []
  value.forEach((entry, index) => {
    if (entry == null || typeof entry !== 'object') {
      return
    }
    const raw = entry as Record<string, unknown>
    const type = raw.type
    if (!isEmailBlockType(type)) {
      return
    }
    const definition = REGISTRY[type]
    const orderRaw = raw.order
    const order = typeof orderRaw === 'number' && Number.isFinite(orderRaw) ? orderRaw : index
    const visible = raw.visible === false ? false : true
    const bodyHtmlRaw = raw.bodyHtml
    const bodyHtml = typeof bodyHtmlRaw === 'string' ? bodyHtmlRaw : definition.defaultBodyHtml
    const configRaw = raw.config
    const config =
      configRaw && typeof configRaw === 'object' && !Array.isArray(configRaw)
        ? (configRaw as EmailTemplateBlockConfig)
        : {}
    result.push({ type, order, visible, bodyHtml, config })
  })
  return result.sort((left, right) => left.order - right.order)
}
