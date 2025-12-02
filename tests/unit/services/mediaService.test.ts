/**
 * MediaService 單元測試
 * MediaService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mediaService, MediaService } from '@/services/mediaService'
import type { ImageProperties, AudioProperties } from '@/types/media'
import { MediaFileType } from '@/types/media'

// Mock browser APIs that don't exist in Node.js
class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  _src = ''
  width = 800
  height = 600

  get src(): string {
    return this._src
  }

  set src(value: string) {
    this._src = value
    // Simulate image load completion
    if (this.onload) {
      setTimeout(this.onload, 0)
    }
  }
}

class MockAudio {
  onloadedmetadata: (() => void) | null = null
  onerror: (() => void) | null = null
  _src = ''
  duration = 120

  get src(): string {
    return this._src
  }

  set src(value: string) {
    this._src = value
    // Simulate audio metadata load
    if (this.onloadedmetadata) {
      setTimeout(this.onloadedmetadata, 0)
    }
  }
}

;(global as any).Image = MockImage
;(global as any).Audio = MockAudio
;(global as any).URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
}

describe('MediaService', () => {
  const service = new MediaService()

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock File.prototype.arrayBuffer
    if (!File.prototype.arrayBuffer) {
      File.prototype.arrayBuffer = vi.fn(async function (this: any) {
        // Return a buffer from the file content
        if (this._buffer) {
          return this._buffer
        }
        const text = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve(reader.result as string)
          }
          reader.readAsText(this)
        })
        return new TextEncoder().encode(text).buffer
      })
    }
  })

  describe('validateFile', () => {
    it('should validate image file successfully', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      const result = service.validateFile(file, MediaFileType.IMAGE)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should validate audio file successfully', () => {
      const file = new File([''], 'test.mp3', { type: 'audio/mpeg' })
      const result = service.validateFile(file, MediaFileType.AUDIO)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should reject oversized image', () => {
      const largeContent = new Array(11 * 1024 * 1024).fill('x').join('') // 11MB
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
      const result = service.validateFile(file, MediaFileType.IMAGE)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('size'))).toBe(true)
    })

    it('should reject unsupported file type', () => {
      const file = new File([''], 'test.exe', { type: 'application/x-msdownload' })
      const result = service.validateFile(file, MediaFileType.IMAGE)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should validate file with warning for large size near limit', () => {
      const content = new Array(9 * 1024 * 1024).fill('x').join('') // 9MB
      const file = new File([content], 'test.jpg', { type: 'image/jpeg' })
      const result = service.validateFile(file, MediaFileType.IMAGE)

      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should reject file with invalid filename', () => {
      const file = new File([''], 'test<script>.jpg', { type: 'image/jpeg' })
      const result = service.validateFile(file, MediaFileType.IMAGE)

      expect(result.valid).toBe(false)
    })

    it('should validate PNG images', () => {
      const file = new File([''], 'test.png', { type: 'image/png' })
      const result = service.validateFile(file, MediaFileType.IMAGE)

      expect(result.valid).toBe(true)
    })

    it('should validate WebP images', () => {
      const file = new File([''], 'test.webp', { type: 'image/webp' })
      const result = service.validateFile(file, MediaFileType.IMAGE)

      expect(result.valid).toBe(true)
    })

    it('should validate audio formats', () => {
      const formats = [
        { name: 'test.wav', type: 'audio/wav' },
        { name: 'test.ogg', type: 'audio/ogg' },
        { name: 'test.m4a', type: 'audio/mp4' },
      ]

      formats.forEach(({ name, type }) => {
        const file = new File([''], name, { type })
        const result = service.validateFile(file, MediaFileType.AUDIO)
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('detectMediaType', () => {
    it('should detect image type', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      const result = await service.detectMediaType(file)

      expect(result.type).toBe('image')
      expect(result.confidence).toBe(1.0)
    })

    it('should detect audio type', async () => {
      const file = new File([''], 'test.mp3', { type: 'audio/mpeg' })
      const result = await service.detectMediaType(file)

      expect(result.type).toBe('audio')
      expect(result.confidence).toBe(1.0)
    })

    it('should detect video type', async () => {
      const file = new File([''], 'test.mp4', { type: 'video/mp4' })
      const result = await service.detectMediaType(file)

      expect(result.type).toBe('video')
      expect(result.confidence).toBe(1.0)
    })

    it('should default to document for unknown type', async () => {
      const file = new File([''], 'test.bin', { type: 'application/octet-stream' })
      const result = await service.detectMediaType(file)

      expect(result.type).toBe('document')
      expect(result.confidence).toBeLessThan(1.0)
    })
  })

  describe('generateMediaId', () => {
    it('should generate unique IDs', () => {
      const id1 = service.generateMediaId()
      const id2 = service.generateMediaId()

      expect(id1).not.toBe(id2)
    })

    it('should generate string IDs', () => {
      const id = service.generateMediaId()

      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should be a valid UUID', () => {
      const id = service.generateMediaId()

      // ID should be a valid UUID format (v4)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(uuidRegex.test(id)).toBe(true)
    })
  })

  describe('generateStoragePath', () => {
    it('should generate valid storage path', () => {
      const mediaId = 'test-media-123'
      const userId = 'user-456'
      const fileName = 'image.jpg'

      const path = service.generateStoragePath(mediaId, fileName, userId)

      expect(path).toContain('media')
      expect(path).toContain(userId)
      expect(path).toContain(mediaId)
      expect(path).toMatch(/\d{4}\/\d{2}/) // Year/Month format
    })

    it('should preserve file extension', () => {
      const path = service.generateStoragePath('123', 'photo.jpg', 'user-1')

      expect(path).toContain('.jpg')
    })

    it('should handle different file types', () => {
      const extensions = ['jpg', 'png', 'mp3', 'wav', 'pdf']

      extensions.forEach((ext) => {
        const path = service.generateStoragePath('123', `file.${ext}`, 'user-1')
        expect(path).toContain(`.${ext}`)
      })
    })
  })

  describe('createMediaMetadata', () => {
    it('should create metadata for image file', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      // Mock getImageDimensions to avoid FileReader issues in test environment
      const originalGetImageDimensions = service.getImageDimensions
      service.getImageDimensions = vi.fn(async () => ({ width: 800, height: 600 }))

      const metadata = await service.createMediaMetadata(file, 'id-123', 'user-456', MediaFileType.IMAGE)

      expect(metadata.id).toBe('id-123')
      expect(metadata.fileName).toBe('test.jpg')
      expect(metadata.fileSize).toBeGreaterThan(0)
      expect(metadata.mimeType).toBe('image/jpeg')
      expect(metadata.mediaType).toBe('image')
      expect(metadata.status).toBe('pending')
      // Restore
      service.getImageDimensions = originalGetImageDimensions
    })

    it('should create metadata for audio file', async () => {
      const file = new File(['test'], 'test.mp3', { type: 'audio/mpeg' })
      // Mock getAudioDuration to avoid FileReader issues in test environment
      const originalGetAudioDuration = service.getAudioDuration
      service.getAudioDuration = vi.fn(async () => 120)

      const metadata = await service.createMediaMetadata(file, 'id-456', 'user-789', MediaFileType.AUDIO)

      expect(metadata.mediaType).toBe('audio')
      expect(metadata.uploadedBy).toBe('user-789')
      // Restore
      service.getAudioDuration = originalGetAudioDuration
    })

    it('should include timestamps', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const metadata = await service.createMediaMetadata(file, 'id-789', 'user-123', MediaFileType.DOCUMENT)

      expect(metadata.uploadedAt).toBeDefined()
      expect(metadata.updatedAt).toBeDefined()
    })
  })

  describe('validateImageProperties', () => {
    it('should validate valid image properties', () => {
      const props: ImageProperties = {
        mediaId: 'img-123',
        alt: 'Descriptive text',
        align: 'center',
      }

      const result = service.validateImageProperties(props)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should warn about missing alt text', () => {
      const props: ImageProperties = {
        mediaId: 'img-123',
        alt: '',
      }

      const result = service.validateImageProperties(props)

      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should reject invalid alignment', () => {
      const props: ImageProperties = {
        mediaId: 'img-123',
        alt: 'Text',
        align: 'justify' as any,
      }

      const result = service.validateImageProperties(props)

      expect(result.valid).toBe(false)
    })

    it('should reject negative dimensions', () => {
      const props: ImageProperties = {
        mediaId: 'img-123',
        alt: 'Text',
        width: -100,
      }

      const result = service.validateImageProperties(props)

      expect(result.valid).toBe(false)
    })

    it('should accept all valid alignments', () => {
      const alignments = ['left', 'center', 'right'] as const

      alignments.forEach((align) => {
        const props: ImageProperties = {
          mediaId: 'img-123',
          alt: 'Text',
          align,
        }

        const result = service.validateImageProperties(props)
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('validateAudioProperties', () => {
    it('should validate valid audio properties', () => {
      const props: AudioProperties = {
        mediaId: 'audio-123',
        title: 'Audio Title',
      }

      const result = service.validateAudioProperties(props)

      expect(result.valid).toBe(true)
    })

    it('should require mediaId', () => {
      const props = { title: 'Title' } as any

      const result = service.validateAudioProperties(props)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('mediaId'))).toBe(true)
    })
  })

  describe('checkDuplicate', () => {
    it('should return hash for file', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const result = await service.checkDuplicate(file)

      expect(result.hash).toBeDefined()
      expect(typeof result.hash).toBe('string')
      expect(result.hash.length).toBeGreaterThan(0)
    })

    it('should return same hash for identical content', async () => {
      const content = 'same content'
      const file1 = new File([content], 'file1.txt', { type: 'text/plain' })
      const file2 = new File([content], 'file2.txt', { type: 'text/plain' })

      const result1 = await service.checkDuplicate(file1)
      const result2 = await service.checkDuplicate(file2)

      expect(result1.hash).toBe(result2.hash)
    })

    it('should return different hash for different content', async () => {
      const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' })
      const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' })

      const result1 = await service.checkDuplicate(file1)
      const result2 = await service.checkDuplicate(file2)

      expect(result1.hash).not.toBe(result2.hash)
    })
  })

  describe('getFileSizeLimit', () => {
    it('should return image size limit', () => {
      const limit = service.getFileSizeLimit(MediaFileType.IMAGE)

      expect(limit).toBeGreaterThan(0)
      expect(limit).toBeLessThanOrEqual(10 * 1024 * 1024) // 10MB or less
    })

    it('should return audio size limit', () => {
      const limit = service.getFileSizeLimit(MediaFileType.AUDIO)

      expect(limit).toBeGreaterThan(0)
      expect(limit).toBeLessThanOrEqual(50 * 1024 * 1024) // 50MB or less
    })

    it('should return larger limit for audio than image', () => {
      const imageLimit = service.getFileSizeLimit(MediaFileType.IMAGE)
      const audioLimit = service.getFileSizeLimit(MediaFileType.AUDIO)

      expect(audioLimit).toBeGreaterThanOrEqual(imageLimit)
    })
  })

  describe('global instance', () => {
    it('should export global mediaService instance', () => {
      expect(mediaService).toBeDefined()
      expect(typeof mediaService.validateFile).toBe('function')
    })

    it('should have all methods available', () => {
      expect(typeof mediaService.validateFile).toBe('function')
      expect(typeof mediaService.detectMediaType).toBe('function')
      expect(typeof mediaService.generateMediaId).toBe('function')
      expect(typeof mediaService.generateStoragePath).toBe('function')
    })
  })

  describe('integration scenarios', () => {
    it('should validate and create metadata for new file', async () => {
      const file = new File(['image data'], 'photo.jpg', { type: 'image/jpeg' })

      // Validate
      const validation = service.validateFile(file, MediaFileType.IMAGE)
      expect(validation.valid).toBe(true)

      // Mock getImageDimensions
      const originalGetImageDimensions = service.getImageDimensions
      service.getImageDimensions = vi.fn(async () => ({ width: 800, height: 600 }))

      // Create metadata
      const mediaId = service.generateMediaId()
      const metadata = await service.createMediaMetadata(file, mediaId, 'user-123', MediaFileType.IMAGE)

      expect(metadata.id).toBe(mediaId)
      expect(metadata.fileSize).toBeGreaterThan(0)
      // Restore
      service.getImageDimensions = originalGetImageDimensions
    })

    it('should handle complete file upload flow', async () => {
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' })

      // Validate file
      const validation = service.validateFile(file, MediaFileType.DOCUMENT)
      expect(validation.valid).toBe(true)

      // Generate ID and path
      const mediaId = service.generateMediaId()
      const path = service.generateStoragePath(mediaId, file.name, 'user-id')
      expect(path).toContain(mediaId)

      // Detect type
      const typeInfo = await service.detectMediaType(file)
      expect(typeInfo.type).toBe('document')

      // Create metadata
      const metadata = await service.createMediaMetadata(file, mediaId, 'user-id', MediaFileType.DOCUMENT)
      expect(metadata.id).toBe(mediaId)
    })
  })

  describe('error handling', () => {
    it('should handle very large files gracefully', () => {
      // Create 100MB+ file reference (don't actually create, just test validation)
      const file = new File([''], 'huge.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 200 * 1024 * 1024 })

      const result = service.validateFile(file, MediaFileType.IMAGE)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle files with special characters in names', async () => {
      const specialNames = [
        'photo-2024-01-15.jpg',
        'image_v2.png',
        'my.test.file.jpg',
        'файл.jpg',
      ]

      for (const name of specialNames) {
        const file = new File([''], name, { type: 'image/jpeg' })
        const result = service.validateFile(file, MediaFileType.IMAGE)

        // Should not throw, validation result should be returned
        expect(result).toBeDefined()
      }
    })
  })
})
