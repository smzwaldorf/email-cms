import { adminApi } from '@/services/backendApi'
import type {
  FileEmailTemplatePreviewResult,
  FileEmailTemplateRenderContext,
  FileEmailTemplateSourceMetadata,
} from '@/types/fileEmailTemplate'

export function listFileEmailTemplateSources(): Promise<FileEmailTemplateSourceMetadata[]> {
  return adminApi.listFileTemplateSources()
}

export function previewFileEmailTemplateSource(
  sourceId: string,
  _context: FileEmailTemplateRenderContext,
): Promise<FileEmailTemplatePreviewResult | null> {
  return adminApi
    .previewFileTemplateSource(sourceId)
    .catch((error: unknown) => {
      if (error instanceof Error && error.message.includes('not found')) {
        return null
      }
      throw error
    })
}
