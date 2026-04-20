import type { EmailBlockType, EmailTemplateBlock } from '@/types/emailTemplate'
import { getEmailBlockTypeDefinition } from '@/services/emailTemplateBlocks'
import {
  buildGlobalTokenScope,
  expandTemplateString,
  type EmailTemplateRenderContext,
} from '@/services/emailTemplateTokens'

export interface RecipientArticle {
  id: string
  title: string
  excerpt: string
  url: string
  imageUrl?: string | null
  /** Optional tag used by `weekly-summary-list` repeater filtering. */
  sourceTag?: string | null
}

export interface RecipientClass {
  id: string
  code?: string | null
  name?: string | null
  /** Articles eligible for this class for this recipient, in canonical order. */
  articles: RecipientArticle[]
}

export interface RecipientRenderContext {
  /** Global token scope source. */
  templateContext: EmailTemplateRenderContext
  /** Shared (cross-class) articles in canonical order. */
  sharedArticles: RecipientArticle[]
  /** Eligible classes (canonical order) with their per-class articles. */
  classes: RecipientClass[]
  /** Weekly bullet items (cross-class) in canonical order. */
  weeklyItems: RecipientArticle[]
}

export interface RenderTemplateForRecipientResult {
  html: string
  missingTokens: string[]
  renderedBlockCount: number
  skippedBlockCount: number
}

