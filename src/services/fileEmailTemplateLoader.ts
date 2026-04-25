import Handlebars from 'handlebars'
import { isEmailBlockType } from '@/services/emailTemplateBlocks'
import type { EmailBlockType, EmailTemplateBlock } from '@/types/emailTemplate'
import type {
  FileEmailTemplateBlockPreview,
  FileEmailTemplateManifest,
  FileEmailTemplateManifestBlock,
  FileEmailTemplateManifestPartial,
  FileEmailTemplatePreviewResult,
  FileEmailTemplateSourceId,
  FileEmailTemplateSourceMetadata,
  FileEmailTemplateRenderContext,
  FileEmailTemplateValidationIssue,
} from '@/types/fileEmailTemplate'
import type { RecipientArticle, RecipientClass } from '@/services/emailTemplateRenderer'

const TEMPLATE_ROOT = 'templates/email'
const METADATA_FILE = 'metadata.json'
const SUPPORTED_BLOCK_MODES = new Set<string>([
  'static',
  'article-repeat',
  'class-article-repeat',
  'weekly-repeat',
  'custom-html',
])
const PARTIAL_REFERENCE_PATTERN = /\{\{>\s*([a-zA-Z0-9_-]+)/g

const bundledTemplateFiles = import.meta.glob<string>('../../templates/email/**/*.{json,hbs,html}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

type RenderScopeScalar =
  | string
  | number
  | boolean
  | null
  | undefined
  | InstanceType<typeof Handlebars.SafeString>

export interface LoadedFileEmailTemplateSource {
  source: FileEmailTemplateSourceMetadata
  manifest: FileEmailTemplateManifest
  files: ReadonlyMap<string, string>
}

export interface FileEmailTemplateRegistry {
  listSourceIds(): FileEmailTemplateSourceId[]
  listSources(): FileEmailTemplateSourceMetadata[]
  loadSource(sourceId: FileEmailTemplateSourceId): LoadedFileEmailTemplateSource | null
  readSourceFile(sourceId: FileEmailTemplateSourceId, filePath: string): string | null
}

export interface FileHandlebarsRenderResult {
  html: string
  error?: string
}

interface FileTemplateRenderScope {
  guardian: {
    id: RenderScopeScalar
    email: RenderScopeScalar
  }
  family: {
    id: RenderScopeScalar
  }
  newsletter: {
    id: RenderScopeScalar
    revisionId: RenderScopeScalar
  }
  classes: {
    ids: string[]
    count: unknown
    list: unknown
  }
  article?: ReturnType<typeof toArticleScope>
  class?: ReturnType<typeof toClassScope>
  weeklyItem?: ReturnType<typeof toArticleScope>
  html: Record<string, string>
  [key: string]: unknown
}

interface SourceFileBundle {
  sourceId: FileEmailTemplateSourceId
  files: Map<string, string>
}

export function createFileEmailTemplateRegistry(
  rawFiles: Record<string, string> = bundledTemplateFiles,
): FileEmailTemplateRegistry {
  const bundles = groupFilesBySource(rawFiles)

  function loadSource(sourceId: FileEmailTemplateSourceId): LoadedFileEmailTemplateSource | null {
    const bundle = bundles.get(sourceId)
    if (!bundle) {
      return null
    }
    const metadata = bundle.files.get(METADATA_FILE)
    if (!metadata) {
      return null
    }
    const manifest = parseManifest(metadata, sourceId)
    if (!manifest) {
      return null
    }
    return {
      source: toSourceMetadata(sourceId, manifest, bundle.files),
      manifest,
      files: bundle.files,
    }
  }

  return {
    listSourceIds: () => Array.from(bundles.keys()).sort(compareSourceIds),
    listSources: () =>
      Array.from(bundles.keys())
        .sort(compareSourceIds)
        .map((sourceId) => loadSource(sourceId)?.source)
        .filter((source): source is FileEmailTemplateSourceMetadata => source !== undefined),
    loadSource,
    readSourceFile: (sourceId, filePath) => {
      const bundle = bundles.get(sourceId)
      if (!bundle) {
        return null
      }
      return bundle.files.get(normalizeTemplatePath(filePath)) ?? null
    },
  }
}

export const fileEmailTemplateRegistry = createFileEmailTemplateRegistry()

export function listFileEmailTemplateSources(): FileEmailTemplateSourceMetadata[] {
  return fileEmailTemplateRegistry.listSources()
}

export function loadFileEmailTemplateSource(
  sourceId: FileEmailTemplateSourceId,
): LoadedFileEmailTemplateSource | null {
  return fileEmailTemplateRegistry.loadSource(sourceId)
}

export function readFileEmailTemplateSourceFile(
  sourceId: FileEmailTemplateSourceId,
  filePath: string,
): string | null {
  return fileEmailTemplateRegistry.readSourceFile(sourceId, filePath)
}

export function previewFileEmailTemplateSource(
  sourceId: FileEmailTemplateSourceId,
  context: FileEmailTemplateRenderContext,
): FileEmailTemplatePreviewResult | null {
  const loadedSource = loadFileEmailTemplateSource(sourceId)
  if (!loadedSource) {
    return null
  }
  return renderLoadedFileEmailTemplatePreview(loadedSource, context)
}

export function renderLoadedFileEmailTemplatePreview(
  loadedSource: LoadedFileEmailTemplateSource,
  context: FileEmailTemplateRenderContext,
): FileEmailTemplatePreviewResult {
  const issues = validateLoadedFileEmailTemplateSource(loadedSource)
  const partials = readPartials(loadedSource)
  const subjectTemplate = loadedSource.files.get(normalizeTemplatePath(loadedSource.manifest.subject)) ?? ''
  const renderedSubject = renderFileHandlebarsTemplate(subjectTemplate, context, { partials }).html
  const blocks = convertFileEmailTemplateBlocks(loadedSource, context, partials)
  const blockPreviews = renderBlockPreviews(loadedSource, context, blocks, partials)
  return {
    valid: !hasBlockingIssues(issues),
    issues,
    source: loadedSource.source,
    manifest: loadedSource.manifest,
    subjectTemplate,
    renderedSubject,
    bodyHtml: blockPreviews.flatMap((preview) => preview.renderedFragments).join('\n'),
    blocks,
    blockPreviews,
    context: {
      sharedArticles: context.sharedArticles,
      classes: context.classes,
      weeklyItems: context.weeklyItems,
    },
  }
}

export function validateLoadedFileEmailTemplateSource(
  loadedSource: LoadedFileEmailTemplateSource,
): FileEmailTemplateValidationIssue[] {
  const issues: FileEmailTemplateValidationIssue[] = []
  issues.push(...validateMetadataFields(loadedSource))
  issues.push(...validateManifestFiles(loadedSource))
  issues.push(...validateBlockOrders(loadedSource.manifest.blocks))
  issues.push(...validateBlockModes(loadedSource.manifest.blocks))
  issues.push(...validatePartialReferences(loadedSource))
  issues.push(...validateHandlebarsCompiles(loadedSource))
  return issues
}

export function convertFileEmailTemplateBlocks(
  loadedSource: LoadedFileEmailTemplateSource,
  context: FileEmailTemplateRenderContext,
  partials: Record<string, string> = readPartials(loadedSource),
): EmailTemplateBlock[] {
  const placeholderContext = createTokenPlaceholderContext(context)
  return [...loadedSource.manifest.blocks]
    .sort(compareManifestBlockOrder)
    .map((manifestBlock, index) => {
      const type = resolveEmailBlockType(manifestBlock)
      const template = loadedSource.files.get(normalizeTemplatePath(manifestBlock.file)) ?? ''
      const bodyHtml = renderFileHandlebarsTemplate(template, placeholderContext, {
        config: manifestBlock.config,
        partials,
        ...placeholderRenderDataForMode(manifestBlock.mode, placeholderContext),
      }).html
      return {
        type,
        order: index,
        visible: true,
        bodyHtml,
        config: buildBlockConfig(manifestBlock),
      }
    })
}

export function renderFileHandlebarsTemplate(
  template: string,
  context: FileEmailTemplateRenderContext,
  options?: {
    config?: Record<string, unknown>
    article?: RecipientArticle
    class?: RecipientClass
    weeklyItem?: RecipientArticle
    partials?: Record<string, string>
  },
): FileHandlebarsRenderResult {
  const runtime = createHandlebarsRuntime(options?.partials ?? {})
  try {
    const compiled = runtime.compile(template, {
      noEscape: false,
      strict: false,
    })
    return {
      html: compiled(buildRenderScope(context, options)),
    }
  } catch (error) {
    return {
      html: '',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function renderBlockPreviews(
  loadedSource: LoadedFileEmailTemplateSource,
  context: FileEmailTemplateRenderContext,
  blocks: EmailTemplateBlock[],
  partials: Record<string, string>,
): FileEmailTemplateBlockPreview[] {
  const orderedManifestBlocks = [...loadedSource.manifest.blocks].sort(compareManifestBlockOrder)
  return orderedManifestBlocks.map((manifestBlock, index) => {
    const template = loadedSource.files.get(normalizeTemplatePath(manifestBlock.file)) ?? ''
    return {
      manifestBlock,
      block: blocks[index],
      renderedFragments: renderManifestBlockFragments(manifestBlock, template, context, partials),
    }
  })
}

function renderManifestBlockFragments(
  manifestBlock: FileEmailTemplateManifestBlock,
  template: string,
  context: FileEmailTemplateRenderContext,
  partials: Record<string, string>,
): string[] {
  if (manifestBlock.mode === 'article-repeat') {
    return selectArticleRepeatItems(manifestBlock, context).map(
      (article) =>
        renderFileHandlebarsTemplate(template, context, {
          config: manifestBlock.config,
          article,
          partials,
        }).html,
    )
  }
  if (manifestBlock.mode === 'class-article-repeat') {
    const fragments: string[] = []
    const maxPerClass = asPositiveInt(manifestBlock.config?.maxItemsPerClass, Number.POSITIVE_INFINITY)
    for (const klass of context.classes) {
      const articles = klass.articles.slice(0, maxPerClass)
      for (const article of articles) {
        fragments.push(
          renderFileHandlebarsTemplate(template, context, {
            config: manifestBlock.config,
            article,
            class: klass,
            partials,
          }).html,
        )
      }
    }
    return fragments
  }
  if (manifestBlock.mode === 'weekly-repeat') {
    return selectWeeklyItems(manifestBlock, context).map(
      (weeklyItem) =>
        renderFileHandlebarsTemplate(template, context, {
          config: manifestBlock.config,
          article: weeklyItem,
          weeklyItem,
          partials,
        }).html,
    )
  }
  return [
    renderFileHandlebarsTemplate(template, context, {
      config: manifestBlock.config,
      partials,
    }).html,
  ]
}

function groupFilesBySource(rawFiles: Record<string, string>): Map<FileEmailTemplateSourceId, SourceFileBundle> {
  const bundles = new Map<FileEmailTemplateSourceId, SourceFileBundle>()
  for (const [rawPath, content] of Object.entries(rawFiles)) {
    const normalizedPath = rawPath.split('\\').join('/')
    const marker = `/${TEMPLATE_ROOT}/`
    const markerIndex = normalizedPath.lastIndexOf(marker)
    const relativeToRoot =
      markerIndex >= 0 ? normalizedPath.slice(markerIndex + marker.length) : normalizedPath
    const [sourceId, ...fileParts] = relativeToRoot.split('/')
    const filePath = normalizeTemplatePath(fileParts.join('/'))
    if (!isStableSourceId(sourceId) || filePath.length === 0) {
      continue
    }
    const bundle = bundles.get(sourceId) ?? { sourceId, files: new Map<string, string>() }
    bundle.files.set(filePath, content)
    bundles.set(sourceId, bundle)
  }
  return bundles
}

function createHandlebarsRuntime(partials: Record<string, string>): typeof Handlebars {
  const runtime = Handlebars.create()
  for (const [name, template] of Object.entries(partials)) {
    runtime.registerPartial(name, template)
  }
  return runtime
}

function readPartials(loadedSource: LoadedFileEmailTemplateSource): Record<string, string> {
  const partials: Record<string, string> = {}
  for (const partial of loadedSource.manifest.partials ?? []) {
    const content = loadedSource.files.get(normalizeTemplatePath(partial.file))
    if (content !== undefined) {
      partials[partial.name] = content
    }
  }
  return partials
}

function validateMetadataFields(
  loadedSource: LoadedFileEmailTemplateSource,
): FileEmailTemplateValidationIssue[] {
  const metadata = readMetadataRecord(loadedSource)
  const requiredFields = ['sourceId', 'name', 'subject', 'blocks'] as const
  return requiredFields
    .filter((field) => {
      if (field === 'blocks') {
        return !Array.isArray(metadata[field])
      }
      return typeof metadata[field] !== 'string' || metadata[field].length === 0
    })
    .map((field) => ({
      code: 'missing_metadata_field',
      severity: 'error',
      path: loadedSource.source.metadataPath,
      field,
      message: `Missing required metadata field: ${field}`,
    }))
}

function validateManifestFiles(
  loadedSource: LoadedFileEmailTemplateSource,
): FileEmailTemplateValidationIssue[] {
  const issues: FileEmailTemplateValidationIssue[] = []
  const subjectPath = normalizeTemplatePath(loadedSource.manifest.subject)
  if (!loadedSource.files.has(subjectPath)) {
    issues.push({
      code: 'missing_subject_file',
      severity: 'error',
      path: subjectPath,
      field: 'subject',
      message: `Missing subject template file: ${subjectPath}`,
    })
  }
  loadedSource.manifest.blocks.forEach((block, index) => {
    const blockPath = normalizeTemplatePath(block.file)
    if (!loadedSource.files.has(blockPath)) {
      issues.push({
        code: 'missing_block_file',
        severity: 'error',
        path: blockPath,
        field: `block:${index}`,
        blockId: block.id,
        blockIndex: index,
        message: `Missing block template file: ${blockPath}`,
      })
    }
  })
  for (const partial of loadedSource.manifest.partials ?? []) {
    const partialPath = normalizeTemplatePath(partial.file)
    if (!loadedSource.files.has(partialPath)) {
      issues.push({
        code: 'missing_partial',
        severity: 'error',
        path: partialPath,
        message: `Missing partial template file: ${partialPath}`,
      })
    }
  }
  return issues
}

function validateBlockOrders(
  blocks: FileEmailTemplateManifestBlock[],
): FileEmailTemplateValidationIssue[] {
  const issues: FileEmailTemplateValidationIssue[] = []
  const seen = new Set<number>()
  blocks.forEach((block, index) => {
    if (typeof block.order !== 'number' || !Number.isFinite(block.order)) {
      issues.push({
        code: 'invalid_block_order',
        severity: 'error',
        field: `block:${index}`,
        blockId: block.id,
        blockIndex: index,
        message: `Invalid block order for ${block.id}.`,
      })
      return
    }
    if (seen.has(block.order)) {
      issues.push({
        code: 'invalid_block_order',
        severity: 'error',
        field: `block:${index}`,
        blockId: block.id,
        blockIndex: index,
        message: `Duplicate block order ${block.order} for ${block.id}.`,
      })
    }
    seen.add(block.order)
  })
  return issues
}

function validateBlockModes(
  blocks: FileEmailTemplateManifestBlock[],
): FileEmailTemplateValidationIssue[] {
  return blocks.flatMap((block, index) => {
    if (SUPPORTED_BLOCK_MODES.has(String(block.mode))) {
      return []
    }
    return [
      {
        code: 'unsupported_block_mode',
        severity: 'error',
        field: `block:${index}`,
        blockId: block.id,
        blockIndex: index,
        message: `Unsupported block mode for ${block.id}: ${String(block.mode)}`,
      } satisfies FileEmailTemplateValidationIssue,
    ]
  })
}

function validatePartialReferences(
  loadedSource: LoadedFileEmailTemplateSource,
): FileEmailTemplateValidationIssue[] {
  const declaredPartials = new Set((loadedSource.manifest.partials ?? []).map((partial) => partial.name))
  const issues: FileEmailTemplateValidationIssue[] = []
  const templates = [
    { path: normalizeTemplatePath(loadedSource.manifest.subject), field: 'subject' },
    ...loadedSource.manifest.blocks.map((block, index) => ({
      path: normalizeTemplatePath(block.file),
      field: `block:${index}`,
      block,
      index,
    })),
  ]
  for (const template of templates) {
    const content = loadedSource.files.get(template.path)
    if (content === undefined) {
      continue
    }
    for (const partialName of listPartialReferences(content)) {
      if (!declaredPartials.has(partialName)) {
        issues.push({
          code: 'missing_partial',
          severity: 'error',
          path: template.path,
          field: template.field,
          blockId: 'block' in template ? template.block.id : undefined,
          blockIndex: 'index' in template ? template.index : undefined,
          message: `Missing partial reference "${partialName}" in ${template.path}.`,
        })
      }
    }
  }
  return issues
}

function validateHandlebarsCompiles(
  loadedSource: LoadedFileEmailTemplateSource,
): FileEmailTemplateValidationIssue[] {
  const partials = readPartials(loadedSource)
  const runtime = createHandlebarsRuntime(partials)
  const templates = [
    { path: normalizeTemplatePath(loadedSource.manifest.subject), field: 'subject' },
    ...loadedSource.manifest.blocks.map((block, index) => ({
      path: normalizeTemplatePath(block.file),
      field: `block:${index}`,
      block,
      index,
    })),
  ]
  const issues: FileEmailTemplateValidationIssue[] = []
  for (const template of templates) {
    const content = loadedSource.files.get(template.path)
    if (content === undefined) {
      continue
    }
    try {
      runtime.compile(content)
    } catch (error) {
      issues.push({
        code: 'handlebars_compile_error',
        severity: 'error',
        path: template.path,
        field: template.field,
        blockId: 'block' in template ? template.block.id : undefined,
        blockIndex: 'index' in template ? template.index : undefined,
        message: `Handlebars compile failed for ${template.path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      })
    }
  }
  return issues
}

function readMetadataRecord(loadedSource: LoadedFileEmailTemplateSource): Record<string, unknown> {
  const rawMetadata = loadedSource.files.get(METADATA_FILE)
  if (!rawMetadata) {
    return {}
  }
  try {
    const parsed = JSON.parse(rawMetadata)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function listPartialReferences(template: string): string[] {
  const names: string[] = []
  for (const match of template.matchAll(PARTIAL_REFERENCE_PATTERN)) {
    if (match[1]) {
      names.push(match[1])
    }
  }
  return Array.from(new Set(names))
}

function hasBlockingIssues(issues: FileEmailTemplateValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error')
}

function resolveEmailBlockType(manifestBlock: FileEmailTemplateManifestBlock): EmailBlockType {
  if (isEmailBlockType(manifestBlock.type)) {
    return manifestBlock.type
  }
  switch (manifestBlock.mode) {
    case 'article-repeat':
      return 'shared-article-feature'
    case 'class-article-repeat':
      return 'class-article-feature'
    case 'weekly-repeat':
      return 'weekly-summary-list'
    case 'custom-html':
      return 'custom-html'
    case 'static':
      return 'custom-html'
  }
}

function buildBlockConfig(manifestBlock: FileEmailTemplateManifestBlock): Record<string, unknown> {
  return {
    ...(manifestBlock.config ?? {}),
    fileTemplateBlockId: manifestBlock.id,
    fileTemplateMode: manifestBlock.mode,
    ...(manifestBlock.htmlSlot ? { htmlSlot: manifestBlock.htmlSlot } : {}),
  }
}

function placeholderRenderDataForMode(
  mode: FileEmailTemplateManifestBlock['mode'],
  context: FileEmailTemplateRenderContext,
): {
  article?: RecipientArticle
  class?: RecipientClass
  weeklyItem?: RecipientArticle
} {
  const placeholderArticle = createPlaceholderArticle()
  if (mode === 'article-repeat') {
    return { article: placeholderArticle }
  }
  if (mode === 'class-article-repeat') {
    return {
      article: placeholderArticle,
      class: createPlaceholderClass(),
    }
  }
  if (mode === 'weekly-repeat') {
    return {
      article: placeholderArticle,
      weeklyItem: placeholderArticle,
    }
  }
  if (mode === 'custom-html') {
    return {
      article: placeholderArticle,
      weeklyItem: placeholderArticle,
      class: createPlaceholderClass(),
    }
  }
  return context.sharedArticles.length > 0 ? { article: placeholderArticle } : {}
}

function createPlaceholderArticle(): RecipientArticle {
  return {
    id: '{{article.id}}',
    title: '{{article.title}}',
    excerpt: '{{article.excerpt}}',
    url: '{{article.url}}',
    imageUrl: '{{article.image_url}}',
    sourceTag: '{{article.sourceTag}}',
  }
}

function createPlaceholderClass(): RecipientClass {
  return {
    id: '{{class.id}}',
    code: '{{class.code}}',
    name: '{{class.name}}',
    articles: [],
  }
}

function selectArticleRepeatItems(
  manifestBlock: FileEmailTemplateManifestBlock,
  context: FileEmailTemplateRenderContext,
): RecipientArticle[] {
  const source =
    manifestBlock.articleSource === 'weeklyItems' ? context.weeklyItems : context.sharedArticles
  const maxItems = asPositiveInt(manifestBlock.config?.maxItems, source.length)
  return source.slice(0, maxItems)
}

function selectWeeklyItems(
  manifestBlock: FileEmailTemplateManifestBlock,
  context: FileEmailTemplateRenderContext,
): RecipientArticle[] {
  const sourceTag = typeof manifestBlock.config?.sourceTag === 'string' ? manifestBlock.config.sourceTag : null
  const source = sourceTag
    ? context.weeklyItems.filter((item) => item.sourceTag === sourceTag)
    : context.weeklyItems
  const maxItems = asPositiveInt(manifestBlock.config?.maxItems, source.length)
  return source.slice(0, maxItems)
}

function compareManifestBlockOrder(
  left: FileEmailTemplateManifestBlock,
  right: FileEmailTemplateManifestBlock,
): number {
  return left.order - right.order
}

function buildRenderScope(
  context: FileEmailTemplateRenderContext,
  options?: {
    config?: Record<string, unknown>
    article?: RecipientArticle
    class?: RecipientClass
    weeklyItem?: RecipientArticle
  },
): FileTemplateRenderScope {
  return {
    ...sanitizeConfig(options?.config),
    guardian: {
      id: renderScopeValue(context.templateContext.guardian?.id ?? ''),
      email: renderScopeValue(context.templateContext.guardian?.email ?? ''),
    },
    family: {
      id: renderScopeValue(context.templateContext.family?.id ?? ''),
    },
    newsletter: {
      id: renderScopeValue(context.templateContext.newsletter.id),
      revisionId: renderScopeValue(context.templateContext.newsletter.revisionId),
    },
    classes: {
      ids: context.templateContext.classes.ids,
      count: context.templateContext.classes.ids.includes('{{classes.list}}')
        ? renderScopeValue('{{classes.count}}')
        : context.templateContext.classes.ids.length,
      list: context.templateContext.classes.ids.includes('{{classes.list}}')
        ? renderScopeValue('{{classes.list}}')
        : context.templateContext.classes.ids.join(', '),
    },
    article: options?.article ? toArticleScope(options.article) : undefined,
    class: options?.class ? toClassScope(options.class) : undefined,
    weeklyItem: options?.weeklyItem ? toArticleScope(options.weeklyItem) : undefined,
    html: context.injectedHtml ?? {},
  }
}

function createTokenPlaceholderContext(
  context: FileEmailTemplateRenderContext,
): FileEmailTemplateRenderContext {
  return {
    templateContext: {
      guardian: {
        id: '{{guardian.id}}',
        email: '{{guardian.email}}',
      },
      family: {
        id: '{{family.id}}',
      },
      newsletter: {
        id: '{{newsletter.id}}',
        revisionId: '{{newsletter.revisionId}}',
      },
      classes: {
        ids: ['{{classes.list}}'],
      },
    },
    sharedArticles: context.sharedArticles,
    classes: context.classes,
    weeklyItems: context.weeklyItems,
    injectedHtml: context.injectedHtml,
  }
}

function sanitizeConfig(config?: Record<string, unknown>): Record<string, unknown> {
  if (!config) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(config).filter(
      ([key, value]) =>
        !['guardian', 'family', 'newsletter', 'classes', 'article', 'class', 'weeklyItem', 'html'].includes(
          key,
        ) && isRenderableValue(value),
    ),
  )
}

function isRenderableValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
  )
}

function toArticleScope(article: RecipientArticle) {
  return {
    id: renderScopeValue(article.id),
    title: renderScopeValue(article.title),
    excerpt: renderScopeValue(article.excerpt),
    url: renderScopeValue(article.url),
    imageUrl: renderScopeValue(article.imageUrl ?? ''),
    image_url: renderScopeValue(article.imageUrl ?? ''),
    sourceTag: renderScopeValue(article.sourceTag ?? ''),
  }
}

function toClassScope(klass: RecipientClass) {
  return {
    id: renderScopeValue(klass.id),
    code: renderScopeValue(klass.code ?? ''),
    name: renderScopeValue(klass.name ?? klass.code ?? klass.id),
  }
}

function renderScopeValue(value: string): RenderScopeScalar {
  if (/^\{\{[a-zA-Z0-9_.]+\}\}$/.test(value)) {
    return new Handlebars.SafeString(value)
  }
  return value
}

function asPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  return fallback
}

function parseManifest(rawMetadata: string, fallbackSourceId: FileEmailTemplateSourceId): FileEmailTemplateManifest | null {
  try {
    const parsed = JSON.parse(rawMetadata) as Partial<FileEmailTemplateManifest>
    return {
      sourceId: typeof parsed.sourceId === 'string' ? parsed.sourceId : fallbackSourceId,
      name: typeof parsed.name === 'string' ? parsed.name : fallbackSourceId,
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
      version: typeof parsed.version === 'string' ? parsed.version : undefined,
      linkedTemplateId:
        typeof parsed.linkedTemplateId === 'string' ? parsed.linkedTemplateId : undefined,
      subject: typeof parsed.subject === 'string' ? parsed.subject : 'subject.hbs',
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
      partials: parsePartials(parsed.partials),
    }
  } catch {
    return null
  }
}

function parsePartials(value: unknown): FileEmailTemplateManifestPartial[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isManifestPartial)
}

function isManifestPartial(value: unknown): value is FileEmailTemplateManifestPartial {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<FileEmailTemplateManifestPartial>
  return typeof candidate.name === 'string' && typeof candidate.file === 'string'
}

function toSourceMetadata(
  sourceId: FileEmailTemplateSourceId,
  manifest: FileEmailTemplateManifest,
  files: ReadonlyMap<string, string>,
): FileEmailTemplateSourceMetadata {
  const subjectPath = normalizeTemplatePath(manifest.subject)
  const blockPaths = manifest.blocks.map((block) => normalizeTemplatePath(block.file))
  const partialPaths = manifest.partials?.map((partial) => normalizeTemplatePath(partial.file)) ?? []
  return {
    sourceId,
    displayName: manifest.name,
    description: manifest.description,
    version: manifest.version,
    linkedTemplateId: manifest.linkedTemplateId,
    folderPath: `${TEMPLATE_ROOT}/${sourceId}`,
    metadataPath: `${TEMPLATE_ROOT}/${sourceId}/${METADATA_FILE}`,
    subjectPath: `${TEMPLATE_ROOT}/${sourceId}/${subjectPath}`,
    blockPaths: blockPaths.filter((path) => files.has(path)).map((path) => `${TEMPLATE_ROOT}/${sourceId}/${path}`),
    partialPaths: partialPaths.filter((path) => files.has(path)).map((path) => `${TEMPLATE_ROOT}/${sourceId}/${path}`),
  }
}

function normalizeTemplatePath(filePath: string): string {
  return filePath
    .split('\\')
    .join('/')
    .split('/')
    .filter((part: string) => part.length > 0 && part !== '.')
    .join('/')
}

function isStableSourceId(value: string | undefined): value is FileEmailTemplateSourceId {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value)
}

function compareSourceIds(left: FileEmailTemplateSourceId, right: FileEmailTemplateSourceId): number {
  return left.localeCompare(right)
}
