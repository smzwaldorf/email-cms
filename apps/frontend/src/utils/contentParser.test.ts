import { replaceStorageTokens } from './contentParser'
import { storageService } from '@/services/storageService'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/storageService', () => ({
  storageService: {
    getSignedUrl: vi.fn()
  }
}))

describe('replaceStorageTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('replaces storage:// tokens with signed URLs', async () => {
    vi.mocked(storageService.getSignedUrl).mockResolvedValue('https://signed.url/file.jpg')

    const html = '<img src="storage://media/user/file.jpg" />'
    const result = await replaceStorageTokens(html)

    expect(result).toBe('<img src="https://signed.url/file.jpg" />')
    expect(storageService.getSignedUrl).toHaveBeenCalledWith('media', 'user/file.jpg', 300)
  })

  it('handles multiple tokens', async () => {
    vi.mocked(storageService.getSignedUrl).mockImplementation(async (bucket, path) => {
      return `https://signed.url/${path}`
    })

    const html = '<img src="storage://media/1.jpg" /><img src="storage://media/2.jpg" />'
    const result = await replaceStorageTokens(html)
    
    expect(result).toBe('<img src="https://signed.url/1.jpg" /><img src="https://signed.url/2.jpg" />')
    expect(storageService.getSignedUrl).toHaveBeenCalledTimes(2)
  })
  
  it('ignores invalid tokens', async () => {
    const html = '<img src="http://example.com/file.jpg" />'
    const result = await replaceStorageTokens(html)
    expect(result).toBe(html)
    expect(storageService.getSignedUrl).not.toHaveBeenCalled()
  })

  it('handles tokens with special characters', async () => {
    vi.mocked(storageService.getSignedUrl).mockResolvedValue('https://signed.url/file.jpg')

    const html = '<img src="storage://media/user/file(1).jpg" />'
    const result = await replaceStorageTokens(html)

    expect(result).toBe('<img src="https://signed.url/file.jpg" />')
    expect(storageService.getSignedUrl).toHaveBeenCalledWith('media', 'user/file(1).jpg', 300)
  })
})
