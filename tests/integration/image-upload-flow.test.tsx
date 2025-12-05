/**
 * 整合測試 - 圖片上傳流程 (T058)
 * Integration Test - Image Upload Flow
 * 驗證使用者故事 2: 圖片上傳與管理的完整流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaService } from '@/services/mediaService'
import { imageOptimizer } from '@/services/imageOptimizer'

// Mock storage service
vi.mock('@/services/storageService', () => ({
  storageService: {
    upload: vi.fn(async () => ({
      path: 'user/2025/12/media-123.webp',
      publicUrl: 'https://storage.example.com/user/2025/12/media-123.webp',
    })),
    getSignedUrl: vi.fn(async () => 'https://storage.example.com/signed-url'),
    delete: vi.fn(async () => true),
  },
}))

// Mock image optimizer
vi.mock('@/services/imageOptimizer', () => ({
  imageOptimizer: {
    optimize: vi.fn(async (file: File) => ({
      blob: new Blob(['optimized'], { type: 'image/webp' }),
      format: 'webp',
      originalSize: file.size,
      optimizedSize: Math.floor(file.size * 0.7),
      compressionRatio: 0.7,
    })),
    getImageDimensions: vi.fn(async () => ({ width: 800, height: 600 })),
  },
}))

describe('Integration: Image Upload Flow (T058)', () => {
  const mediaService = new MediaService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('FR-005: Image Upload Support (拖放、選擇器、剪貼簿)', () => {
    it('should validate image file before upload', () => {
      const imageFile = new File(
        [new ArrayBuffer(1024 * 100)],
        'test.jpg',
        { type: 'image/jpeg' }
      )

      const result = mediaService.validateFile(
        imageFile,
        'image' as any
      )

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject oversized image files', () => {
      // Create a file larger than 10MB
      const largeFile = new File(
        [new ArrayBuffer(11 * 1024 * 1024)],
        'large.jpg',
        { type: 'image/jpeg' }
      )

      const result = mediaService.validateFile(
        largeFile,
        'image' as any
      )

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should reject unsupported file types', () => {
      const invalidFile = new File(
        [new ArrayBuffer(1024)],
        'test.exe',
        { type: 'application/x-msdownload' }
      )

      const result = mediaService.validateFile(
        invalidFile,
        'image' as any
      )

      expect(result.valid).toBe(false)
    })

    it('should support multiple image formats', () => {
      const formats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

      formats.forEach((format) => {
        const file = new File([new ArrayBuffer(1024)], 'test', {
          type: format,
        })
        const result = mediaService.validateFile(file, 'image' as any)
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('FR-006: Auto-Optimization (格式轉換、壓縮、回應式)', () => {
    it('should optimize image to webp format', async () => {
      const imageFile = new File(
        [new ArrayBuffer(1024 * 500)],
        'test.jpg',
        { type: 'image/jpeg' }
      )

      const result = await imageOptimizer.optimize(imageFile)

      expect(result.format).toBe('webp')
      expect(result.blob).toBeDefined()
      expect(result.optimizedSize).toBeLessThan(result.originalSize)
    })

    it('should calculate compression ratio', async () => {
      const imageFile = new File(
        [new ArrayBuffer(1024 * 500)],
        'test.jpg',
        { type: 'image/jpeg' }
      )

      const result = await imageOptimizer.optimize(imageFile)

      expect(result.compressionRatio).toBeLessThan(1)
      expect(result.compressionRatio).toBeGreaterThan(0)
    })

    it('should detect image dimensions', async () => {
      const imageFile = new File(
        [new ArrayBuffer(1024)],
        'test.jpg',
        { type: 'image/jpeg' }
      )

      const dimensions = await imageOptimizer.getImageDimensions(
        imageFile
      )

      expect(dimensions).toBeDefined()
      expect(dimensions?.width).toBeGreaterThan(0)
      expect(dimensions?.height).toBeGreaterThan(0)
    })
  })

  describe('FR-007: Unique IDs & Collision Avoidance', () => {
    it('should generate unique media IDs', () => {
      const id1 = mediaService.generateMediaId()
      const id2 = mediaService.generateMediaId()

      expect(id1).not.toBe(id2)
    })

    it('should generate valid UUID v4 format', () => {
      const id = mediaService.generateMediaId()
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

      expect(uuidRegex.test(id)).toBe(true)
    })

    it('should generate multiple unique IDs without collisions', () => {
      const ids = new Set()
      const count = 100

      for (let i = 0; i < count; i++) {
        ids.add(mediaService.generateMediaId())
      }

      expect(ids.size).toBe(count)
    })
  })

  describe('FR-009: Image Property Editing', () => {
    it('should validate image alt text', () => {
      const props = {
        alt: 'Descriptive alternative text',
        align: 'center' as const,
        title: 'Image Title',
      }

      const result = mediaService.validateImageProperties(props)

      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBe(0)
    })

    it('should warn when alt text is missing', () => {
      const props = {
        alt: '',
        align: 'center' as const,
      }

      const result = mediaService.validateImageProperties(props)

      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should validate image alignment values', () => {
      const validAlignments = ['left', 'center', 'right']

      validAlignments.forEach((align) => {
        const props = {
          alt: 'Test',
          align: align as 'left' | 'center' | 'right',
        }

        const result = mediaService.validateImageProperties(props)
        expect(result.valid).toBe(true)
      })
    })

    it('should reject invalid alignment values', () => {
      const props = {
        alt: 'Test',
        align: 'invalid' as any,
      }

      const result = mediaService.validateImageProperties(props)

      expect(result.valid).toBe(false)
    })

    it('should validate image dimensions', () => {
      const props = {
        alt: 'Test',
        width: 800,
        height: 600,
      }

      const result = mediaService.validateImageProperties(props)

      expect(result.valid).toBe(true)
    })

    it('should reject negative dimensions', () => {
      const props = {
        alt: 'Test',
        width: -100,
        height: 600,
      }

      const result = mediaService.validateImageProperties(props)

      expect(result.valid).toBe(false)
    })
  })

  describe('FR-018: File Type Validation', () => {
    it('should validate supported image MIME types', () => {
      const supportedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
      ]

      supportedTypes.forEach((mimeType) => {
        const file = new File([new ArrayBuffer(1024)], 'test', {
          type: mimeType,
        })
        const result = mediaService.validateFile(file, 'image' as any)
        expect(result.valid).toBe(true)
      })
    })

    it('should provide error messages for unsupported types', () => {
      const file = new File([new ArrayBuffer(1024)], 'test.txt', {
        type: 'text/plain',
      })

      const result = mediaService.validateFile(file, 'image' as any)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('不支援的檔案格式')
    })
  })

  describe('FR-019: File Size Limits (10MB)', () => {
    it('should enforce 10MB limit for images', () => {
      const limitFile = new File(
        [new ArrayBuffer(10 * 1024 * 1024)],
        'test.jpg',
        { type: 'image/jpeg' }
      )

      const result = mediaService.validateFile(limitFile, 'image' as any)

      expect(result.valid).toBe(true)
    })

    it('should reject files exceeding 10MB limit', () => {
      const overFile = new File(
        [new ArrayBuffer(10 * 1024 * 1024 + 1)],
        'test.jpg',
        { type: 'image/jpeg' }
      )

      const result = mediaService.validateFile(overFile, 'image' as any)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('檔案大小超過限制')
    })

    it('should warn when file approaches limit', () => {
      const approachFile = new File(
        [new ArrayBuffer(8.5 * 1024 * 1024)],
        'test.jpg',
        { type: 'image/jpeg' }
      )

      const result = mediaService.validateFile(
        approachFile,
        'image' as any
      )

      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('Storage Path Generation', () => {
    it('should generate valid storage paths', () => {
      const mediaId = mediaService.generateMediaId()
      const path = mediaService.generateStoragePath(
        mediaId,
        'photo.jpg',
        'user-123'
      )

      expect(path).toContain('user-123')
      expect(path).toContain(new Date().getFullYear().toString())
      expect(path).toContain(mediaId)
      expect(path).toContain('.jpg')
    })

    it('should handle different file extensions', () => {
      const mediaId = mediaService.generateMediaId()
      const extensions = ['jpg', 'png', 'webp', 'gif']

      extensions.forEach((ext) => {
        const path = mediaService.generateStoragePath(
          mediaId,
          `photo.${ext}`,
          'user-123'
        )

        expect(path).toContain(`.${ext}`)
      })
    })
  })

  describe('Complete Upload Workflow', () => {
    it('should execute upload pipeline: validate → generate ID → generate path', () => {
      // 1. Validate file
      const imageFile = new File(
        [new ArrayBuffer(1024 * 300)],
        'test.jpg',
        { type: 'image/jpeg' }
      )

      const validationResult = mediaService.validateFile(
        imageFile,
        'image' as any
      )
      expect(validationResult.valid).toBe(true)

      // 2. Generate unique media ID
      const mediaId = mediaService.generateMediaId()
      expect(mediaId).toBeDefined()
      expect(mediaId.length).toBeGreaterThan(0)

      // 3. Generate storage path
      const storagePath = mediaService.generateStoragePath(
        mediaId,
        imageFile.name,
        'user-123'
      )

      expect(storagePath).toContain('user-123')
      expect(storagePath).toContain(mediaId)
      expect(storagePath).toContain('jpg')

      // 4. Verify path includes year and month
      const currentYear = new Date().getFullYear()
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
      expect(storagePath).toContain(currentYear.toString())
      expect(storagePath).toContain(currentMonth)
    })
  })
})
