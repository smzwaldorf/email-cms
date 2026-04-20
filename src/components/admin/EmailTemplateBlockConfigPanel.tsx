import { useMemo } from 'react'
import type { EmailTemplateBlock, EmailTemplateBlockConfig } from '@/types/emailTemplate'
import { getEmailBlockTypeDefinition } from '@/services/emailTemplateBlocks'

interface EmailTemplateBlockConfigPanelProps {
  block: EmailTemplateBlock
  onChange: (nextConfig: EmailTemplateBlockConfig) => void
}

interface ConfigFieldKind {
  key: string
  kind: 'string' | 'number' | 'boolean'
}

function inferFieldKinds(defaultConfig: EmailTemplateBlockConfig): ConfigFieldKind[] {
  const fields: ConfigFieldKind[] = []
  for (const [key, value] of Object.entries(defaultConfig)) {
    if (typeof value === 'number') {
      fields.push({ key, kind: 'number' })
    } else if (typeof value === 'boolean') {
      fields.push({ key, kind: 'boolean' })
    } else if (typeof value === 'string') {
      fields.push({ key, kind: 'string' })
    }
    // Arrays/objects are intentionally not rendered in v1; the JSON escape
    // hatch below covers admins who need them.
  }
  return fields
}

export function EmailTemplateBlockConfigPanel({ block, onChange }: EmailTemplateBlockConfigPanelProps) {
  const definition = getEmailBlockTypeDefinition(block.type)
  const fields = useMemo(() => inferFieldKinds(definition.defaultConfig), [definition])

  const updateField = (key: string, value: unknown) => {
    onChange({ ...block.config, [key]: value })
  }

  if (fields.length === 0) {
    return (
      <p className="text-xs text-waldorf-clay-500">
        This block has no configurable fields.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((field) => {
        const currentValue = block.config[field.key]
        const fallbackValue = definition.defaultConfig[field.key]
        if (field.kind === 'string') {
          const value = typeof currentValue === 'string' ? currentValue : String(fallbackValue ?? '')
          return (
            <label key={field.key} className="flex flex-col gap-1 text-xs text-waldorf-clay-600">
              <span className="font-medium">{field.key}</span>
              <input
                type="text"
                value={value}
                onChange={(event) => updateField(field.key, event.target.value)}
                className="rounded border border-waldorf-cream-300 px-2 py-1 text-sm text-waldorf-clay-700"
              />
            </label>
          )
        }
        if (field.kind === 'number') {
          const value = typeof currentValue === 'number' ? currentValue : Number(fallbackValue ?? 0)
          return (
            <label key={field.key} className="flex flex-col gap-1 text-xs text-waldorf-clay-600">
              <span className="font-medium">{field.key}</span>
              <input
                type="number"
                value={Number.isFinite(value) ? value : 0}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  updateField(field.key, Number.isFinite(next) ? next : 0)
                }}
                className="rounded border border-waldorf-cream-300 px-2 py-1 text-sm text-waldorf-clay-700"
              />
            </label>
          )
        }
        const checked = typeof currentValue === 'boolean' ? currentValue : Boolean(fallbackValue)
        return (
          <label key={field.key} className="flex items-center gap-2 text-xs text-waldorf-clay-600">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => updateField(field.key, event.target.checked)}
            />
            <span className="font-medium">{field.key}</span>
          </label>
        )
      })}
    </div>
  )
}

export default EmailTemplateBlockConfigPanel
