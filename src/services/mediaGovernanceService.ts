import { getSupabaseClient } from '@/lib/supabase'
import { imageOptimizer } from '@/services/imageOptimizer'
import { storageService } from '@/services/storageService'
import type {
  MediaDeletePreflight,
  MediaFile,
  MediaUsageTargetType,
  MediaVariantStatus,
  MediaVariantType,
} from '@/types/media'

type RegisterUsageInput = {
  mediaId: string
  targetType: MediaUsageTargetType
  targetId: string
  contextKey: string
  createdBy?: string
}

type UpsertVariantInput = {
  mediaId: string
  variantType: MediaVariantType
  format: string
  status?: MediaVariantStatus
  storagePath?: string
  fileSize?: number
  width?: number
  height?: number
  duration?: number
  errorMessage?: string
}

type VariantDimensions = {
  width?: number
  height?: number
}

type ProcessDefaultVariantsInput = {
  mediaId: string
  mediaType: string
  sourceFile: File
  sourceStoragePath: string
  dimensions?: VariantDimensions
}

type VariantBlueprint = {
  variantType: MediaVariantType
  format: string
  width: number
  height: number
}

export class MediaGovernanceService {
  private getMediaBucket(): string {
    return import.meta.env.VITE_SUPABASE_MEDIA_BUCKET || 'media'
  }

  private getFileExtension(format: string): string {
    switch (format) {
      case 'image/webp':
        return 'webp'
      case 'image/png':
        return 'png'
      case 'image/jpeg':
        return 'jpg'
      case 'audio/ogg':
        return 'ogg'
      case 'audio/mpeg':
        return 'mp3'
      default:
        return format.split('/')[1] || 'bin'
    }
  }

