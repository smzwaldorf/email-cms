import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emailTemplateService } from '@/services/emailTemplateService'
import type { FileEmailTemplatePreviewResult } from '@/types/fileEmailTemplate'

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
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

function validFilePreview(
  overrides: Partial<FileEmailTemplatePreviewResult> = {},
): FileEmailTemplatePreviewResult {
  const preview: FileEmailTemplatePreviewResult = {
    valid: true,
    issues: [],
    source: {
      sourceId: 'file-weekly',
      displayName: 'File Weekly',
      description: 'Filesystem template',
      folderPath: 'templates/email/file-weekly',
      metadataPath: 'templates/email/file-weekly/metadata.json',
      subjectPath: 'templates/email/file-weekly/subject.hbs',
      blockPaths: ['templates/email/file-weekly/blocks/body.hbs'],
      partialPaths: [],
    },
    manifest: {
      sourceId: 'file-weekly',
      name: 'File Weekly',
      description: 'Filesystem template',
      subject: 'subject.hbs',
      blocks: [
        {
          id: 'body',
          mode: 'custom-html',
          type: 'custom-html',
          file: 'blocks/body.hbs',
          order: 0,
        },
      ],
    },
    subjectTemplate: 'Hello {{guardian.email}}',
    renderedSubject: 'Hello guardian@example.com',
    bodyHtml: '<p>Body</p>',
    blocks: [
      {
        type: 'custom-html',
        order: 0,
        visible: true,
        bodyHtml: '<p>{{guardian.email}}</p>',
        config: { fileTemplateBlockId: 'body', fileTemplateMode: 'custom-html' },
      },
    ],
    blockPreviews: [],
    context: {
      sharedArticles: [],
      classes: [],
      weeklyItems: [],
    },
  }
  return { ...preview, ...overrides }
}

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

  it('normalizes imported html before creating a template revision', async () => {
    mockBuilder.then
      .mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'template-2',
            name: 'Imported',
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
            id: 'rev-2',
            template_id: 'template-2',
            revision_number: 1,
            subject_template: 'Hello {{guardian.email}}',
            body_template: '<table><tbody><tr><td>Imported</td></tr></tbody></table>',
            created_at: '2026-03-20T10:00:01Z',
          },
          error: null,
        }),
      )
      .mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'template-2',
            name: 'Imported',
            description: null,
            state: 'active',
            current_revision_id: 'rev-2',
            created_at: '2026-03-20T10:00:00Z',
            updated_at: '2026-03-20T10:00:01Z',
          },
          error: null,
        }),
      )

    const created = await emailTemplateService.createTemplate({
      name: 'Imported',
      subjectTemplate: 'Hello {{guardian.email}}',
      bodyTemplate: '',
      importedBodyHtml: `
        <!doctype html>
        <html>
          <body>
            <table><tr><td>Imported</td></tr></table>
          </body>
        </html>
      `,
    })

    expect(created.revision.bodyTemplate).toBe('<table><tbody><tr><td>Imported</td></tr></tbody></table>')
    expect(mockBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        body_template: '<table><tbody><tr><td>Imported</td></tr></tbody></table>',
      }),
    )
  })

  it('blocks imported html with compatibility issues', async () => {
    await expect(
      emailTemplateService.createTemplate({
        name: 'Imported',
        subjectTemplate: 'Hello {{guardian.email}}',
        bodyTemplate: '',
        importedBodyHtml: `
          <html>
            <head><style>.hero { color: red; }</style></head>
            <body><div>Imported</div></body>
          </html>
        `,
      }),
    ).rejects.toMatchObject({
      code: 'EMAIL_TEMPLATE_IMPORT_VALIDATION_ERROR',
    })
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('syncs a file template into an immutable revision for an existing template', async () => {
    const preview = validFilePreview()
    mockBuilder.then
      .mockImplementationOnce((resolve) =>
        resolve({
          data: [{ revision_number: 3 }],
          error: null,
        }),
      )
      .mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'rev-4',
            template_id: 'template-existing',
            revision_number: 4,
            subject_template: preview.subjectTemplate,
            body_template: preview.bodyHtml,
            blocks: preview.blocks,
            created_at: '2026-04-25T10:00:00Z',
          },
          error: null,
        }),
      )
      .mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'template-existing',
            name: 'File Weekly',
            description: 'Filesystem template',
            state: 'active',
            current_revision_id: 'rev-4',
            created_at: '2026-04-20T10:00:00Z',
            updated_at: '2026-04-25T10:00:00Z',
          },
          error: null,
        }),
      )

    const result = await emailTemplateService.syncFileTemplate({
      preview,
      targetTemplateId: 'template-existing',
    })

    expect(result.revision.revisionNumber).toBe(4)
    expect(result.template.currentRevisionId).toBe('rev-4')
    expect(result.template.state).toBe('active')
    expect(mockBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: 'template-existing',
        revision_number: 4,
        subject_template: preview.subjectTemplate,
        body_template: preview.bodyHtml,
        blocks: preview.blocks,
      }),
    )
    expect(mockBuilder.update).toHaveBeenCalledWith(
      expect.not.objectContaining({
        state: expect.any(String),
      }),
    )
  })

  it('syncs a new file source to a draft template with an initial revision', async () => {
    const preview = validFilePreview()
    mockBuilder.then
      .mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'template-new',
            name: 'File Weekly',
            description: 'Filesystem template',
            state: 'draft',
            current_revision_id: null,
            created_at: '2026-04-25T10:00:00Z',
            updated_at: '2026-04-25T10:00:00Z',
          },
          error: null,
        }),
      )
      .mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'rev-1',
            template_id: 'template-new',
            revision_number: 1,
            subject_template: preview.subjectTemplate,
            body_template: preview.bodyHtml,
            blocks: preview.blocks,
            created_at: '2026-04-25T10:00:01Z',
          },
          error: null,
        }),
      )
      .mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'template-new',
            name: 'File Weekly',
            description: 'Filesystem template',
            state: 'draft',
            current_revision_id: 'rev-1',
            created_at: '2026-04-25T10:00:00Z',
            updated_at: '2026-04-25T10:00:01Z',
          },
          error: null,
        }),
      )

    const result = await emailTemplateService.syncFileTemplate({ preview })

    expect(result.template.state).toBe('draft')
    expect(result.template.currentRevisionId).toBe('rev-1')
    expect(result.revision.revisionNumber).toBe(1)
    expect(mockBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'File Weekly',
        description: 'Filesystem template',
      }),
    )
    expect(mockBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: 'template-new',
        revision_number: 1,
        subject_template: preview.subjectTemplate,
        blocks: preview.blocks,
      }),
    )
  })

  describe('setActiveTemplate', () => {
    it('demotes the previous active template and promotes the chosen one', async () => {
      mockBuilder.then
        .mockImplementationOnce((resolve) =>
          resolve({
            data: {
              id: 'template-2',
              name: 'New look',
              description: null,
              state: 'draft',
              current_revision_id: 'rev-2',
              created_at: '2026-04-22T10:00:00Z',
              updated_at: '2026-04-22T10:00:00Z',
            },
            error: null,
          }),
        )
        .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
        .mockImplementationOnce((resolve) =>
          resolve({
            data: {
              id: 'template-2',
              name: 'New look',
              description: null,
              state: 'active',
              current_revision_id: 'rev-2',
              created_at: '2026-04-22T10:00:00Z',
              updated_at: '2026-04-22T11:00:00Z',
            },
            error: null,
          }),
        )

      const result = await emailTemplateService.setActiveTemplate('template-2')

      expect(result.state).toBe('active')
      expect(mockBuilder.update).toHaveBeenCalledWith({ state: 'inactive' })
      expect(mockBuilder.update).toHaveBeenCalledWith({ state: 'active' })
    })

    it('rejects activation when the template has no saved revision yet', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'template-3',
            name: 'Empty',
            description: null,
            state: 'draft',
            current_revision_id: null,
            created_at: '2026-04-22T10:00:00Z',
            updated_at: '2026-04-22T10:00:00Z',
          },
          error: null,
        }),
      )

      await expect(emailTemplateService.setActiveTemplate('template-3')).rejects.toMatchObject({
        code: 'EMAIL_TEMPLATE_NO_REVISION',
      })
      expect(mockBuilder.update).not.toHaveBeenCalled()
    })

    it('returns immediately when the template is already active', async () => {
      mockBuilder.then.mockImplementationOnce((resolve) =>
        resolve({
          data: {
            id: 'template-1',
            name: 'Welcome',
            description: null,
            state: 'active',
            current_revision_id: 'rev-1',
            created_at: '2026-03-20T10:00:00Z',
            updated_at: '2026-03-20T10:00:00Z',
          },
          error: null,
        }),
      )

      const result = await emailTemplateService.setActiveTemplate('template-1')

      expect(result.state).toBe('active')
      expect(mockBuilder.update).not.toHaveBeenCalled()
    })
  })
})

