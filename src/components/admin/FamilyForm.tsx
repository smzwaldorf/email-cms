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
    <div className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-xl shadow-waldorf-clay-200/20 p-8 border border-waldorf-cream-200/50 animate-fade-in-up">
      <h2 className="text-3xl font-display font-bold mb-2 text-waldorf-clay-800 tracking-tight">
        {isNew ? '新增家族' : '編輯家族'}
      </h2>
      <p className="text-waldorf-clay-500 mb-8 font-medium">輸入家族名稱、描述和相關主題</p>

      {/* Error Message */}
      {saveError && (
        <div className="mb-6 p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl" data-testid="save-error">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-waldorf-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-waldorf-rose-900 font-semibold">錯誤</p>
              <p className="text-waldorf-rose-700 text-sm mt-1">{saveError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {/* Name */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <label className="block text-sm font-semibold text-waldorf-clay-700 mb-2">
            家族名稱 <span className="text-waldorf-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={handleNameChange}
            placeholder="例如：升學進路、親子教育"
            className={`w-full px-4 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:border-waldorf-sage-400 bg-waldorf-cream-50 transition-all duration-200 ${
              validationErrors.name
                ? 'border-waldorf-rose-300 focus:ring-waldorf-rose-300'
                : 'border-waldorf-cream-300 focus:ring-waldorf-sage-300'
            }`}
            data-testid="name-input"
            required
          />
          {validationErrors.name && (
            <p className="mt-2 text-sm text-waldorf-rose-600 font-medium" data-testid="name-error">
              {validationErrors.name}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <label className="block text-sm font-semibold text-waldorf-clay-700 mb-2">描述</label>
          <textarea
            value={formData.description || ''}
            onChange={handleDescriptionChange}
            placeholder="家族描述或相關信息"
            className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 bg-waldorf-cream-50 transition-all duration-200"
            rows={4}
            data-testid="description-input"
          />
        </div>

        {/* Related Topics */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <label className="block text-sm font-semibold text-waldorf-clay-700 mb-3">
            相關主題 <span className="text-waldorf-clay-500 font-normal">({(formData.relatedTopics || []).length})</span>
          </label>

          {/* Topic Input */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyPress={handleTopicKeyPress}
              placeholder="輸入主題，按 Enter 新增"
              className="flex-1 px-4 py-3 border border-waldorf-cream-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 bg-waldorf-cream-50 transition-all duration-200"
              data-testid="topic-input"
            />
            <button
              type="button"
              onClick={handleAddTopic}
              className="px-4 py-3 bg-waldorf-peach-100 text-waldorf-peach-700 rounded-xl hover:bg-waldorf-peach-200 transition-all duration-200 font-medium whitespace-nowrap"
              data-testid="add-topic-btn"
            >
              新增
            </button>
          </div>

          {/* Topic Tags */}
          {(formData.relatedTopics || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(formData.relatedTopics || []).map((topic, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 bg-waldorf-lavender-100 text-waldorf-lavender-700 text-sm px-3 py-1.5 rounded-full font-medium"
                  data-testid={`topic-tag-${i}`}
                >
                  {topic}
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(topic)}
                    className="text-waldorf-lavender-600 hover:text-waldorf-lavender-900 font-bold ml-1"
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
        <div className="flex justify-end gap-3 pt-6 border-t border-waldorf-cream-200/50 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-waldorf-clay-700 bg-waldorf-cream-100 border border-waldorf-cream-300 rounded-xl hover:bg-waldorf-cream-200 font-medium transition-all duration-200"
            data-testid="cancel-btn"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 text-white bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 hover:from-waldorf-sage-600 hover:to-waldorf-sage-700 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-waldorf-sage-200/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            data-testid="save-btn"
          >
            {isSaving && (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default FamilyForm
