import { describe, expect, it, vi } from 'vitest'
const database = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [], rowCount: 0 })) }))
vi.mock('#/lib/db', () => database)
import { from, runSerializedQuery } from '#/lib/query'

describe('explicit upsert conflict keys', () => {
  it('encodes JSONB arrays while preserving native SQL array parameters', async () => {
    await from('email_template_revisions').insert({
      template_id: 'template',
      revision_number: 1,
      subject_template: 'Subject',
      body_template: 'Body',
      blocks: [{ type: 'custom-html', order: 0 }],
    })
    expect(database.query.mock.lastCall![1]).toEqual([
      'template',
      1,
      'Subject',
      'Body',
      '[{"type":"custom-html","order":0}]',
    ])

    await from('articles').update({
      restricted_to_classes: ['C6'],
      class_ids: ['C6'],
    }).eq('id', 'article')
    expect(database.query.mock.lastCall![1]).toEqual(['["C6"]', ['C6'], 'article'])

    await from('email_template_revisions').upsert({
      id: 'revision',
      blocks: [],
    }, { onConflict: 'id' })
    expect(database.query.mock.lastCall![1]).toEqual(['revision', '[]'])

    await from('newsletter_articles').upsert({
      id: 'junction',
      target_class_ids: [],
    }, { onConflict: 'id' })
    expect(database.query.mock.lastCall![1]).toEqual(['junction', []])
  })

  it('preserves the provider/family uniqueness contract', async () => {
    const result = await from('email_platform_subscriber_mappings').upsert({ provider: 'kit', family_id: 'family', email: 'test@example.test' }, { onConflict: 'provider,family_id' })
    expect(result.error).toBeNull()
    const [sql, values] = database.query.mock.lastCall!
    expect(sql).toContain('ON CONFLICT ("provider", "family_id") DO UPDATE SET "email" = EXCLUDED."email"')
    expect(values).toEqual(['kit', 'family', 'test@example.test'])
  })
  it('carries composite keys through the serialized HTTP boundary', async () => {
    await runSerializedQuery({ table: 'media_usage', mutation: { type: 'upsert', payload: { media_id: 'm', target_id: 't', active: true }, onConflict: 'media_id,target_id' } })
    expect(database.query.mock.lastCall![0]).toContain('ON CONFLICT ("media_id", "target_id")')
  })
  it('rejects SQL in conflict identifiers before executing any query', async () => {
    database.query.mockClear()
    const result = await from('media_usage').upsert({ id: 'm' }, { onConflict: 'id); DROP TABLE media_usage;--' })
    expect(result.error?.message).toContain('Invalid identifier')
    expect(database.query).not.toHaveBeenCalled()
  })
  it('uses DO NOTHING when every supplied column is a conflict key', async () => {
    await from('media_usage').upsert({ id: 'm' })
    expect(database.query.mock.lastCall![0]).toContain('ON CONFLICT ("id") DO NOTHING')
  })
})
