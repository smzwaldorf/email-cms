import { useState } from 'react'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { EmailTemplateBlockConfigPanel } from '@/components/admin/EmailTemplateBlockConfigPanel'
import { getEmailBlockTypeDefinition, requiresRawHtmlEditing } from '@/services/emailTemplateBlocks'
import type { EmailTemplateBlock, EmailTemplateBlockConfig } from '@/types/emailTemplate'

interface EmailTemplateBlockEditorProps {
  block: EmailTemplateBlock
  blockKey: string
  onChange: (next: EmailTemplateBlock) => void
}

type BodyMode = 'tiptap' | 'html'

export function EmailTemplateBlockEditor({ block, blockKey, onChange }: EmailTemplateBlockEditorProps) {
  const definition = getEmailBlockTypeDefinition(block.type)
  // Table/inline-style layouts (every bundled block, synced file templates, Canva
  // imports) would be flattened by TipTap, so they open in raw HTML mode.
  const isLayoutHtml = requiresRawHtmlEditing(block.bodyHtml)
  const [mode, setMode] = useState<BodyMode>(() => (isLayoutHtml ? 'html' : 'tiptap'))
  const [confirmVisualSwitch, setConfirmVisualSwitch] = useState(false)

  const handleBodyChange = (nextHtml: string) => {
    onChange({ ...block, bodyHtml: nextHtml })
  }

  const handleConfigChange = (nextConfig: EmailTemplateBlockConfig) => {
    onChange({ ...block, config: nextConfig })
  }

  const requestVisualMode = () => {
    if (mode === 'tiptap') return
    if (isLayoutHtml) {
      setConfirmVisualSwitch(true)
      return
    }
    setMode('tiptap')
  }

  const allowedTokens = [...definition.innerScopeTokens]

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs text-waldorf-clay-500">{definition.description}</p>
        {allowedTokens.length > 0 && (
          <p className="text-xs text-waldorf-clay-500">
            Inner-scope tokens: {allowedTokens.map((token) => `{{${token}}}`).join(', ')}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs text-waldorf-clay-500">
          {mode === 'tiptap'
            ? 'In TipTap mode, use the toolbar image button to upload files or choose images from the media gallery. Images are saved as storage links in this block and swapped to signed URLs when the newsletter is prepared for delivery.'
            : 'HTML mode keeps the block markup exactly as written, including table layout, inline styles and {{tokens}}. Use the live preview on the right to check the result.'}
        </p>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-waldorf-clay-600">Body HTML</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-waldorf-cream-300 text-xs">
            <button
              type="button"
              onClick={requestVisualMode}
              title={
                isLayoutHtml
                  ? 'This block uses table layout / inline styles that the visual editor cannot keep.'
                  : undefined
              }
              className={`px-2 py-1 ${mode === 'tiptap' ? 'bg-waldorf-peach-100 text-waldorf-clay-700' : 'bg-white text-waldorf-clay-600'}`}
            >
              TipTap
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmVisualSwitch(false)
                setMode('html')
              }}
              className={`border-l border-waldorf-cream-300 px-2 py-1 ${mode === 'html' ? 'bg-waldorf-peach-100 text-waldorf-clay-700' : 'bg-white text-waldorf-clay-600'}`}
            >
              HTML
            </button>
          </div>
        </div>
        {confirmVisualSwitch && (
          <div
            role="alert"
            className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          >
            <p>
              This block is built with table layout and inline styles. The visual editor cannot represent them, so
              switching and editing here will flatten the block to plain paragraphs and drop its styling.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmVisualSwitch(false)}
                className="rounded border border-amber-300 bg-white px-2 py-1 font-medium text-amber-800"
              >
                Keep editing HTML
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmVisualSwitch(false)
                  setMode('tiptap')
                }}
                className="rounded border border-amber-300 px-2 py-1 text-amber-800 underline"
              >
                Switch to visual editor anyway
              </button>
            </div>
          </div>
        )}
        {mode === 'tiptap' && isLayoutHtml && (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Visual editing of a table-based block: the original layout and inline styles will be replaced by the
            editor output on your first change. Switch back to HTML before editing to keep them.
          </p>
        )}
        {mode === 'tiptap' ? (
          <div className="overflow-hidden rounded-lg border border-waldorf-cream-300">
            <SimpleEditor
              key={blockKey}
              content={block.bodyHtml}
              contentType="html"
              onChange={(html) => handleBodyChange(html)}
              placeholder="Block body HTML..."
            />
          </div>
        ) : (
          <textarea
            aria-label="Block body HTML"
            value={block.bodyHtml}
            onChange={(event) => handleBodyChange(event.target.value)}
            rows={14}
            spellCheck={false}
            className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2 font-mono text-xs text-waldorf-clay-700"
          />
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-waldorf-clay-600">Block configuration</p>
        <EmailTemplateBlockConfigPanel block={block} onChange={handleConfigChange} />
      </div>
    </div>
  )
}

export default EmailTemplateBlockEditor
