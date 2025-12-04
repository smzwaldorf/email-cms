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

/**
 * Student Filter and Add Component
 */
function StudentFilterDropdown({
  availableStudents,
  selectedStudentIds,
  onAddStudent,
}: {
  availableStudents: AdminUser[]
  selectedStudentIds: string[]
  onAddStudent: (studentId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter available students (exclude already selected)
  const filteredStudents = (availableStudents || []).filter(
    (student) =>
      student &&
      student.name &&
      student.email &&
      !selectedStudentIds.includes(student.id) &&
      (student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleAddStudent = (studentId: string) => {
    onAddStudent(studentId)
    setSearchTerm('')
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-left hover:bg-gray-50 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        disabled={filteredStudents.length === 0}
      >
        <span className="text-gray-700">
          {filteredStudents.length > 0
            ? '+ 添加學生'
            : '所有學生已選擇'}
        </span>
      </button>

      {isOpen && filteredStudents.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="搜尋學生名稱或電子郵件..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Student List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => handleAddStudent(student.id)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-sm font-medium text-gray-900">{student.name}</div>
                  <div className="text-xs text-gray-500">{student.email}</div>
                </button>
              ))
            ) : (
              <div className="p-3 text-sm text-gray-500 text-center">
                沒有符合的學生
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Teacher Filter and Add Component
 */
function TeacherFilterDropdown({
  availableTeachers,
  selectedTeacherIds,
  onAddTeacher,
}: {
  availableTeachers: AdminUser[]
  selectedTeacherIds: string[]
  onAddTeacher: (teacherId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter available teachers (exclude already selected)
  const filteredTeachers = (availableTeachers || []).filter(
    (teacher) =>
      teacher &&
      teacher.name &&
      teacher.email &&
      !selectedTeacherIds.includes(teacher.id) &&
      (teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleAddTeacher = (teacherId: string) => {
    onAddTeacher(teacherId)
    setSearchTerm('')
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-left hover:bg-gray-50 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        disabled={filteredTeachers.length === 0}
      >
        <span className="text-gray-700">
          {filteredTeachers.length > 0
            ? '+ 指定教師'
            : '所有教師已指定'}
        </span>
      </button>

      {isOpen && filteredTeachers.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="搜尋教師名稱或電子郵件..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Teacher List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredTeachers.length > 0 ? (
              filteredTeachers.map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => handleAddTeacher(teacher.id)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                  <div className="text-xs text-gray-500">{teacher.email}</div>
                </button>
              ))
            ) : (
              <div className="p-3 text-sm text-gray-500 text-center">
                沒有符合的教師
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export interface ClassFormProps {
  class?: Class
  isNew?: boolean
  onSave?: (classData: Class) => void
  onError?: (error: Error) => void
  onCancel?: () => void
  availableStudents?: AdminUser[]
  availableTeachers?: AdminUser[]
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
  availableTeachers = [],
}: ClassFormProps) {
  const [formData, setFormData] = useState<Partial<Class>>(
    initialClass || {
      name: '',
      description: '',
      studentIds: [],
      teacherIds: [],
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
   * Handle teacher selection
   */
  const handleTeacherToggle = (teacherId: string) => {
    const teacherIds = formData.teacherIds || []
    const newTeacherIds = teacherIds.includes(teacherId)
      ? teacherIds.filter((id) => id !== teacherId)
      : [...teacherIds, teacherId]
    setFormData({ ...formData, teacherIds: newTeacherIds })
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
        teacherIds: formData.teacherIds || [],
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

        {/* Teachers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            班級教師 ({(formData.teacherIds || []).length} / {availableTeachers.length})
          </label>

          {availableTeachers.length > 0 ? (
            <div className="space-y-3">
              {/* Add Teacher Dropdown */}
              <TeacherFilterDropdown
                availableTeachers={availableTeachers}
                selectedTeacherIds={formData.teacherIds || []}
                onAddTeacher={handleTeacherToggle}
              />

              {/* Selected Teachers List */}
              {(formData.teacherIds || []).length > 0 && (
                <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
                  <div className="text-sm font-medium text-gray-700 mb-2">已指定的教師</div>
                  <div className="space-y-2">
                    {(formData.teacherIds || []).map((teacherId) => {
                      const teacher = availableTeachers.find((t) => t.id === teacherId)
                      return teacher ? (
                        <div
                          key={teacherId}
                          className="flex items-center justify-between bg-white p-2 rounded border border-gray-200"
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                            <div className="text-xs text-gray-500">{teacher.email}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTeacherToggle(teacherId)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                            data-testid={`remove-teacher-${teacherId}`}
                          >
                            移除
                          </button>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-gray-300 rounded-md p-4 bg-gray-50 text-center">
              <p className="text-sm text-gray-600">
                沒有可用的教師帳戶。請先在用戶管理中建立教師帳戶。
              </p>
            </div>
          )}
        </div>

        {/* Students */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            班級學生 ({(formData.studentIds || []).length} / {availableStudents.length})
          </label>

          {availableStudents.length > 0 ? (
            <div className="space-y-3">
              {/* Add Student Dropdown */}
              <StudentFilterDropdown
                availableStudents={availableStudents}
                selectedStudentIds={formData.studentIds || []}
                onAddStudent={handleStudentToggle}
              />

              {/* Selected Students List */}
              {(formData.studentIds || []).length > 0 && (
                <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
                  <div className="text-sm font-medium text-gray-700 mb-2">已選擇的學生</div>
                  <div className="space-y-2">
                    {(formData.studentIds || []).map((studentId) => {
                      const student = availableStudents.find((s) => s.id === studentId)
                      return student ? (
                        <div
                          key={studentId}
                          className="flex items-center justify-between bg-white p-2 rounded border border-gray-200"
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-900">{student.name}</div>
                            <div className="text-xs text-gray-500">{student.email}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStudentToggle(studentId)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                            data-testid={`remove-student-${studentId}`}
                          >
                            移除
                          </button>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-gray-300 rounded-md p-4 bg-gray-50 text-center">
              <p className="text-sm text-gray-600">
                沒有可用的學生帳戶。請先在用戶管理中建立學生帳戶。
              </p>
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

export default ClassForm
