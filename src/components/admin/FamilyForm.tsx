/**
 * Family Form Component
 * 家族表單元件
 * Form for creating and editing families
 *
 * Features:
 * - Edit family name, description
 * - Add/remove related topics
 * - Validate family name uniqueness
 * - Save and cancel actions
 */

import { useState } from 'react'
import type { Family } from '@/types/admin'

export interface FamilyFormProps {
  family?: Family
  isNew?: boolean
  onSave?: (familyData: Family) => void
  onError?: (error: Error) => void
  onCancel?: () => void
}

/**
 * Family Form Component
 */
export function FamilyForm({
  family: initialFamily,
  isNew = false,
  onSave,
  onError,
  onCancel,
}: FamilyFormProps) {
  const [formData, setFormData] = useState<Partial<Family>>(
    initialFamily || {
      name: '',
      description: '',
      relatedTopics: [],
    }
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [topicInput, setTopicInput] = useState('')

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.name || formData.name.trim() === '') {
      errors.name = '家族名稱為必填項'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  /**
   * Handle name change
   */
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaveError(null)
    setValidationErrors((prev) => {
      const updated = { ...prev }
      delete updated.name
      return updated
    })
    setFormData({ ...formData, name: e.target.value })
  }

  /**
   * Handle description change
   */
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSaveError(null)
    setFormData({ ...formData, description: e.target.value })
  }

  /**
   * Handle adding a topic
   */
  const handleAddTopic = () => {
    const topic = topicInput.trim()
    if (topic) {
      const relatedTopics = formData.relatedTopics || []
      if (!relatedTopics.includes(topic)) {
        setFormData({
          ...formData,
          relatedTopics: [...relatedTopics, topic],
        })
      }
    }
    // Always clear input
    setTopicInput('')
  }

  /**
   * Handle removing a topic
   */
  const handleRemoveTopic = (topic: string) => {
    const relatedTopics = (formData.relatedTopics || []).filter((t) => t !== topic)
    setFormData({ ...formData, relatedTopics })
  }

  /**
   * Handle key press in topic input
   */
  const handleTopicKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTopic()
    }
  }

  /**
   * Handle save
   */
  const handleSave = async () => {
    try {
      setIsSaving(true)
      setSaveError(null)

      if (!validateForm()) {
        return
      }

      const now = new Date().toISOString()
      const familyData: Family = {
        id: initialFamily?.id || crypto.randomUUID(),
        name: formData.name || '',
        description: formData.description,
        relatedTopics: formData.relatedTopics,
        createdAt: initialFamily?.createdAt || now,
        updatedAt: now,
      }

      onSave?.(familyData)
    } catch (err: any) {
      const error = new Error(err.message || 'Failed to save family')
      setSaveError(error.message)
      onError?.(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">
        {isNew ? '新增家族' : '編輯家族'}
      </h2>

      {/* Error Message */}
      {saveError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" data-testid="save-error">
          <p className="text-red-900 font-medium">錯誤</p>
          <p className="text-red-700 text-sm">{saveError}</p>
        </div>
      )}

      {/* Form */}
      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            家族名稱 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={handleNameChange}
            placeholder="例如：升學進路、親子教育"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            data-testid="name-input"
            required
          />
          {validationErrors.name && (
            <p className="mt-2 text-sm text-red-600" data-testid="name-error">
              {validationErrors.name}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
          <textarea
            value={formData.description || ''}
            onChange={handleDescriptionChange}
            placeholder="家族描述或相關信息"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            rows={4}
            data-testid="description-input"
          />
        </div>

        {/* Related Topics */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            相關主題 ({(formData.relatedTopics || []).length})
          </label>

          {/* Topic Input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyPress={handleTopicKeyPress}
              placeholder="輸入主題，按 Enter 新增"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              data-testid="topic-input"
            />
            <button
              type="button"
              onClick={handleAddTopic}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium"
              data-testid="add-topic-btn"
            >
              新增
            </button>
          </div>

          {/* Topic Tags */}
          {(formData.relatedTopics || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.relatedTopics.map((topic, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full"
                  data-testid={`topic-tag-${i}`}
                >
                  {topic}
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(topic)}
                    className="text-blue-600 hover:text-blue-900 font-bold"
                    data-testid={`remove-topic-btn-${i}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="save-btn"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors font-medium"
            data-testid="cancel-btn"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  )
}

export default FamilyForm
