import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCmsMemoryStore } from '../../helpers/cmsMemoryStore'
const boundary = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('#/lib/supabase', () => ({ getSupabaseClient: () => boundary.client }))
vi.mock('#/services/mediaGovernanceService', () => ({ mediaGovernanceService: {} }))
import { articleMediaManager } from '#/services/articleMediaManager'
let store: ReturnType<typeof createCmsMemoryStore>
const file = (id: string, uploaded_by = 'user') => ({ id, uploaded_by, filename: 'photo.png', file_size: '2048', file_type: 'image', mime_type: 'image/png', storage_path: 'photo.png', public_url: 'https://assets.school.test/photo.png', duration: '1.5', width: 10, height: 20, uploaded_at: '2026-09-12', updated_at: '2026-09-12' })
beforeEach(() => { store = createCmsMemoryStore(); boundary.client = { from: store.from } })
describe('SQL media rows', () => {
  it('maps nested snake-case rows and PostgreSQL numeric strings into media DTOs', async () => {
    store.rows('article_media_references').push({ article_id: 'article', media_files: file('linked') })
    const rows = await articleMediaManager.getArticleMedia('article')
    expect(rows[0]).toMatchObject({ id: 'linked', fileName: 'photo.png', fileSize: 2048, duration: 1.5, mediaType: 'image', storageUrl: 'storage://media/photo.png' })
  })
  it('finds only the current owner’s unreferenced files without SQL in filters', async () => {
    store.rows('media_files').push(file('linked'), file('orphan'), file('other-owner', 'other'))
    store.rows('article_media_references').push({ media_id: 'linked' })
    expect((await articleMediaManager.findOrphanedFiles('user')).map(row => row.id)).toEqual(['orphan'])
  })
})
