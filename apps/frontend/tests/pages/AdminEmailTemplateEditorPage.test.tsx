import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AdminEmailTemplateEditorPage } from '@/pages/AdminEmailTemplateEditorPage'

const mockNavigate = vi.fn()
const { mockEmailTemplateService } = vi.hoisted(() => ({
  mockEmailTemplateService: {
    getCurrentRevision: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplateRevision: vi.fn(),
    duplicateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    previewRevision: vi.fn(),
    normalizeImportedBodyHtml: vi.fn(),
  },
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

vi.mock('@/components/tiptap-templates/simple/simple-editor', () => ({
  SimpleEditor: ({ onChange }: { onChange: (html: string) => void }) => (
    <textarea aria-label="Mock editor" onChange={(event) => onChange(event.target.value)} />
  ),
}))

vi.mock('@/services/emailTemplateService', () => ({
  emailTemplateService: mockEmailTemplateService,
}))

describe('AdminEmailTemplateEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmailTemplateService.normalizeImportedBodyHtml.mockImplementation((html: string) => {
      if (html.includes('<style>')) {
        return {
          normalizedHtml: '<table><tr><td>Imported</td></tr></table>',
          issues: [
            {
              code: 'unsupported_stylesheet',
              message: 'Embedded <style> blocks are not supported for imported email templates. Use inline styles only.',
            },
          ],
          hasBlockingIssues: true,
        }
      }

      return {
        normalizedHtml: '<table><tr><td>Imported</td></tr></table>',
        issues: [],
        hasBlockingIssues: false,
      }
    })
    mockEmailTemplateService.previewRevision.mockReturnValue({
      subject: 'Preview',
      body: '<p>Preview</p>',
      warnings: [],
    })
    mockEmailTemplateService.createTemplate.mockResolvedValue({
      template: { id: 'template-1' },
      revision: { id: 'rev-1', revisionNumber: 1 },
      validation: { valid: true, issues: [] },
    })
  })

  it('blocks save after importing incompatible html from the paste flow', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/email-templates/new']}>
        <Routes>
          <Route path="/admin/email-templates/new" element={<AdminEmailTemplateEditorPage />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Template name'), { target: { value: 'Imported template' } })
    fireEvent.change(screen.getByPlaceholderText('Subject template'), { target: { value: 'Hello {{guardian.email}}' } })

    fireEvent.click(screen.getByRole('button', { name: 'Import HTML' }))
    const importTextarea = screen.getAllByRole('textbox').at(-1) as HTMLTextAreaElement
    fireEvent.change(importTextarea, {
      target: {
        value: '<html><head><style>.hero{color:red;}</style></head><body><table><tr><td>Imported</td></tr></table></body></html>',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply Imported HTML' }))

    expect(await screen.findByText('Imported HTML compatibility issues')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
  })

  it('loads uploaded html files into the import panel', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/admin/email-templates/new']}>
        <Routes>
          <Route path="/admin/email-templates/new" element={<AdminEmailTemplateEditorPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).not.toBeNull()

    const file = new File(['ignored'], 'import.html', {
      type: 'text/html',
    })
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve('<html><body><table><tr><td>Imported</td></tr></table></body></html>'),
    })
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } })

    expect(
      await screen.findByDisplayValue('<html><body><table><tr><td>Imported</td></tr></table></body></html>'),
    ).toBeInTheDocument()
  })
})
