import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderTemplateForRecipient } from '@/services/emailTemplateRenderer'
import { AdminFileEmailTemplatePreviewPage } from '@/pages/AdminFileEmailTemplatePreviewPage'
import type { FileEmailTemplatePreviewResult } from '@/types/fileEmailTemplate'

const mockNavigate = vi.fn()
const { mockEmailTemplateService, mockPreviewFileEmailTemplateSource } = vi.hoisted(() => ({
  mockEmailTemplateService: {
    syncFileTemplate: vi.fn(),
  },
  mockPreviewFileEmailTemplateSource: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/services/emailTemplateService', () => ({
  DEFAULT_EMAIL_TEMPLATE_PREVIEW_SAMPLES: {
    sharedArticles: [{ id: 'a', title: 'A', excerpt: 'A excerpt', url: 'https://example.com/a' }],
    classes: [],
    weeklyItems: [],
  },
  emailTemplateService: mockEmailTemplateService,
}))

vi.mock('@/services/fileEmailTemplateLoader', () => ({
  previewFileEmailTemplateSource: mockPreviewFileEmailTemplateSource,
}))

function validPreview(
  overrides: Partial<FileEmailTemplatePreviewResult> = {},
): FileEmailTemplatePreviewResult {
  const preview: FileEmailTemplatePreviewResult = {
    valid: true,
    issues: [],
    source: {
      sourceId: 'file-weekly',
      displayName: 'File Weekly',
      description: 'Source controlled template',
      linkedTemplateId: 'template-existing',
      folderPath: 'templates/email/file-weekly',
      metadataPath: 'templates/email/file-weekly/metadata.json',
      subjectPath: 'templates/email/file-weekly/subject.hbs',
      blockPaths: ['templates/email/file-weekly/blocks/body.hbs'],
      partialPaths: [],
    },
    manifest: {
      sourceId: 'file-weekly',
      name: 'File Weekly',
      subject: 'subject.hbs',
      blocks: [
        {
          id: 'body',
          mode: 'article-repeat',
          type: 'shared-article-feature',
          file: 'blocks/body.hbs',
          order: 0,
        },
      ],
    },
    subjectTemplate: 'Hello {{guardian.email}}',
    renderedSubject: 'Hello guardian@example.com',
    bodyHtml: '<article>A</article>',
    blocks: [
      {
        type: 'shared-article-feature',
        order: 0,
        visible: true,
        bodyHtml: '<article>Synced {{article.title}}</article>',
        config: { maxItems: 3 },
      },
    ],
    blockPreviews: [
      {
        manifestBlock: {
          id: 'body',
          mode: 'article-repeat',
          type: 'shared-article-feature',
          file: 'blocks/body.hbs',
          order: 0,
          label: 'Body',
        },
        block: {
          type: 'shared-article-feature',
          order: 0,
          visible: true,
          bodyHtml: '<article>Synced {{article.title}}</article>',
          config: { maxItems: 3 },
        },
        renderedFragments: ['<article>A</article>'],
      },
    ],
    context: {
      sharedArticles: [],
      classes: [],
      weeklyItems: [],
    },
  }
  return { ...preview, ...overrides }
}

function renderPreviewRoute(sourceId = 'file-weekly') {
  return render(
    <MemoryRouter initialEntries={[`/admin/email-templates/file/${sourceId}`]}>
      <Routes>
        <Route
          path="/admin/email-templates/file/:sourceId"
          element={<AdminFileEmailTemplatePreviewPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('admin file email template preview and sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmailTemplateService.syncFileTemplate.mockResolvedValue({
      template: { id: 'template-existing' },
      revision: { id: 'rev-4', revisionNumber: 4 },
      validation: { valid: true, issues: [] },
    })
  })

  it('previews a valid file source with rendered subject and block summary', () => {
    mockPreviewFileEmailTemplateSource.mockReturnValue(validPreview())

    renderPreviewRoute()

    expect(screen.getByText('File Weekly')).toBeInTheDocument()
    expect(screen.getByText('Hello guardian@example.com')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync to database revision' })).toBeEnabled()
  })

  it('blocks sync when a file source references a missing block file', () => {
    mockPreviewFileEmailTemplateSource.mockReturnValue(
      validPreview({
        valid: false,
        issues: [
          {
            code: 'missing_block_file',
            severity: 'error',
            path: 'blocks/missing-footer.hbs',
            message: 'Missing block template file: blocks/missing-footer.hbs',
          },
        ],
      }),
    )

    renderPreviewRoute()

    expect(screen.getByText('Missing block template file: blocks/missing-footer.hbs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync to database revision' })).toBeDisabled()
    expect(mockEmailTemplateService.syncFileTemplate).not.toHaveBeenCalled()
  })

  it('syncs a linked file source through the existing template path', async () => {
    const preview = validPreview()
    mockPreviewFileEmailTemplateSource.mockReturnValue(preview)

    renderPreviewRoute()
    fireEvent.click(screen.getByRole('button', { name: 'Sync to database revision' }))

    await waitFor(() => {
      expect(mockEmailTemplateService.syncFileTemplate).toHaveBeenCalledWith({ preview })
    })
    expect(mockNavigate).toHaveBeenCalledWith('/admin/email-templates/template-existing')
  })

  it('keeps delivery rendering tied to the synced revision snapshot', () => {
    const syncedPreview = validPreview()
    const changedFilePreview = validPreview({
      blocks: [
        {
          type: 'shared-article-feature',
          order: 0,
          visible: true,
          bodyHtml: '<article>Changed {{article.title}}</article>',
          config: { maxItems: 3 },
        },
      ],
    })

    const rendered = renderTemplateForRecipient(
      syncedPreview.blocks,
      {
        templateContext: {
          guardian: { id: 'guardian-1', email: 'guardian@example.com' },
          family: { id: 'family-1' },
          newsletter: { id: 'newsletter-1', revisionId: 'rev-4' },
          classes: { ids: [] },
        },
        sharedArticles: [{ id: 'a', title: 'A', excerpt: 'A excerpt', url: 'https://example.com/a' }],
        classes: [],
        weeklyItems: [],
      },
      { wrapInDocumentShell: false },
    )

    expect(changedFilePreview.blocks[0].bodyHtml).toContain('Changed')
    expect(rendered.html).toContain('Synced A')
    expect(rendered.html).not.toContain('Changed A')
  })
})
