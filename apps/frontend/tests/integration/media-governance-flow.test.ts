import { beforeEach, describe, expect, it, vi } from 'vitest'
import { articleMediaManager } from '@/services/articleMediaManager'
import { mediaGovernanceService } from '@/services/mediaGovernanceService'
import { getSupabaseClient } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
}))

describe('media governance integration flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tracks usage on article media insert/remove flow', async () => {
    const selectSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqMedia = vi.fn(() => ({ single: selectSingle }))
    const eqArticle = vi.fn(() => ({ eq: eqMedia }))
    const select = vi.fn(() => ({ eq: eqArticle }))
    const insert = vi.fn().mockResolvedValue({ error: null })
    const deleteEqMedia = vi.fn().mockResolvedValue({ error: null })
    const deleteEqArticle = vi.fn(() => ({ eq: deleteEqMedia }))
    const deleteFn = vi.fn(() => ({ eq: deleteEqArticle }))

    const from = vi.fn((table: string) => {
      if (table === 'article_media_references') {
        return {
          select,
          insert,
          delete: deleteFn,
        }
      }
      return {
        select: vi.fn(),
      }
    })

    ;(getSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from,
    })

    const registerSpy = vi
      .spyOn(mediaGovernanceService, 'registerUsage')
      .mockResolvedValue(undefined)
    const deactivateSpy = vi
      .spyOn(mediaGovernanceService, 'deactivateUsage')
      .mockResolvedValue(undefined)

    const addResult = await articleMediaManager.addMediaToArticle('article-1', 'media-1')
    const removeResult = await articleMediaManager.removeMediaFromArticle('article-1', 'media-1')

    expect(addResult.success).toBe(true)
    expect(removeResult.success).toBe(true)
    expect(registerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: 'media-1',
        targetId: 'article-1',
      })
    )
    expect(deactivateSpy).toHaveBeenCalledWith(
      'media-1',
      'article',
      'article-1',
      'article_media:media-1'
    )
  })

  it('preserves references in article copy flow', async () => {
    const copySpy = vi
      .spyOn(mediaGovernanceService, 'copyUsageToTarget')
      .mockResolvedValue(undefined)

    await articleMediaManager.copyArticleMediaUsage('source-article', 'copied-article')

    expect(copySpy).toHaveBeenCalledWith(
      'source-article',
      'copied-article',
      'article'
    )
  })

  it('re-validates before dashboard cleanup delete', async () => {
    const service = mediaGovernanceService
    vi.spyOn(service, 'getDeletePreflight').mockResolvedValue({
      mediaId: 'media-1',
      canDelete: false,
      activeUsageCount: 1,
      impacts: [
        {
          usageId: 'usage-1',
          targetType: 'article',
          targetId: 'article-1',
          contextKey: 'article_media:media-1',
        },
      ],
    })

    await expect(
      service.safeDeleteUnusedMedia('media-1', 'user-1', 'dashboard_cleanup')
    ).rejects.toThrow('Cannot delete media while active references exist')
  })

  it('writes deletion audit after unused media cleanup succeeds', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const deleteFn = vi.fn(() => ({ eq: deleteEq }))
    const auditInsert = vi.fn().mockResolvedValue({ error: null })

    const from = vi.fn((table: string) => {
      if (table === 'media_files') {
        return {
          delete: deleteFn,
        }
      }

      if (table === 'media_deletion_audit') {
        return {
          insert: auditInsert,
        }
      }

      return {
        select: vi.fn(),
      }
    })

    ;(getSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from,
    })

    vi.spyOn(mediaGovernanceService, 'getDeletePreflight').mockResolvedValue({
      mediaId: 'media-1',
      canDelete: true,
      activeUsageCount: 0,
      impacts: [],
    })

    await mediaGovernanceService.safeDeleteUnusedMedia(
      'media-1',
      'user-1',
      'dashboard_cleanup'
    )

    expect(deleteEq).toHaveBeenCalledWith('id', 'media-1')
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        media_id: 'media-1',
        deleted_by: 'user-1',
        reason: 'dashboard_cleanup',
        preflight_usage_count: 0,
      })
    )
  })
})
