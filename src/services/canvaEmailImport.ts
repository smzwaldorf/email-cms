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
        message: `Unsupported <${tagName}> tag is not allowed in imported email HTML.`,
      }),
      {
        code: 'unsupported_tag',
        tagName,
        message: `Unsupported <${tagName}> tag is not allowed in imported email HTML.`,
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
        message: 'Embedded <style> blocks are not supported for imported email templates. Use inline styles only.',
      }),
      {
        code: 'unsupported_stylesheet',
        tagName: 'style',
        message: 'Embedded <style> blocks are not supported for imported email templates. Use inline styles only.',
      },
    )
  }

  if (documentRoot.querySelector('link[rel~="stylesheet"]')) {
    issues.set(
      uniqueIssueKey({
        code: 'unsupported_stylesheet',
        tagName: 'link',
        message: 'External stylesheets are not supported for imported email templates.',
      }),
      {
        code: 'unsupported_stylesheet',
        tagName: 'link',
        message: 'External stylesheets are not supported for imported email templates.',
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
          message: `Imported email HTML requires HTTPS asset links. Invalid ${attribute}: ${value}`,
        }),
        {
          code: 'unsafe_asset_protocol',
          attribute,
          value,
          message: `Imported email HTML requires HTTPS asset links. Invalid ${attribute}: ${value}`,
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
        message: 'Imported email HTML did not contain a usable body fragment after normalization.',
      }),
      {
        code: 'empty_body',
        message: 'Imported email HTML did not contain a usable body fragment after normalization.',
      },
    )
  }

  return {
    normalizedHtml,
    issues: Array.from(issues.values()),
    hasBlockingIssues: issues.size > 0,
  }
}
