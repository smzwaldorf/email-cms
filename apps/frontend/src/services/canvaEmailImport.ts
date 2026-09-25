import type { EmailBlockType, EmailTemplateBlock } from '@/types/emailTemplate'
import { createDefaultBlock } from '@/services/emailTemplateBlocks'

export type CanvaEmailImportIssueCode =
  | 'unsupported_tag'
  | 'unsupported_stylesheet'
  | 'unsafe_asset_protocol'
  | 'empty_body'

export interface CanvaEmailImportIssue {
  code: CanvaEmailImportIssueCode
  message: string
  tagName?: string
  attribute?: 'href' | 'src'
  value?: string
}

export interface CanvaEmailImportResult {
  normalizedHtml: string
  issues: CanvaEmailImportIssue[]
  hasBlockingIssues: boolean
}

const BLOCKED_TAGS = [
  'script',
  'form',
  'iframe',
  'object',
  'embed',
  'canvas',
  'video',
  'audio',
  'source',
  'input',
  'button',
  'select',
  'textarea',
] as const

function uniqueIssueKey(issue: CanvaEmailImportIssue): string {
  return JSON.stringify({
    code: issue.code,
    tagName: issue.tagName ?? null,
    attribute: issue.attribute ?? null,
    value: issue.value ?? null,
    message: issue.message,
  })
}

function stripBlockedTags(root: ParentNode, issues: Map<string, CanvaEmailImportIssue>): void {
  for (const tagName of BLOCKED_TAGS) {
    const nodes = Array.from(root.querySelectorAll(tagName))
    if (nodes.length === 0) continue

    issues.set(
      uniqueIssueKey({
        code: 'unsupported_tag',
        tagName,
        message: `匯入的電子郵件 HTML 不支援 <${tagName}> 標籤。`,
      }),
      {
        code: 'unsupported_tag',
        tagName,
        message: `匯入的電子郵件 HTML 不支援 <${tagName}> 標籤。`,
      },
    )

    for (const node of nodes) {
      node.remove()
    }
  }
}

function stripStylesheets(documentRoot: Document, container: HTMLElement, issues: Map<string, CanvaEmailImportIssue>): void {
  if (documentRoot.querySelector('style')) {
    issues.set(
      uniqueIssueKey({
        code: 'unsupported_stylesheet',
        tagName: 'style',
        message: '匯入的電子郵件範本不支援內嵌 <style> 區塊，請使用行內樣式。',
      }),
      {
        code: 'unsupported_stylesheet',
        tagName: 'style',
        message: '匯入的電子郵件範本不支援內嵌 <style> 區塊，請使用行內樣式。',
      },
    )
  }

  if (documentRoot.querySelector('link[rel~="stylesheet"]')) {
    issues.set(
      uniqueIssueKey({
        code: 'unsupported_stylesheet',
        tagName: 'link',
        message: '匯入的電子郵件範本不支援外部樣式表。',
      }),
      {
        code: 'unsupported_stylesheet',
        tagName: 'link',
        message: '匯入的電子郵件範本不支援外部樣式表。',
      },
    )
  }

  for (const node of Array.from(container.querySelectorAll('style, link[rel~="stylesheet"]'))) {
    node.remove()
  }
}

function isAllowedAssetValue(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) return true
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) return true

  return trimmed.toLowerCase().startsWith('https://')
}

function scrubUnsafeAssetProtocols(container: HTMLElement, issues: Map<string, CanvaEmailImportIssue>): void {
  for (const element of Array.from(container.querySelectorAll<HTMLElement>('[href], [src]'))) {
    const attributes: Array<'href' | 'src'> = []
    if (element.hasAttribute('href')) attributes.push('href')
    if (element.hasAttribute('src')) attributes.push('src')

    for (const attribute of attributes) {
      const value = element.getAttribute(attribute)?.trim() ?? ''
      if (isAllowedAssetValue(value)) continue

      issues.set(
        uniqueIssueKey({
          code: 'unsafe_asset_protocol',
          attribute,
          value,
          message: `匯入的電子郵件 HTML 資源連結必須使用 HTTPS。無效的 ${attribute}：${value}`,
        }),
        {
          code: 'unsafe_asset_protocol',
          attribute,
          value,
          message: `匯入的電子郵件 HTML 資源連結必須使用 HTTPS。無效的 ${attribute}：${value}`,
        },
      )
      element.removeAttribute(attribute)
    }
  }
}

function hasMeaningfulContent(container: HTMLElement): boolean {
  const text = container.textContent?.replace(/\u00a0/g, ' ').trim() ?? ''
  if (text.length > 0) {
    return true
  }

  return container.querySelector('img, table, tr, td, th, a, div, p, section, article') !== null
}

