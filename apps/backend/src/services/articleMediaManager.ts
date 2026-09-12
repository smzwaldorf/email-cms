import type { SqlTables } from '@email-cms/shared'
/**
 * 文章媒體管理服務 - 處理文章與媒體檔案的關聯管理
 * Article Media Manager Service - Manages relationships between articles and media files
 */

import { getSupabaseClient } from '#/lib/supabase'
import { MediaFileStatus, MediaFileType, type MediaFile } from '#/types/media'
import { mediaGovernanceService } from '#/services/mediaGovernanceService'

interface ArticleMediaReferenceNestedRow {
  /** PostgREST may return a single joined row or an array */
  media_files?: SqlTables['media_files'] | SqlTables['media_files'][] | null
}

interface ArticleMediaReferenceIdRow {
  media_id: string
}

interface MediaFileIdOnlyRow {
  id: string
}

function mapMediaRow(row: SqlTables['media_files']): MediaFile {
  return {
    id: row.id, fileName: row.filename, fileSize: Number(row.file_size), mimeType: row.mime_type,
    mediaType: row.file_type as MediaFileType, status: MediaFileStatus.READY,
    uploadedBy: row.uploaded_by, uploadedAt: row.uploaded_at, updatedAt: row.updated_at,
    storageUrl: `storage://media/${row.storage_path}`, publicUrl: row.public_url,
    width: row.width ?? undefined, height: row.height ?? undefined, duration: row.duration == null ? undefined : Number(row.duration),
  }
}

/**
 * 文章媒體管理服務類
 * Article Media Manager Service class
 */