const SHARED_ITEMS_DEFAULT = 3
const CLASS_ITEMS_PER_CLASS_DEFAULT = 2

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function asPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  return fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function clampExcerpt(excerpt: string, length: unknown): string {
  const limit = asPositiveInt(length, 0)
  if (limit <= 0 || excerpt.length <= limit) {
    return excerpt
  }
  return `${excerpt.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function configScope(config: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(config)) {
    if (value === null || value === undefined) {
      continue
    }
    if (typeof value === 'string') {
      out[key] = value
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value)
    }
  }
  return out
}

function articleScope(article: RecipientArticle, excerptLength?: unknown): Record<string, string> {
  const excerpt = clampExcerpt(article.excerpt ?? '', excerptLength)
  return {
    'article.title': article.title ?? '',
    'article.excerpt': excerpt,
    'article.url': article.url ?? '',
    'article.image_url': article.imageUrl ?? '',
  }
}

function classScope(klass: RecipientClass): Record<string, string> {
  return {
    'class.id': klass.id,
    'class.code': klass.code ?? '',
    'class.name': klass.name ?? klass.code ?? klass.id,
  }
}

function renderStaticBlock(
  block: EmailTemplateBlock,
  globalScope: Record<string, string>,
): { html: string; missingTokens: string[] } {
  const scope: Record<string, string> = { ...globalScope, ...configScope(block.config) }
  return expandTemplateString(block.bodyHtml, scope)
}

function renderRepeaterBlock(
  block: EmailTemplateBlock,
  context: RecipientRenderContext,
  globalScope: Record<string, string>,
): { html: string; missingTokens: string[] } {
  const config = block.config
  const definition = getEmailBlockTypeDefinition(block.type)
  if (definition.repeaterDataSource === 'shared-articles') {
    const max = asPositiveInt(config.maxItems, SHARED_ITEMS_DEFAULT)
    const items = context.sharedArticles.slice(0, max)
    return renderRepeaterItems(items, block, globalScope, (article) => articleScope(article, config.excerptLength))
  }
  if (definition.repeaterDataSource === 'class-articles') {
    const maxPerClass = asPositiveInt(config.maxItemsPerClass, CLASS_ITEMS_PER_CLASS_DEFAULT)
    const fragments: string[] = []
    const missing: string[] = []
    for (const klass of context.classes) {
      const items = klass.articles.slice(0, maxPerClass)
      const klassScopeMap = classScope(klass)
      for (const article of items) {
        const scope: Record<string, string> = {
          ...globalScope,
          ...configScope(block.config),
          ...klassScopeMap,
          ...articleScope(article, config.excerptLength),
        }
        const result = expandTemplateString(block.bodyHtml, scope)
        fragments.push(result.html)
        missing.push(...result.missingTokens)
      }
    }
    return { html: fragments.join('\n'), missingTokens: dedupe(missing) }
  }
  if (definition.repeaterDataSource === 'weekly-items') {
    const sourceTag = asNullableString(config.sourceTag)
    const filtered = sourceTag
      ? context.weeklyItems.filter((item) => asNullableString(item.sourceTag) === sourceTag)
      : context.weeklyItems
    return renderRepeaterItems(filtered, block, globalScope, (article) =>
      articleScope(article, config.excerptLength),
    )
  }
  return { html: '', missingTokens: [] }
}

function renderRepeaterItems(
  items: RecipientArticle[],
  block: EmailTemplateBlock,
  globalScope: Record<string, string>,
  buildItemScope: (article: RecipientArticle) => Record<string, string>,
): { html: string; missingTokens: string[] } {
  const fragments: string[] = []
  const missing: string[] = []
  for (const item of items) {
    const scope: Record<string, string> = {
      ...globalScope,
      ...configScope(block.config),
      ...buildItemScope(item),
    }
    const result = expandTemplateString(block.bodyHtml, scope)
    fragments.push(result.html)
    missing.push(...result.missingTokens)
  }
  return { html: fragments.join('\n'), missingTokens: dedupe(missing) }
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function wrapDocument(innerHtml: string, subjectFallback: string): string {
  const safeSubject = asNonEmptyString(subjectFallback, 'Newsletter')
  return [
    '<!doctype html>',
    '<html lang="zh-Hant">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtml(safeSubject)}</title>`,
    '</head>',
    '<body style="margin:0;padding:0;background:#f1f5f9;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">',
    '<tr><td align="center">',
    '<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;">',
    '<tr><td>',
    innerHtml,
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Render a recipient's email body by walking a typed `EmailTemplateBlock[]`.
 *
 * - Skips blocks with `visible: false`.
 * - Sorts by `order` (ascending). Ties broken by source array order.
 * - Static blocks (`header`, `section-divider`, `about`, `footer`, `custom-html`)
 *   are rendered once per recipient with the global token scope plus the block's
 *   own `config` keys.
 * - Repeater blocks expand over the recipient's article/class data:
 *   * `shared-article-feature` → `context.sharedArticles` capped by `config.maxItems`
 *   * `class-article-feature`  → `context.classes` × per-class `articles` capped by `config.maxItemsPerClass`
 *   * `weekly-summary-list`    → `context.weeklyItems` filtered by `config.sourceTag`
 *
 * Returns the wrapped HTML document plus deduplicated missing-token diagnostics.
 *
 * The function is pure: identical inputs produce byte-identical output, which
 * is what `personalizedEmailComposer` relies on to compute a stable fingerprint.
 */
export function renderTemplateForRecipient(
  blocks: EmailTemplateBlock[],
  context: RecipientRenderContext,
  options?: { subjectForDocumentTitle?: string; wrapInDocumentShell?: boolean },
): RenderTemplateForRecipientResult {
  const globalScope = buildGlobalTokenScope(context.templateContext)
  const ordered = [...blocks].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order
    }
    return blocks.indexOf(left) - blocks.indexOf(right)
  })
  const fragments: string[] = []
  const missing: string[] = []
  let renderedCount = 0
  let skippedCount = 0
  for (const block of ordered) {
    if (block.visible === false) {
      skippedCount += 1
      continue
    }
    const definition = getEmailBlockTypeDefinition(block.type as EmailBlockType)
    if (definition.isRepeater) {
      const { html, missingTokens } = renderRepeaterBlock(block, context, globalScope)
      if (html.length > 0) {
        fragments.push(html)
        renderedCount += 1
      }
      missing.push(...missingTokens)
    } else {
      const { html, missingTokens } = renderStaticBlock(block, globalScope)
      fragments.push(html)
      renderedCount += 1
      missing.push(...missingTokens)
    }
  }
  const inner = fragments.join('\n')
  const wrapInShell = options?.wrapInDocumentShell !== false
  const html = wrapInShell ? wrapDocument(inner, options?.subjectForDocumentTitle ?? '') : inner
  return {
    html,
    missingTokens: dedupe(missing),
    renderedBlockCount: renderedCount,
    skippedBlockCount: skippedCount,
  }
}
