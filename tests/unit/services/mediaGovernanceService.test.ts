import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaGovernanceService } from '@/services/mediaGovernanceService'
import { getSupabaseClient } from '@/lib/supabase'
import { imageOptimizer } from '@/services/imageOptimizer'
import { storageService } from '@/services/storageService'

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
}))

vi.mock('@/services/imageOptimizer', () => ({
  imageOptimizer: {
    optimize: vi.fn(),
    convertFormat: vi.fn(),
  },
}))

vi.mock('@/services/storageService', () => ({
  storageService: {
    upload: vi.fn(),
    getSignedUrl: vi.fn(),
  },
}))

describe('MediaGovernanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks safe-delete when active usage exists', async () => {
    const service = new MediaGovernanceService()
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
      service.safeDeleteUnusedMedia('media-1', 'user-1', 'cleanup')
    ).rejects.toThrow('Cannot delete media while active references exist')
  })

  it('creates default image variants when enqueuing', async () => {
    const service = new MediaGovernanceService()
    const upsertSpy = vi
      .spyOn(service, 'upsertVariant')
      .mockResolvedValue(undefined)

    await service.enqueueDefaultVariantsForMedia('media-image-1', 'image')

    expect(upsertSpy).toHaveBeenCalledTimes(3)
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: 'media-image-1',
        variantType: 'webp',
      })
    )
  })

  it('processes queued image variants into ready assets', async () => {
    const service = new MediaGovernanceService()
    const upsertSpy = vi
      .spyOn(service, 'upsertVariant')
      .mockResolvedValue(undefined)

    const sourceFile = new File(['image-bytes'], 'hero.png', {
      type: 'image/png',
    })
    const webpFile = new File(['webp-bytes'], 'hero.webp', {
      type: 'image/webp',
    })
    const thumbnailFile = new File(['thumb-bytes'], 'hero-thumb.webp', {
      type: 'image/webp',
    })

    vi.mocked(imageOptimizer.convertFormat).mockResolvedValue(webpFile)
    vi.mocked(imageOptimizer.optimize).mockResolvedValue({
      originalFile: sourceFile,
      optimizedFile: thumbnailFile,
      originalSize: sourceFile.size,
      optimizedSize: thumbnailFile.size,
      compressionRatio: 50,
      width: 320,
      height: 160,
      format: 'image/webp',
    })
    vi.mocked(storageService.upload).mockResolvedValue({
      success: true,
      data: { path: 'variants/path.webp' },
    })

    await service.processDefaultVariantsForMedia({
      mediaId: 'media-image-1',
      mediaType: 'image',
      sourceFile,
      sourceStoragePath: 'user/2026/03/media-image-1.png',
      dimensions: {
        width: 1200,
        height: 600,
      },
    })

    expect(imageOptimizer.convertFormat).toHaveBeenCalledTimes(1)
    expect(imageOptimizer.optimize).toHaveBeenCalledTimes(2)
    expect(storageService.upload).toHaveBeenCalledTimes(3)
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: 'media-image-1',
        variantType: 'thumbnail',
        status: 'ready',
      })
    )
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: 'media-image-1',
        variantType: 'webp',
        status: 'ready',
      })
    )
  })

  it('maps delete preflight impacts from media_usage rows', async () => {
    const eqActive = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'usage-1',
          target_type: 'article',
          target_id: 'article-1',
          context_key: 'article_media:media-1',
        },
      ],
      error: null,
    })
    const eqMedia = vi.fn(() => ({ eq: eqActive }))
    const select = vi.fn(() => ({ eq: eqMedia }))
    const from = vi.fn(() => ({ select }))

    ;(getSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from,
    })

    const service = new MediaGovernanceService()
    const result = await service.getDeletePreflight('media-1')

    expect(result.canDelete).toBe(false)
    expect(result.activeUsageCount).toBe(1)
    expect(result.impacts[0]).toEqual({
      usageId: 'usage-1',
      targetType: 'article',
      targetId: 'article-1',
      contextKey: 'article_media:media-1',
    })
  })
})
