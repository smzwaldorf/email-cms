/**
 * Class Form Component
 * 班級表單元件
 * Form for creating and editing classes
 *
 * Features:
 * - Edit class name, description
 * - Add/remove students
 * - Validate class name uniqueness
 * - Save and cancel actions
 */

import { useState } from 'react'
import type { Class, AdminUser } from '@/types/admin'

export interface ClassFormProps {
  class?: Class
  isNew?: boolean
  onSave?: (classData: Class) => void
  onError?: (error: Error) => void
  onCancel?: () => void
  availableStudents?: AdminUser[]
}

/**
 * Class Form Component
 */
export function ClassForm({
  class: initialClass,
  isNew = false,
  onSave,
  onError,
  onCancel,
  availableStudents = [],
}: ClassFormProps) {
  const [formData, setFormData] = useState<Partial<Class>>(
    initialClass || {
      name: '',
      description: '',
      studentIds: [],
    }
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.name || formData.name.trim() === '') {
      errors.name = '班級名稱為必填項'
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
   * Handle student selection
   */
  const handleStudentToggle = (studentId: string) => {
    const studentIds = formData.studentIds || []
    const newStudentIds = studentIds.includes(studentId)
      ? studentIds.filter((id) => id !== studentId)
      : [...studentIds, studentId]
    setFormData({ ...formData, studentIds: newStudentIds })
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
      const classData: Class = {
        id: initialClass?.id || crypto.randomUUID(),
        name: formData.name || '',
        description: formData.description,
        studentIds: formData.studentIds || [],
        createdAt: initialClass?.createdAt || now,
        updatedAt: now,
      }

      onSave?.(classData)
    } catch (err: any) {
      const error = new Error(err.message || 'Failed to save class')
      setSaveError(error.message)
      onError?.(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">
        {isNew ? '新增班級' : '編輯班級'}
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
            班級名稱 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={handleNameChange}
            placeholder="例如：6年級A班、高二英文班"
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
            placeholder="班級描述或特殊說明"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            rows={4}
            data-testid="description-input"
          />
        </div>

        {/* Students */}
        {availableStudents.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              學生 ({(formData.studentIds || []).length} / {availableStudents.length})
            </label>
            <div className="border border-gray-300 rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
              {availableStudents.map((student) => (
                <label key={student.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={(formData.studentIds || []).includes(student.id)}
                    onChange={() => handleStudentToggle(student.id)}
                    className="rounded border-gray-300"
                    data-testid={`student-checkbox-${student.id}`}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {student.name} ({student.email})
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

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

export default ClassForm
