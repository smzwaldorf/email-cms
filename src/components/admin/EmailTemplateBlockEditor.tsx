import { useState } from 'react'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { EmailTemplateBlockConfigPanel } from '@/components/admin/EmailTemplateBlockConfigPanel'
import { getEmailBlockTypeDefinition } from '@/services/emailTemplateBlocks'
import type { EmailTemplateBlock, EmailTemplateBlockConfig } from '@/types/emailTemplate'

interface EmailTemplateBlockEditorProps {
  block: EmailTemplateBlock
  blockKey: string
  onChange: (next: EmailTemplateBlock) => void
}

type BodyMode = 'tiptap' | 'html'

export function EmailTemplateBlockEditor({ block, blockKey, onChange }: EmailTemplateBlockEditorProps) {
  const definition = getEmailBlockTypeDefinition(block.type)
  const [mode, setMode] = useState<BodyMode>('tiptap')

  const handleBodyChange = (nextHtml: string) => {
    onChange({ ...block, bodyHtml: nextHtml })
  }

  const handleConfigChange = (nextConfig: EmailTemplateBlockConfig) => {
    onChange({ ...block, config: nextConfig })
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
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-waldorf-clay-600">Body HTML</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-waldorf-cream-300 text-xs">
            <button
              type="button"
              onClick={() => setMode('tiptap')}
              className={`px-2 py-1 ${mode === 'tiptap' ? 'bg-waldorf-peach-100 text-waldorf-clay-700' : 'bg-white text-waldorf-clay-600'}`}
            >
              TipTap
            </button>
            <button
              type="button"
              onClick={() => setMode('html')}
              className={`border-l border-waldorf-cream-300 px-2 py-1 ${mode === 'html' ? 'bg-waldorf-peach-100 text-waldorf-clay-700' : 'bg-white text-waldorf-clay-600'}`}
            >
              HTML
            </button>
          </div>
        </div>
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
            value={block.bodyHtml}
            onChange={(event) => handleBodyChange(event.target.value)}
            rows={10}
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
