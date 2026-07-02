import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { EmailTemplateBlockList } from '@/components/admin/EmailTemplateBlockList'
import type { EmailTemplateBlock } from '@/types/emailTemplate'

vi.mock('@/components/tiptap-templates/simple/simple-editor', () => ({
  SimpleEditor: ({
    content,
    onChange,
  }: {
    content: string
    onChange: (html: string) => void
  }) => (
    <textarea
      data-testid="mock-simple-editor"
      aria-label="Block body editor"
      value={content}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

function ControlledBlockList({ initial }: { initial: EmailTemplateBlock[] }) {
  const [blocks, setBlocks] = useState(initial)
  return (
    <>
      <EmailTemplateBlockList blocks={blocks} onChange={setBlocks} />
      <span data-testid="block-types">{blocks.map((b) => b.type).join(',')}</span>
      <span data-testid="block-visible">{String(blocks[0]?.visible ?? '')}</span>
      <span data-testid="block-body">{blocks[0]?.bodyHtml ?? ''}</span>
    </>
  )
}

describe('EmailTemplateBlockList', () => {
  it('reorders blocks when move down is used', async () => {
    const user = userEvent.setup()
    const initial: EmailTemplateBlock[] = [
      { type: 'custom-html', order: 0, visible: true, bodyHtml: '<p>first</p>', config: {} },
      { type: 'footer', order: 1, visible: true, bodyHtml: '<p>second</p>', config: {} },
    ]

    render(<ControlledBlockList initial={initial} />)

    const moveDown = screen.getAllByRole('button', { name: 'Move block down' })[0]
    await act(async () => {
      await user.click(moveDown)
    })

    await waitFor(() => {
      expect(screen.getByTestId('block-types').textContent).toBe('footer,custom-html')
    })
  })

  it('toggles visibility via Hide', async () => {
    const user = userEvent.setup()
    const initial: EmailTemplateBlock[] = [
      { type: 'custom-html', order: 0, visible: true, bodyHtml: '<p>x</p>', config: {} },
    ]

    render(<ControlledBlockList initial={initial} />)

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Hide block' }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('block-visible').textContent).toBe('false')
    })
  })

  it('persists body edits from the expanded block editor', async () => {
    const user = userEvent.setup()
    const initial: EmailTemplateBlock[] = [
      { type: 'custom-html', order: 0, visible: true, bodyHtml: '<p>before</p>', config: {} },
    ]

    render(<ControlledBlockList initial={initial} />)

    const editor = screen.getByRole('textbox', { name: 'Block body editor' })
    await act(async () => {
      await user.clear(editor)
      await user.type(editor, '<p>after</p>')
    })

    await waitFor(() => {
      expect(screen.getByTestId('block-body').textContent).toContain('after')
    })
  })
})
