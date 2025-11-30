/**
 * MockStorageAdapter 單元測試
 * MockStorageAdapter Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MockStorageAdapter } from '@/adapters/MockStorageAdapter'

describe('MockStorageAdapter', () => {
  let adapter: MockStorageAdapter

  beforeEach(() => {
    adapter = new MockStorageAdapter(false) // No delay for faster tests
  })

  afterEach(() => {
    adapter.clear()
  })

  describe('upload', () => {
    it('should upload a file successfully', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const result = await adapter.upload('test-bucket', 'test-path/test.txt', file)

      expect(result.success).toBe(true)
      expect(result.data.path).toBe('test-path/test.txt')
    })

    it('should report progress during upload', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const progressUpdates: number[] = []

      await adapter.upload(
        'test-bucket',
        'test-path/test.txt',
        file,
        {},
        (progress) => {
          progressUpdates.push(progress.percentage)
        }
      )

      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[0]).toBe(0) // Start at 0%
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100) // End at 100%
    })

    it('should store file in memory', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      await adapter.upload('test-bucket', 'test-path/test.txt', file)

      expect(adapter.getBucketFileCount('test-bucket')).toBe(1)
    })
  })

  describe('download', () => {
    it('should download an uploaded file', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      await adapter.upload('test-bucket', 'test-path/test.txt', file)

      const downloaded = await adapter.download('test-bucket', 'test-path/test.txt')

      // Verify it's a Blob with the correct size
      expect(downloaded).toBeInstanceOf(Blob)
      expect(downloaded.size).toBeGreaterThan(0)
    })

    it('should throw error for non-existent file', async () => {
      await expect(adapter.download('test-bucket', 'non-existent.txt')).rejects.toThrow(
        'not found'
      )
    })

    it('should throw error for non-existent bucket', async () => {
      await expect(
        adapter.download('non-existent-bucket', 'test.txt')
      ).rejects.toThrow('not found')
    })
  })

  describe('delete', () => {
    it('should delete an uploaded file', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      await adapter.upload('test-bucket', 'test-path/test.txt', file)

      expect(adapter.getBucketFileCount('test-bucket')).toBe(1)

      const result = await adapter.delete('test-bucket', 'test-path/test.txt')
      expect(result.success).toBe(true)
      expect(adapter.getBucketFileCount('test-bucket')).toBe(0)
    })

    it('should throw error when deleting non-existent file', async () => {
      const result = await adapter.delete('test-bucket', 'non-existent.txt')
      expect(result.success).toBe(false)
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      // Upload multiple files
      for (let i = 0; i < 3; i++) {
        const file = new File([`content ${i}`], `file${i}.txt`, { type: 'text/plain' })
        await adapter.upload('test-bucket', `files/file${i}.txt`, file)
      }
    })

    it('should list files in a directory', async () => {
      const files = await adapter.list('test-bucket', 'files/')

      expect(files.length).toBeGreaterThan(0)
    })

    it('should support pagination', async () => {
      const page1 = await adapter.list('test-bucket', 'files/', { limit: 2, offset: 0 })
      const page2 = await adapter.list('test-bucket', 'files/', { limit: 2, offset: 2 })

      expect(page1.length).toBeLessThanOrEqual(2)
      expect(page2.length).toBeLessThanOrEqual(2)
    })

    it('should return empty array for non-existent bucket', async () => {
      const files = await adapter.list('non-existent-bucket', 'files/')
      expect(files).toEqual([])
    })
  })

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      await adapter.upload('test-bucket', 'test.txt', file)

      const exists = await adapter.exists('test-bucket', 'test.txt')
      expect(exists).toBe(true)
    })

    it('should return false for non-existent file', async () => {
      const exists = await adapter.exists('test-bucket', 'non-existent.txt')
      expect(exists).toBe(false)
    })
  })

  describe('getPublicUrl', () => {
    it('should return a public URL', () => {
      const url = adapter.getPublicUrl('test-bucket', 'test.txt')

      expect(url).toContain('test-bucket')
      expect(url).toContain('test.txt')
    })

    it('should return consistent URLs', () => {
      const url1 = adapter.getPublicUrl('test-bucket', 'test.txt')
      const url2 = adapter.getPublicUrl('test-bucket', 'test.txt')

      expect(url1).toBe(url2)
    })
  })

  describe('getSignedUrl', () => {
    it('should return a signed URL with expiration', async () => {
      const url = await adapter.getSignedUrl('test-bucket', 'test.txt', 3600)

      expect(url).toContain('test-bucket')
      expect(url).toContain('test.txt')
      expect(url).toContain('expires')
    })
  })

  describe('getMetadata', () => {
    it('should return metadata for uploaded file', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      await adapter.upload('test-bucket', 'test.txt', file)

      const metadata = await adapter.getMetadata('test-bucket', 'test.txt')

      expect(metadata.name).toBe('test.txt')
      expect(metadata.size).toBeGreaterThan(0)
      expect(metadata.mimeType).toBe('text/plain')
    })

    it('should throw error for non-existent file', async () => {
      await expect(
        adapter.getMetadata('test-bucket', 'non-existent.txt')
      ).rejects.toThrow('not found')
    })
  })

  describe('copy', () => {
    it('should copy a file to a new location', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      await adapter.upload('test-bucket', 'source.txt', file)

      const result = await adapter.copy('test-bucket', 'source.txt', 'destination.txt')

      expect(result.success).toBe(true)
      expect(await adapter.exists('test-bucket', 'destination.txt')).toBe(true)
    })
  })

  describe('move', () => {
    it('should move a file to a new location', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      await adapter.upload('test-bucket', 'source.txt', file)

      const result = await adapter.move('test-bucket', 'source.txt', 'destination.txt')

      expect(result.success).toBe(true)
      expect(await adapter.exists('test-bucket', 'source.txt')).toBe(false)
      expect(await adapter.exists('test-bucket', 'destination.txt')).toBe(true)
    })
  })

  describe('getProviderName', () => {
    it('should return correct provider name', () => {
      expect(adapter.getProviderName()).toBe('MockStorage')
    })
  })

  describe('getStats', () => {
    it('should return storage statistics', async () => {
      const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' })
      const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' })

      await adapter.upload('bucket1', 'file1.txt', file1)
      await adapter.upload('bucket2', 'file2.txt', file2)

      const stats = await adapter.getStats()

      expect(stats.fileCount).toBeGreaterThanOrEqual(2)
      expect(stats.buckets.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('clear', () => {
    it('should clear all stored data', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      await adapter.upload('test-bucket', 'test.txt', file)

      expect(adapter.getBucketFileCount('test-bucket')).toBe(1)

      adapter.clear()

      expect(adapter.getBucketFileCount('test-bucket')).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should handle upload of large files', async () => {
      const largeContent = new Array(1024 * 1024).fill('x').join('') // 1MB string
      const file = new File([largeContent], 'large.txt', { type: 'text/plain' })

      const result = await adapter.upload('test-bucket', 'large.txt', file)
      expect(result.success).toBe(true)
    })

    it('should handle special characters in file paths', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const path = 'files/with-special_chars.123/test.txt'

      const result = await adapter.upload('test-bucket', path, file)
      expect(result.success).toBe(true)
      expect(await adapter.exists('test-bucket', path)).toBe(true)
    })
  })
})
