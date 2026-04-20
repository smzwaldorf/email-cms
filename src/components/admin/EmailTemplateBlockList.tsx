import { useMemo, useState } from 'react'
import {
  EMAIL_BLOCK_TYPES,
  createDefaultBlock,
  getEmailBlockTypeDefinition,
} from '@/services/emailTemplateBlocks'
import { EmailTemplateBlockEditor } from '@/components/admin/EmailTemplateBlockEditor'
import type { EmailBlockType, EmailTemplateBlock } from '@/types/emailTemplate'

interface EmailTemplateBlockListProps {
  blocks: EmailTemplateBlock[]
  onChange: (next: EmailTemplateBlock[]) => void
  /** Stable identifier used to scope block keys (template id, revision id, etc.). */
  scopeKey?: string
}

function reindex(blocks: EmailTemplateBlock[]): EmailTemplateBlock[] {
  return blocks.map((block, index) => ({ ...block, order: index }))
}

export function EmailTemplateBlockList({ blocks, onChange, scopeKey = 'template' }: EmailTemplateBlockListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(blocks.length > 0 ? 0 : null)
  const [appendType, setAppendType] = useState<EmailBlockType>('section-divider')

  const orderedBlocks = useMemo(
    () => [...blocks].sort((left, right) => left.order - right.order),
    [blocks],
  )

  const updateBlockAt = (index: number, next: EmailTemplateBlock) => {
    const draft = [...orderedBlocks]
    draft[index] = next
    onChange(reindex(draft))
  }

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= orderedBlocks.length) return
    const draft = [...orderedBlocks]
    const [removed] = draft.splice(index, 1)
    draft.splice(target, 0, removed)
    onChange(reindex(draft))
    setExpandedIndex(target)
  }

  const removeBlock = (index: number) => {
    const draft = orderedBlocks.filter((_, i) => i !== index)
    onChange(reindex(draft))
    setExpandedIndex(null)
  }

  const toggleVisibility = (index: number) => {
    const block = orderedBlocks[index]
    updateBlockAt(index, { ...block, visible: !block.visible })
  }

  const appendBlock = () => {
    const next = [...orderedBlocks, createDefaultBlock(appendType, orderedBlocks.length)]
    onChange(reindex(next))
    setExpandedIndex(next.length - 1)
  }

  return (
    <div className="space-y-3">
      {orderedBlocks.map((block, index) => {
        const definition = getEmailBlockTypeDefinition(block.type)
        const isExpanded = expandedIndex === index
        const blockKey = `${scopeKey}:${index}:${block.type}`
        return (
          <div
            key={blockKey}
            className={`rounded-lg border ${block.visible ? 'border-waldorf-cream-300 bg-white' : 'border-waldorf-cream-200 bg-waldorf-cream-50/60'}`}
            data-testid="email-template-block-card"
          >
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="text-xs font-semibold text-waldorf-clay-700">
                {index + 1}. {definition.label}
              </span>
              {!block.visible && (
                <span className="rounded-full bg-waldorf-cream-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-waldorf-clay-600">
                  Hidden
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveBlock(index, -1)}
                  disabled={index === 0}
                  aria-label="Move block up"
                  className="rounded border border-waldorf-cream-300 px-2 py-1 text-xs text-waldorf-clay-700 disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(index, 1)}
                  disabled={index === orderedBlocks.length - 1}
                  aria-label="Move block down"
                  className="rounded border border-waldorf-cream-300 px-2 py-1 text-xs text-waldorf-clay-700 disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => toggleVisibility(index)}
                  aria-label={block.visible ? 'Hide block' : 'Show block'}
                  className="rounded border border-waldorf-cream-300 px-2 py-1 text-xs text-waldorf-clay-700"
                >
                  {block.visible ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="rounded border border-waldorf-cream-300 px-2 py-1 text-xs text-waldorf-clay-700"
                >
                  {isExpanded ? 'Collapse' : 'Edit'}
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(index)}
                  aria-label="Remove block"
                  className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                >
                  Remove
                </button>
              </span>
            </div>
            {isExpanded && (
              <div className="border-t border-waldorf-cream-200 bg-waldorf-cream-50/40 px-3 py-3">
                <EmailTemplateBlockEditor
                  block={block}
                  blockKey={blockKey}
                  onChange={(next) => updateBlockAt(index, next)}
                />
              </div>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-waldorf-cream-300 bg-white px-3 py-2">
        <span className="text-xs text-waldorf-clay-500">Add block:</span>
        <select
          value={appendType}
          onChange={(event) => setAppendType(event.target.value as EmailBlockType)}
          className="rounded border border-waldorf-cream-300 px-2 py-1 text-xs text-waldorf-clay-700"
        >
          {EMAIL_BLOCK_TYPES.map((type) => (
            <option key={type} value={type}>
              {getEmailBlockTypeDefinition(type).label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={appendBlock}
          className="rounded-lg bg-waldorf-sage-600 px-3 py-1 text-xs text-white"
        >
          Append
        </button>
      </div>
    </div>
  )
}

export default EmailTemplateBlockList
