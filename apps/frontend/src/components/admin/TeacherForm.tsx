import { useState } from 'react'
import type { AdminUser } from '@/types/admin'
import type { TeacherAssignedClass } from '@/services/adminService'

interface TeacherFormData {
  name: string
  email: string
}

export interface TeacherFormProps {
  teacher?: AdminUser
  isNew?: boolean
  assignedClasses?: TeacherAssignedClass[]
  isLoadingAssignedClasses?: boolean
  onSave?: (teacher: TeacherFormData) => Promise<void> | void
  onCancel?: () => void
}

export function TeacherForm({
  teacher,
  isNew = false,
  assignedClasses = [],
  isLoadingAssignedClasses = false,
  onSave,
  onCancel,
}: TeacherFormProps) {
  const [formData, setFormData] = useState<TeacherFormData>({
    name: teacher?.name || '',
    email: teacher?.email || '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!formData.name.trim()) next.name = '教師姓名為必填項'
    if (!formData.email.trim()) next.email = '教師電子郵件為必填項'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    setSaveError(null)
    if (!validate()) return
    try {
      setIsSaving(true)
      await onSave?.({ name: formData.name.trim(), email: formData.email.trim().toLowerCase() })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '儲存教師資料失敗')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-waldorf-clay-100/50 p-8 border border-waldorf-cream-200 animate-fade-in-up">
      <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800 mb-6">
        {isNew ? '新增教師' : '編輯教師'}
      </h2>

      {saveError && (
        <div className="mb-6 p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl">
          <p className="text-waldorf-rose-800 font-semibold">錯誤</p>
          <p className="text-waldorf-rose-600 text-sm mt-1">{saveError}</p>
        </div>
      )}

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">
            教師姓名 <span className="text-waldorf-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => {
              setErrors((prev) => ({ ...prev, name: '' }))
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }}
            data-testid="teacher-name-input"
            className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 bg-waldorf-cream-50/50 ${
              errors.name
                ? 'border-waldorf-rose-400 focus:ring-waldorf-rose-300'
                : 'border-waldorf-cream-300 focus:ring-waldorf-sage-300'
            }`}
            placeholder="例如：王老師"
          />
          {errors.name && <p className="mt-2 text-sm text-waldorf-rose-600">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">
            教師電子郵件 <span className="text-waldorf-rose-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            disabled={!isNew}
            onChange={(e) => {
              setErrors((prev) => ({ ...prev, email: '' }))
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }}
            data-testid="teacher-email-input"
            className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 bg-waldorf-cream-50/50 disabled:opacity-70 ${
              errors.email
                ? 'border-waldorf-rose-400 focus:ring-waldorf-rose-300'
                : 'border-waldorf-cream-300 focus:ring-waldorf-sage-300'
            }`}
            placeholder="teacher@example.com"
          />
          {!isNew && (
            <p className="mt-2 text-xs text-waldorf-clay-500">教師電子郵件建立後不可修改。</p>
          )}
          {errors.email && <p className="mt-2 text-sm text-waldorf-rose-600">{errors.email}</p>}
        </div>

        {!isNew && (
          <div>
            <label className="block text-sm font-medium text-waldorf-clay-600 mb-2">
              已分派班級
            </label>
            {isLoadingAssignedClasses ? (
              <p className="text-sm text-waldorf-clay-500">載入班級中...</p>
            ) : assignedClasses.length === 0 ? (
              <p className="text-sm text-waldorf-clay-500">目前沒有分派班級。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignedClasses.map((cls) => (
                  <span
                    key={cls.id}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      cls.isActive
                        ? 'bg-waldorf-sage-100 text-waldorf-sage-700'
                        : 'bg-waldorf-clay-100 text-waldorf-clay-700'
                    }`}
                  >
                    {cls.name}
                    {!cls.isActive ? ' (停用)' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-6 border-t border-waldorf-cream-200">
          <button
            onClick={handleSave}
            disabled={isSaving}
            data-testid="teacher-save-btn"
            className="px-5 py-2.5 text-white bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 rounded-xl hover:from-waldorf-sage-600 hover:to-waldorf-sage-700 transition-all duration-200 font-medium shadow-lg shadow-waldorf-sage-200/50 disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={onCancel}
            type="button"
            data-testid="teacher-cancel-btn"
            className="px-5 py-2.5 text-waldorf-clay-600 bg-waldorf-cream-100 rounded-xl hover:bg-waldorf-cream-200 transition-all duration-200 font-medium"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  )
}

export default TeacherForm