  private scaleDimensions(
    width?: number,
    height?: number,
    maxEdge?: number
  ): { width: number; height: number } {
    if (!width || !height) {
      return {
        width: maxEdge ?? 0,
        height: 0,
      }
    }

    if (!maxEdge) {
      return { width, height }
    }

    const ratio = Math.min(maxEdge / width, maxEdge / height, 1)

    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
    }
  }

  private getImageVariantBlueprints(
    dimensions?: VariantDimensions
  ): VariantBlueprint[] {
    const thumbnail320 = this.scaleDimensions(
      dimensions?.width,
      dimensions?.height,
      320
    )
    const thumbnail640 = this.scaleDimensions(
      dimensions?.width,
      dimensions?.height,
      640
    )
    const original = this.scaleDimensions(dimensions?.width, dimensions?.height)

    return [
      {
        variantType: 'thumbnail',
        format: 'image/webp',
        width: thumbnail320.width,
        height: thumbnail320.height,
      },
      {
        variantType: 'thumbnail',
        format: 'image/webp',
        width: thumbnail640.width,
        height: thumbnail640.height,
      },
      {
        variantType: 'webp',
        format: 'image/webp',
        width: original.width,
        height: original.height,
      },
    ]
  }

  private buildVariantStoragePath(
    mediaId: string,
    sourceStoragePath: string,
    blueprint: VariantBlueprint
  ): string {
    const extension = this.getFileExtension(blueprint.format)
    const lastSlash = sourceStoragePath.lastIndexOf('/')
    const baseDir =
      lastSlash >= 0 ? sourceStoragePath.slice(0, lastSlash) : `variants/${mediaId}`
    const sizeToken =
      blueprint.width > 0 && blueprint.height > 0
        ? `${blueprint.width}x${blueprint.height}`
        : 'original'

    return `${baseDir}/variants/${mediaId}/${blueprint.variantType}-${sizeToken}.${extension}`
  }

  private async uploadVariantFile(
    storagePath: string,
    file: File
  ): Promise<void> {
    const result = await storageService.upload(
      this.getMediaBucket(),
      storagePath,
      file,
      {
        contentType: file.type,
        upsert: true,
      }
    )

    if (!result.success) {
      throw result.error ?? new Error(`Failed to upload variant to ${storagePath}`)
    }
  }

  private async processImageVariant(
    mediaId: string,
    sourceStoragePath: string,
    sourceFile: File,
    blueprint: VariantBlueprint
  ): Promise<void> {
    await this.upsertVariant({
      mediaId,
      variantType: blueprint.variantType,
      format: blueprint.format,
      status: 'processing',
      width: blueprint.width,
      height: blueprint.height,
    })

    try {
      const processedFile =
        blueprint.variantType === 'webp'
          ? sourceFile.type === 'image/webp'
            ? sourceFile
            : await imageOptimizer.convertFormat(sourceFile, 'image/webp')
          : (
              await imageOptimizer.optimize(sourceFile, {
                maxWidth: blueprint.width,
                maxHeight: blueprint.height,
                quality: 75,
                convertToWebP: true,
              })
            ).optimizedFile

      const storagePath = this.buildVariantStoragePath(
        mediaId,
        sourceStoragePath,
        blueprint
      )

      await this.uploadVariantFile(storagePath, processedFile)

      await this.upsertVariant({
        mediaId,
        variantType: blueprint.variantType,
        format: blueprint.format,
        status: 'ready',
        storagePath,
        fileSize: processedFile.size,
        width: blueprint.width,
        height: blueprint.height,
      })
    } catch (error) {
      await this.upsertVariant({
        mediaId,
        variantType: blueprint.variantType,
        format: blueprint.format,
        status: 'failed',
        width: blueprint.width,
        height: blueprint.height,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private async processAudioVariant(
    mediaId: string,
    sourceStoragePath: string,
    sourceFile: File
  ): Promise<void> {
    const blueprint: VariantBlueprint = {
      variantType: 'audio_optimized',
      format: sourceFile.type === 'audio/ogg' ? 'audio/ogg' : 'audio/ogg',
      width: 0,
      height: 0,
    }

    await this.upsertVariant({
      mediaId,
      variantType: blueprint.variantType,
      format: blueprint.format,
      status: 'processing',
    })

    try {
      if (sourceFile.type !== 'audio/ogg') {
        throw new Error('Audio optimization is not yet supported for this format')
      }

      const storagePath = this.buildVariantStoragePath(
        mediaId,
        sourceStoragePath,
        blueprint
      )

      await this.uploadVariantFile(storagePath, sourceFile)

      await this.upsertVariant({
        mediaId,
        variantType: blueprint.variantType,
        format: blueprint.format,
        status: 'ready',
        storagePath,
        fileSize: sourceFile.size,
      })
    } catch (error) {
      await this.upsertVariant({
        mediaId,
        variantType: blueprint.variantType,
        format: blueprint.format,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private toStorageUri(
    publicUrl: string | null,
    storagePath: string | null
  ): string | undefined {
    if (storagePath) {
      return `storage://media/${storagePath}`
    }

    if (!publicUrl) return undefined

    if (publicUrl.startsWith('storage://')) {
      return publicUrl
    }

    try {
      const url = new URL(publicUrl)
      const signMarker = '/storage/v1/object/sign/'
      const publicMarker = '/storage/v1/object/public/'

      if (url.pathname.includes(signMarker)) {
        const fullPath = decodeURIComponent(url.pathname.split(signMarker)[1] || '')
        if (fullPath) {
          return `storage://${fullPath}`
        }
      }

      if (url.pathname.includes(publicMarker)) {
        const fullPath = decodeURIComponent(url.pathname.split(publicMarker)[1] || '')
        if (fullPath) {
          return `storage://${fullPath}`
        }
      }
    } catch {
      // noop
    }

    return undefined
  }

  private async resolvePreviewUrl(
    publicUrl: string | null,
    storagePath: string | null
  ): Promise<string | undefined> {
    if (publicUrl && !publicUrl.startsWith('storage://')) {
      return publicUrl
    }

    const bucket = 'media'
    const pathFromStorageUri = publicUrl?.startsWith(`storage://${bucket}/`)
      ? publicUrl.replace(`storage://${bucket}/`, '')
      : null
    const finalPath = storagePath || pathFromStorageUri

    if (!finalPath) return undefined

    try {
      return await storageService.getSignedUrl(bucket, finalPath, 3600)
    } catch (error) {
      console.warn('Unable to resolve signed media preview URL', error)
      return undefined
    }
  }

  async registerUsage(input: RegisterUsageInput): Promise<void> {
    const supabase = getSupabaseClient()
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('media_usage')
      .upsert(
        {
          media_id: input.mediaId,
          target_type: input.targetType,
          target_id: input.targetId,
          context_key: input.contextKey,
          active: true,
          created_by: input.createdBy ?? null,
          deactivated_at: null,
          updated_at: now,
        },
        { onConflict: 'media_id,target_type,target_id,context_key' }
      )

    if (error) {
      throw new Error(`Failed to register media usage: ${error.message}`)
    }
  }

  async deactivateUsage(
    mediaId: string,
    targetType: MediaUsageTargetType,
    targetId: string,
    contextKey?: string
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const now = new Date().toISOString()
    let query = supabase
      .from('media_usage')
      .update({
        active: false,
        deactivated_at: now,
        updated_at: now,
      })
      .eq('media_id', mediaId)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('active', true)

    if (contextKey) {
      query = query.eq('context_key', contextKey)
    }

    const { error } = await query
    if (error) {
      throw new Error(`Failed to deactivate media usage: ${error.message}`)
    }
  }

  async deactivateUsageByTarget(
    targetType: MediaUsageTargetType,
    targetId: string
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('media_usage')
      .update({
        active: false,
        deactivated_at: now,
        updated_at: now,
      })
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('active', true)

    if (error) {
      throw new Error(`Failed to deactivate media usage by target: ${error.message}`)
    }
  }

  async copyUsageToTarget(
    sourceTargetId: string,
    targetTargetId: string,
    targetType: MediaUsageTargetType = 'article'
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('media_usage')
      .select('media_id, context_key')
      .eq('target_type', targetType)
      .eq('target_id', sourceTargetId)
      .eq('active', true)

    if (error) {
      throw new Error(`Failed to query source usage: ${error.message}`)
    }

    if (!data?.length) return

    for (const row of data) {
      await this.registerUsage({
        mediaId: row.media_id,
        targetType,
        targetId: targetTargetId,
        contextKey: row.context_key,
      })
    }
  }

  async getDeletePreflight(mediaId: string): Promise<MediaDeletePreflight> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('media_usage')
      .select('id, target_type, target_id, context_key')
      .eq('media_id', mediaId)
      .eq('active', true)

    if (error) {
      throw new Error(`Failed to run media delete preflight: ${error.message}`)
    }

    const impacts = (data || []).map((row) => ({
      usageId: row.id,
      targetType: row.target_type as MediaUsageTargetType,
      targetId: row.target_id,
      contextKey: row.context_key,
    }))

    return {
      mediaId,
      canDelete: impacts.length === 0,
      activeUsageCount: impacts.length,
      impacts,
    }
  }

  async safeDeleteUnusedMedia(
    mediaId: string,
    deletedBy: string,
    reason: string
  ): Promise<void> {
    const preflight = await this.getDeletePreflight(mediaId)
    if (!preflight.canDelete) {
      throw new Error('Cannot delete media while active references exist')
    }

    const supabase = getSupabaseClient()
    const { error: deleteError } = await supabase
      .from('media_files')
      .delete()
      .eq('id', mediaId)

    if (deleteError) {
      throw new Error(`Failed to delete media file: ${deleteError.message}`)
    }

    const { error: auditError } = await supabase.from('media_deletion_audit').insert({
      media_id: mediaId,
      deleted_by: deletedBy,
      reason,
      preflight_usage_count: preflight.activeUsageCount,
      metadata: { impacts: preflight.impacts },
    })

    if (auditError) {
      throw new Error(`Failed to write deletion audit log: ${auditError.message}`)
    }
  }

  async upsertVariant(input: UpsertVariantInput): Promise<void> {
    const supabase = getSupabaseClient()
    const now = new Date().toISOString()
    const { error } = await supabase.from('media_variants').upsert(
      {
        media_id: input.mediaId,
        variant_type: input.variantType,
        format: input.format,
        status: input.status ?? 'pending',
        storage_path: input.storagePath ?? null,
        file_size: input.fileSize ?? null,
        width: input.width ?? 0,
        height: input.height ?? 0,
        duration: input.duration ?? null,
        error_message: input.errorMessage ?? null,
        last_processed_at: now,
        updated_at: now,
      },
      { onConflict: 'media_id,variant_type,format,width,height' }
    )

    if (error) {
      throw new Error(`Failed to upsert media variant: ${error.message}`)
    }
  }

  async enqueueDefaultVariantsForMedia(
    mediaId: string,
    mediaType: string,
    dimensions?: VariantDimensions
  ): Promise<void> {
    if (mediaType === 'image') {
      const variants = this.getImageVariantBlueprints(dimensions)
      for (const variant of variants) {
        await this.upsertVariant({
          mediaId,
          variantType: variant.variantType,
          format: variant.format,
          status: 'pending',
          width: variant.width,
          height: variant.height,
        })
      }
      return
    }

    if (mediaType === 'audio') {
      await this.upsertVariant({
        mediaId,
        variantType: 'audio_optimized',
        format: 'audio/ogg',
        status: 'pending',
      })
    }
  }

  async processDefaultVariantsForMedia(
    input: ProcessDefaultVariantsInput
  ): Promise<void> {
    if (input.mediaType === 'image') {
      const variants = this.getImageVariantBlueprints(input.dimensions)
      await Promise.all(
        variants.map((variant) =>
          this.processImageVariant(
            input.mediaId,
            input.sourceStoragePath,
            input.sourceFile,
            variant
          )
        )
      )
      return
    }

    if (input.mediaType === 'audio') {
      await this.processAudioVariant(
        input.mediaId,
        input.sourceStoragePath,
        input.sourceFile
      )
    }
  }

  async fetchLibraryMedia(search?: string): Promise<MediaFile[]> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('media_files')
      .select(
        'id, filename, file_size, mime_type, file_type, public_url, storage_path, uploaded_by, uploaded_at, updated_at, width, height, duration'
      )
      .order('uploaded_at', { ascending: false })

    if (search && search.trim()) {
      query = query.ilike('filename', `%${search.trim()}%`)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(`Failed to fetch media library files: ${error.message}`)
    }

    if (!data?.length) return []

    const mediaIds = data.map((row) => row.id)
    const [usageResult, variantsResult] = await Promise.all([
      supabase
        .from('media_usage')
        .select('media_id')
        .in('media_id', mediaIds)
        .eq('active', true),
      supabase
        .from('media_variants')
        .select('id, media_id, variant_type, format, status, storage_path, file_size, width, height, duration, retry_count, error_message, last_processed_at, created_at, updated_at')
        .in('media_id', mediaIds),
    ])

    const usageMap = new Map<string, number>()
    for (const row of usageResult.data || []) {
      usageMap.set(row.media_id, (usageMap.get(row.media_id) || 0) + 1)
    }

    const variantsMap = new Map<string, any[]>()
    for (const row of variantsResult.data || []) {
      const existing = variantsMap.get(row.media_id) || []
      existing.push({
        id: row.id,
        mediaId: row.media_id,
        variantType: row.variant_type,
        format: row.format,
        status: row.status,
        storagePath: row.storage_path ?? undefined,
        fileSize: row.file_size ?? undefined,
        width: row.width ?? undefined,
        height: row.height ?? undefined,
        duration: row.duration ?? undefined,
        retryCount: row.retry_count,
        errorMessage: row.error_message ?? undefined,
        lastProcessedAt: row.last_processed_at ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
      variantsMap.set(row.media_id, existing)
    }

    const mapped = await Promise.all(
      data.map(async (row) => {
        const previewUrl = await this.resolvePreviewUrl(
          row.public_url ?? null,
          row.storage_path ?? null
        )

        const storageUri = this.toStorageUri(
          row.public_url ?? null,
          row.storage_path ?? null
        )

        return {
          id: row.id,
          fileName: row.filename,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          mediaType: row.file_type,
          status: 'ready',
          uploadedBy: row.uploaded_by,
          uploadedAt: row.uploaded_at,
          updatedAt: row.updated_at,
          publicUrl: previewUrl,
          signedUrl: previewUrl,
          storageUrl: storageUri,
          width: row.width ?? undefined,
          height: row.height ?? undefined,
          duration: row.duration ?? undefined,
          usageCount: usageMap.get(row.id) || 0,
          variants: variantsMap.get(row.id) || [],
        } as MediaFile
      })
    )

    return mapped
  }

  async fetchDashboardSummary() {
    const media = await this.fetchLibraryMedia()
    const byType = media.reduce<Record<string, number>>((acc, item) => {
      acc[item.mediaType] = (acc[item.mediaType] || 0) + 1
      return acc
    }, {})

    const storageBytes = media.reduce((sum, item) => sum + item.fileSize, 0)
    const topUsed = [...media]
      .sort((a, b) => {
        const delta = (b.usageCount || 0) - (a.usageCount || 0)
        if (delta !== 0) return delta
        return a.fileName.localeCompare(b.fileName)
      })
      .slice(0, 10)

    return {
      storageBytes,
      distribution: byType,
      topUsed,
    }
  }

  async fetchUnusedMediaCandidates(): Promise<MediaFile[]> {
    const media = await this.fetchLibraryMedia()
    return media.filter((item) => (item.usageCount || 0) === 0)
  }
}

export const mediaGovernanceService = new MediaGovernanceService()