export function normalizeCanvaEmailHtml(rawHtml: string): CanvaEmailImportResult {
  const parser = new DOMParser()
  const documentRoot = parser.parseFromString(rawHtml, 'text/html')
  const bodyHtml = documentRoot.body?.innerHTML?.trim() ?? ''
  const containerDocument = parser.parseFromString('<body></body>', 'text/html')
  const container = containerDocument.body

  container.innerHTML = bodyHtml

  const issues = new Map<string, CanvaEmailImportIssue>()
  stripStylesheets(documentRoot, container, issues)
  stripBlockedTags(documentRoot, issues)
  stripBlockedTags(container, issues)
  scrubUnsafeAssetProtocols(container, issues)

  const normalizedHtml = container.innerHTML.trim()
  if (!hasMeaningfulContent(container)) {
    issues.set(
      uniqueIssueKey({
        code: 'empty_body',
        message: '整理後的電子郵件 HTML 沒有可用的內文。',
      }),
      {
        code: 'empty_body',
        message: '整理後的電子郵件 HTML 沒有可用的內文。',
      },
    )
  }

  return {
    normalizedHtml,
    issues: Array.from(issues.values()),
    hasBlockingIssues: issues.size > 0,
  }
}

/**
 * Detection signal order (per design Decision: Canva import maps detected
 * sections to typed blocks, falls back to `custom-html`):
 *
 * 1. Explicit HTML comment markers `<!-- block:<type> -->` ... `<!-- /block -->`
 *    so designers can override the heuristic.
 * 2. Heading/text patterns matching the `善美真email Newsletter` Canva file.
 * 3. If neither yields at least three matched sections, return `null` so the
 *    importer falls back to a single `custom-html` block.
 */
export function detectCanvaSections(html: string): EmailTemplateBlock[] | null {
  const trimmed = (html ?? '').trim()
  if (trimmed.length === 0) {
    return null
  }
  const markerBlocks = detectMarkerSections(trimmed)
  if (markerBlocks && markerBlocks.length >= 3) {
    return markerBlocks
  }
  const heuristicBlocks = detectHeuristicSections(trimmed)
  if (heuristicBlocks && heuristicBlocks.length >= 3) {
    return heuristicBlocks
  }
  return null
}

const KNOWN_BLOCK_TYPES: ReadonlySet<EmailBlockType> = new Set([
  'header',
  'shared-article-feature',
  'class-article-feature',
  'weekly-summary-list',
  'section-divider',
  'about',
  'footer',
  'custom-html',
])

const MARKER_PATTERN = /<!--\s*block:([a-z0-9-]+)\s*-->([\s\S]*?)<!--\s*\/block\s*-->/gi

function detectMarkerSections(html: string): EmailTemplateBlock[] | null {
  const blocks: EmailTemplateBlock[] = []
  let match: RegExpExecArray | null
  let order = 0
  MARKER_PATTERN.lastIndex = 0
  while ((match = MARKER_PATTERN.exec(html)) !== null) {
    const declaredType = match[1].trim().toLowerCase() as EmailBlockType
    if (!KNOWN_BLOCK_TYPES.has(declaredType)) {
      continue
    }
    const segment = (match[2] ?? '').trim()
    if (segment.length === 0) {
      continue
    }
    blocks.push({
      ...createDefaultBlock(declaredType, order),
      bodyHtml: segment,
    })
    order += 1
  }
  return blocks.length > 0 ? blocks : null
}

interface HeuristicRule {
  type: EmailBlockType
  matches: (text: string, html: string) => boolean
}

const HEURISTIC_RULES: HeuristicRule[] = [
  {
    type: 'header',
    matches: (text) => /smz\s*school\s*news/i.test(text),
  },
  {
    type: 'shared-article-feature',
    matches: (text) => /regarding\s+school/i.test(text),
  },
  {
    type: 'class-article-feature',
    matches: (text) => /class\s+news\s*&?\s*events/i.test(text),
  },
  {
    type: 'weekly-summary-list',
    matches: (text) => /the\s+weekly\s+news/i.test(text) || /本週重要事情佈達/.test(text),
  },
  {
    type: 'about',
    matches: (text) => /about\s+us/i.test(text) || /認識\s*善美真/.test(text),
  },
  {
    type: 'footer',
    matches: (text) => /\btel\b/i.test(text) && /\bfax\b/i.test(text),
  },
]

function detectHeuristicSections(html: string): EmailTemplateBlock[] | null {
  if (typeof DOMParser === 'undefined') {
    return null
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body
  if (!body) {
    return null
  }
  // Walk only top-level children so we never split an inline element across blocks.
  const children = Array.from(body.children) as HTMLElement[]
  if (children.length === 0) {
    return null
  }
  type Bucket = { type: EmailBlockType; nodes: HTMLElement[] }
  const buckets: Bucket[] = []
  let currentBucket: Bucket | null = null
  for (const node of children) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    const detectedType = classifyHeuristicNode(text, node.outerHTML)
    if (detectedType) {
      currentBucket = { type: detectedType, nodes: [node] }
      buckets.push(currentBucket)
      continue
    }
    if (currentBucket) {
      currentBucket.nodes.push(node)
    }
    // Nodes that appear before any classified heading are dropped from the
    // typed-block path; they survive in the normalized HTML used by the
    // `custom-html` fallback. This keeps detected sections clean.
  }
  if (buckets.length === 0) {
    return null
  }
  return buckets.map((bucket, index) => {
    const bodyHtml = bucket.nodes.map((node) => node.outerHTML).join('\n').trim()
    return {
      ...createDefaultBlock(bucket.type, index),
      bodyHtml,
    }
  })
}

function classifyHeuristicNode(text: string, html: string): EmailBlockType | null {
  for (const rule of HEURISTIC_RULES) {
    if (rule.matches(text, html)) {
      return rule.type
    }
  }
  return null
}