export class ArticleMediaManager {
  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  }

  private async resolveArticleId(articleId: string): Promise<string | null> {
    if (this.isUuid(articleId)) {
      return articleId
    }

    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('articles')
        .select('id')
        .eq('short_id', articleId)
        .maybeSingle()

      if (error) {
        throw error
      }

      return data?.id ?? articleId
    } catch {
      return articleId
    }
  }

  /**
   * 取得文章的所有媒體檔案
   * Get all media files for an article
   */
  async getArticleMedia(articleId: string): Promise<MediaFile[]> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from<ArticleMediaReferenceNestedRow>('article_media_references')
        .select('media_files(*)')
        .eq('article_id', articleId)

      if (error) throw error

      // 平坦化結果
      // Flatten results
      return (data || []).flatMap((ref: ArticleMediaReferenceNestedRow) => {
        const mf = ref.media_files
        if (!mf) return []
        return (Array.isArray(mf) ? mf : [mf]).map(mapMediaRow)
      })
    } catch (error) {
      console.error('Failed to get article media:', error)
      return []
    }
  }

  /**
   * 新增媒體檔案至文章
   * Add media file to article
   */
  async addMediaToArticle(
    articleId: string,
    mediaId: string,
    properties?: {
      alt?: string
      title?: string
      align?: 'left' | 'center' | 'right'
      width?: number
      height?: number
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      void properties
      const canonicalArticleId = await this.resolveArticleId(articleId)
      if (!canonicalArticleId) {
        throw new Error(`Article not found: ${articleId}`)
      }

      const supabase = getSupabaseClient()
      // 檢查關聯是否已存在
      // Check if reference already exists
      const { data: existing } = await supabase
        .from('article_media_references')
        .select('id')
        .eq('article_id', canonicalArticleId)
        .eq('media_id', mediaId)
        .single()

      if (existing) {
        // 已存在關聯時不重複插入
        // Skip duplicate insert if relation already exists
      } else {
        // 建立新關聯
        // Create new reference
        const { error: insertError } = await supabase
          .from('article_media_references')
          .insert({
            article_id: canonicalArticleId,
            media_id: mediaId,
            reference_type: 'inline',
            position: 0,
          })

        if (insertError) throw insertError
      }

      await mediaGovernanceService.registerUsage({
        mediaId,
        targetType: 'article',
        targetId: canonicalArticleId,
        contextKey: `article_media:${mediaId}`,
      })

      return { success: true }
    } catch (error) {
      console.error('Failed to add media to article:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 從文章移除媒體檔案
   * Remove media file from article
   */
  async removeMediaFromArticle(
    articleId: string,
    mediaId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const canonicalArticleId = await this.resolveArticleId(articleId)
      if (!canonicalArticleId) {
        throw new Error(`Article not found: ${articleId}`)
      }

      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('article_media_references')
        .delete()
        .eq('article_id', canonicalArticleId)
        .eq('media_id', mediaId)

      if (error) throw error

      await mediaGovernanceService.deactivateUsage(
        mediaId,
        'article',
        canonicalArticleId,
        `article_media:${mediaId}`
      )

      return { success: true }
    } catch (error) {
      console.error('Failed to remove media from article:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 同步文章的媒體參考 - 清理無效的參考
   * Sync article media references - Clean up invalid references
   */
  async syncMediaReferences(articleId: string): Promise<{
    success: boolean
    removedCount?: number
    error?: string
  }> {
    try {
      const supabase = getSupabaseClient()
      // 取得所有參考
      // Get all references
      const { data: references, error: selectError } = await supabase
        .from('article_media_references')
        .select('media_id')
        .eq('article_id', articleId)

      if (selectError) throw selectError

      if (!references || references.length === 0) {
        return { success: true, removedCount: 0 }
      }

      // 檢查每個媒體檔案是否存在
      // Check if each media file exists
      const mediaIds = references.map((ref: ArticleMediaReferenceIdRow) => ref.media_id)
      const supabase2 = getSupabaseClient()
      const { data: existingMedia, error: mediaError } = await supabase2
        .from('media_files')
        .select('id')
        .in('id', mediaIds)

      if (mediaError) throw mediaError

      const existingIds = (existingMedia || []).map((m: MediaFileIdOnlyRow) => m.id)
      const orphanedIds = mediaIds.filter((id: string) => !existingIds.includes(id))

      // 刪除孤立的參考
      // Delete orphaned references
      if (orphanedIds.length > 0) {
        const supabase3 = getSupabaseClient()
        const { error: deleteError } = await supabase3
          .from('article_media_references')
          .delete()
          .in('media_id', orphanedIds)
          .eq('article_id', articleId)

        if (deleteError) throw deleteError
      }

      return { success: true, removedCount: orphanedIds.length }
    } catch (error) {
      console.error('Failed to sync media references:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 追蹤孤立檔案 - 找出未被任何文章參考的媒體檔案
   * Track orphaned files - Find media files not referenced by any article
   */
  async findOrphanedFiles(userId: string): Promise<MediaFile[]> {
    try {
      const supabase = getSupabaseClient()
      const { data: references, error: referenceError } = await supabase
        .from('article_media_references').select('media_id')
      if (referenceError) throw referenceError
      const referenced = new Set((references ?? []).map(row => row.media_id))
      const { data: files, error } = await supabase
        .from('media_files').select('*').eq('uploaded_by', userId)
      if (error) throw error
      return (files ?? []).filter(row => !referenced.has(row.id)).map(mapMediaRow)

    } catch (error) {
      console.error('Failed to find orphaned files:', error)
      return []
    }
  }

  /**
   * 刪除孤立檔案
   * Delete orphaned files
   */
  async deleteOrphanedFiles(mediaIds: string[]): Promise<{
    success: boolean
    deletedCount?: number
    error?: string
  }> {
    try {
      if (mediaIds.length === 0) {
        return { success: true, deletedCount: 0 }
      }

      const supabase = getSupabaseClient()
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (!userId) {
        throw new Error('User not authenticated')
      }

      for (const mediaId of mediaIds) {
        await mediaGovernanceService.safeDeleteUnusedMedia(
          mediaId,
          userId,
          'unused_media_cleanup'
        )
      }

      // 刪除儲存中的檔案
      // Delete files from storage
      // 此部分需要根據儲存提供者實作
      // This part should be implemented based on storage provider

      return { success: true, deletedCount: mediaIds.length }
    } catch (error) {
      console.error('Failed to delete orphaned files:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 更新媒體檔案屬性
   * Update media file properties
   */
  async updateMediaProperties(
    articleId: string,
    mediaId: string,
    properties: {
      alt?: string
      title?: string
      align?: 'left' | 'center' | 'right'
      width?: number
      height?: number
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // article_media_references schema currently has no mutable properties column.
      // Keep API compatibility as a no-op until schema extension is added.
      void articleId
      void mediaId
      void properties
      return { success: true }
    } catch (error) {
      console.error('Failed to update media properties:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async preflightMediaDelete(mediaId: string) {
    return mediaGovernanceService.getDeletePreflight(mediaId)
  }

  async copyArticleMediaUsage(
    sourceArticleId: string,
    targetArticleId: string
  ): Promise<void> {
    await mediaGovernanceService.copyUsageToTarget(
      sourceArticleId,
      targetArticleId,
      'article'
    )
  }

  async deactivateArticleMediaUsage(articleId: string): Promise<void> {
    await mediaGovernanceService.deactivateUsageByTarget('article', articleId)
  }
}

/**
 * 全域文章媒體管理器實例
 * Global article media manager instance
 */
export const articleMediaManager = new ArticleMediaManager()

/**
 * 文章媒體管理器工廠函數
 * Article media manager factory function
 */
export function createArticleMediaManager(): ArticleMediaManager {
  return new ArticleMediaManager()
}
