import type {
  EmailBlockType,
  EmailTemplateBlock,
  EmailTemplateValidationField,
} from './emailTemplate'
import type {
  RecipientArticle,
  RecipientClass,
  RecipientRenderContext,
} from '@/services/emailTemplateRenderer'

export type FileEmailTemplateSourceId = string

export interface FileEmailTemplateSourceMetadata {
  sourceId: FileEmailTemplateSourceId
  displayName: string
  description?: string
  version?: string
  linkedTemplateId?: string
  folderPath: string
  metadataPath: string
  subjectPath: string
  blockPaths: string[]
  partialPaths: string[]
}

export type FileEmailTemplateManifestBlockMode =
  | 'static'
  | 'article-repeat'
  | 'class-article-repeat'
  | 'weekly-repeat'
  | 'custom-html'

export type FileEmailTemplateArticleSource = 'sharedArticles' | 'weeklyItems'

export interface FileEmailTemplateManifestPartial {
  name: string
  file: string
}

export interface FileEmailTemplateManifestBlock {
  id: string
  mode: FileEmailTemplateManifestBlockMode
  label?: string
  file: string
  order: number
  type?: EmailBlockType
  articleSource?: FileEmailTemplateArticleSource
  classIds?: string[]
  config?: Record<string, unknown>
  htmlSlot?: string
}

export interface FileEmailTemplateManifest {
  sourceId: FileEmailTemplateSourceId
  name: string
  description?: string
  version?: string
  linkedTemplateId?: string
  subject: string
  blocks: FileEmailTemplateManifestBlock[]
  partials?: FileEmailTemplateManifestPartial[]
}

export type FileEmailTemplateValidationSeverity = 'error' | 'warning'

export type FileEmailTemplateValidationIssueCode =
  | 'missing_metadata_field'
  | 'missing_subject_file'
  | 'missing_block_file'
  | 'invalid_block_order'
  | 'unsupported_block_mode'
  | 'missing_partial'
  | 'handlebars_compile_error'
  | 'render_error'
  | 'required_value_missing'

export interface FileEmailTemplateValidationIssue {
  code: FileEmailTemplateValidationIssueCode
  severity: FileEmailTemplateValidationSeverity
  message: string
  path?: string
  field?: EmailTemplateValidationField | string
  blockId?: string
  blockIndex?: number
}

export interface FileEmailTemplateValidationResult {
  valid: boolean
  issues: FileEmailTemplateValidationIssue[]
}

export interface FileEmailTemplateRenderContext extends RecipientRenderContext {
  injectedHtml?: Record<string, string>
}

export interface FileEmailTemplateBlockPreview {
  manifestBlock: FileEmailTemplateManifestBlock
  block: EmailTemplateBlock
  renderedFragments: string[]
}

export interface FileEmailTemplatePreviewResult extends FileEmailTemplateValidationResult {
  source: FileEmailTemplateSourceMetadata
  manifest: FileEmailTemplateManifest
  subjectTemplate: string
  renderedSubject: string
  bodyHtml: string
  blocks: EmailTemplateBlock[]
  blockPreviews: FileEmailTemplateBlockPreview[]
  context: {
    sharedArticles: RecipientArticle[]
    classes: RecipientClass[]
    weeklyItems: RecipientArticle[]
  }
}

export interface FileEmailTemplateSyncInput {
  preview: FileEmailTemplatePreviewResult
  targetTemplateId?: string
  syncedBy?: string
}
