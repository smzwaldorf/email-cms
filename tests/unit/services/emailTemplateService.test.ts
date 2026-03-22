import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emailTemplateService } from '@/services/emailTemplateService'

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  then: vi.fn((resolve) => resolve({ data: [], error: null })),
}

const mockSupabase = {
  from: vi.fn(() => mockBuilder),
}

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
}))

describe('emailTemplateService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(mockBuilder).forEach((mock) => {
      if ('mockReturnThis' in mock) {
        // @ts-expect-error test harness helper
        mock.mockReturnThis()
      }
    })
  })

  it('creates a template with initial revision', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'template-1',
            name: 'Welcome',
            description: null,
            state: 'active',
            current_revision_id: null,
            created_at: '2026-03-20T10:00:00Z',
            updated_at: '2026-03-20T10:00:00Z',
          },
          error: null,
        }),
      )
      .mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'rev-1',
            template_id: 'template-1',
            revision_number: 1,
            subject_template: 'Hello {{guardian.email}}',
            body_template: 'Body',
            created_at: '2026-03-20T10:00:01Z',
          },
          error: null,
        }),
      )
      .mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'template-1',
            name: 'Welcome',
            description: null,
            state: 'active',
            current_revision_id: 'rev-1',
            created_at: '2026-03-20T10:00:00Z',
            updated_at: '2026-03-20T10:00:01Z',
          },
          error: null,
        }),
      )

    const created = await emailTemplateService.createTemplate({
      name: 'Welcome',
      subjectTemplate: 'Hello {{guardian.email}}',
      bodyTemplate: 'Body',
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('email_templates')
    expect(mockSupabase.from).toHaveBeenCalledWith('email_template_revisions')
    expect(created.template.currentRevisionId).toBe('rev-1')
    expect(created.revision.revisionNumber).toBe(1)
    expect(created.validation.valid).toBe(true)
  })

  it('blocks save for invalid tokens', async () => {
    await expect(
      emailTemplateService.createTemplate({
        name: 'Welcome',
        subjectTemplate: 'Hello {{unsupported.token}}',
        bodyTemplate: 'Body',
      }),
    ).rejects.toMatchObject({
      code: 'EMAIL_TEMPLATE_VALIDATION_ERROR',
    })
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })
})

