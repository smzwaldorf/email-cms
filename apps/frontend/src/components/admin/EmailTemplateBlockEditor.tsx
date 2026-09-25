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
            區塊內可用變數： {allowedTokens.map((token) => `{{${token}}}`).join(', ')}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs text-waldorf-clay-500">
          {mode === 'tiptap'
            ? '在 TipTap 模式下，可使用工具列的圖片按鈕上傳或從媒體庫選取圖片。圖片會以儲存連結保存在區塊中，準備寄送電子報時再換成已簽署的網址。'
            : 'HTML 模式會原樣保留區塊標記，包括表格版面、行內樣式與 {{tokens}}。請使用右側即時預覽檢查結果。'}
        </p>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-waldorf-clay-600">內文 HTML</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-waldorf-cream-300 text-xs">
            <button
              type="button"
              onClick={requestVisualMode}
              title={
                isLayoutHtml
                  ? '此區塊使用視覺化編輯器無法保留的表格版面或行內樣式。'
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
              此區塊使用表格版面與行內樣式。視覺化編輯器無法完整呈現；切換並編輯後會將內容攤平成段落並移除原有樣式。
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmVisualSwitch(false)}
                className="rounded border border-amber-300 bg-white px-2 py-1 font-medium text-amber-800"
              >
                繼續編輯 HTML
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmVisualSwitch(false)
                  setMode('tiptap')
                }}
                className="rounded border border-amber-300 px-2 py-1 text-amber-800 underline"
              >
                仍要切換至視覺化編輯器
              </button>
            </div>
          </div>
        )}
        {mode === 'tiptap' && isLayoutHtml && (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            視覺化編輯表格區塊時，第一次修改就會以編輯器輸出取代原有版面與行內樣式。若要保留，請先切回 HTML 模式。
          </p>
        )}
        {mode === 'tiptap' ? (
          <div className="overflow-hidden rounded-lg border border-waldorf-cream-300">
            <SimpleEditor
              key={blockKey}
              content={block.bodyHtml}
              contentType="html"
              onChange={(html) => handleBodyChange(html)}
              placeholder="區塊內文 HTML..."
            />
          </div>
        ) : (
          <textarea
            aria-label="區塊內文 HTML"
            value={block.bodyHtml}
            onChange={(event) => handleBodyChange(event.target.value)}
            rows={14}
            spellCheck={false}
            className="w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2 font-mono text-xs text-waldorf-clay-700"
          />
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-waldorf-clay-600">區塊設定</p>
        <EmailTemplateBlockConfigPanel block={block} onChange={handleConfigChange} />
      </div>
    </div>
  )
}

export default EmailTemplateBlockEditor
