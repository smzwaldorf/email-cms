import { beforeEach, describe, expect, it, vi } from 'vitest'
const boundary = vi.hoisted(() => ({ email: vi.fn(), sign: vi.fn() }))
vi.mock('#/services/r2MediaService', () => ({ emailMediaUrl: boundary.email }))
vi.mock('#/services/storageService', () => ({ storageService: { getSignedUrl: boundary.sign } }))
import { replaceEmailStorageTokens } from '#/utils/contentParser'
beforeEach(() => { boundary.email.mockReset().mockResolvedValue('https://media.smzwaldorf.com/media/asset.png'); boundary.sign.mockReset() })
describe('permanent email media rendering', () => {
  it('replaces repeated canonical references with one permanent URL without calling the editor signer', async () => {
    const html = await replaceEmailStorageTokens('<img src="storage://media/production/asset.png"><img src="storage://media/production/asset.png">')
    expect(html).toBe('<img src="https://media.smzwaldorf.com/media/asset.png"><img src="https://media.smzwaldorf.com/media/asset.png">')
    expect(boundary.email).toHaveBeenCalledOnce(); expect(boundary.sign).not.toHaveBeenCalled()
  })
  it('blocks mail preparation when image approval is missing', async () => {
    boundary.email.mockRejectedValue(new Error('requires explicit public email approval'))
    await expect(replaceEmailStorageTokens('<img src="storage://media/staging/draft.png">')).rejects.toThrow('approval')
  })
  it('rejects persisted editor tokens and unsupported storage while preserving ordinary external images', async () => {
    await expect(replaceEmailStorageTokens('<img src="https://cms.smzwaldorf.com/api/media/asset/content?token=short">')).rejects.toThrow('expiring')
    await expect(replaceEmailStorageTokens('<img src="storage://other/file">')).rejects.toThrow('Unsupported')
    expect(await replaceEmailStorageTokens('<img src="https://static.school.test/garden.jpg">')).toContain('static.school.test')
  })
})
