/**
 * 文章媒體管理服務 - 處理文章與媒體檔案的關聯管理
 * Article Media Manager Service - Manages relationships between articles and media files
 */

import { getSupabaseClient } from '@/lib/supabase'
import type { MediaFile } from '@/types/media'

/**
 * 文章媒體管理服務類
 * Article Media Manager Service class
 */
export class ArticleMediaManager {
  /**
   * 取得文章的所有媒體檔案
   * Get all media files for an article
   */
  async getArticleMedia(articleId: string): Promise<MediaFile[]> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('article_media_references')
        .select(
          `
          media_files (
            id,
            fileName,
            fileSize,
            mimeType,
            mediaType,
            status,
            storageUrl,
            width,
            height,
            duration,
            uploadedBy,
            uploadedAt,
            updatedAt
          )
        `
        )
        .eq('article_id', articleId)

      if (error) throw error

      // 平坦化結果
      // Flatten results
      return (data || [])
        .map((ref: any) => ref.media_files)
        .filter(Boolean) as MediaFile[]
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
      const supabase = getSupabaseClient()
      // 檢查關聯是否已存在
      // Check if reference already exists
      const { data: existing } = await supabase
        .from('article_media_references')
        .select('id')
        .eq('article_id', articleId)
        .eq('media_id', mediaId)
        .single()

      if (existing) {
        // 若已存在，更新屬性
        // If already exists, update properties
        const { error: updateError } = await supabase
          .from('article_media_references')
          .update({
            properties: properties || {},
            updated_at: new Date().toISOString(),
          })
          .eq('article_id', articleId)
          .eq('media_id', mediaId)

        if (updateError) throw updateError
      } else {
        // 建立新關聯
        // Create new reference
        const { error: insertError } = await supabase
          .from('article_media_references')
          .insert({
            article_id: articleId,
            media_id: mediaId,
            properties: properties || {},
          })

        if (insertError) throw insertError
      }

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
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('article_media_references')
        .delete()
        .eq('article_id', articleId)
        .eq('media_id', mediaId)

      if (error) throw error

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
      const mediaIds = references.map((ref: any) => ref.media_id)
      const supabase2 = getSupabaseClient()
      const { data: existingMedia, error: mediaError } = await supabase2
        .from('media_files')
        .select('id')
        .in('id', mediaIds)

      if (mediaError) throw mediaError

      const existingIds = (existingMedia || []).map((m: any) => m.id)
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
      // 找出未被參考的媒體檔案
      // Find unreferenced media files
      const { data: orphaned, error } = await supabase
        .from('media_files')
        .select(
          `
          id,
          fileName,
          fileSize,
          mimeType,
          mediaType,
          status,
          storageUrl,
          width,
          height,
          duration,
          uploadedBy,
          uploadedAt,
          updatedAt
        `
        )
        .eq('uploaded_by', userId)
        .not(
          'id',
          'in',
          `(SELECT media_id FROM article_media_references)`
        )

      if (error) throw error

      return (orphaned || []) as MediaFile[]
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
      // 刪除資料庫記錄
      // Delete database records
      const { error: dbError } = await supabase
        .from('media_files')
        .delete()
        .in('id', mediaIds)

      if (dbError) throw dbError

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
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('article_media_references')
        .update({
          properties,
          updated_at: new Date().toISOString(),
        })
        .eq('article_id', articleId)
        .eq('media_id', mediaId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Failed to update media properties:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
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
