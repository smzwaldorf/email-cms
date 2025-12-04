/**
 * Family Relationship Editor Component
 * 家族關係編輯器
 * Manages parent-student family relationships with relationship types (father, mother, guardian)
 *
 * Features:
 * - Display family members (parents and students)
 * - Add/remove parents from family
 * - Edit parent relationship (father, mother, guardian)
 * - Show enrolled students
 * - Merge families capability
 */

import { useState } from 'react'
import type { AdminUser } from '@/types/admin'

export interface FamilyMember {
  id: string
  name: string
  email: string
  type: 'parent' | 'student' // Type of family member
  relationship?: 'father' | 'mother' | 'guardian' // Only for parents
}

export interface FamilyRelationshipEditorProps {
  familyCode: string
  familyMembers: FamilyMember[] // All family members
  availableParents: AdminUser[] // Parents that can be added
  availableStudents: AdminUser[] // Students enrolled in classes
  onAddParent?: (parentId: string, relationship: 'father' | 'mother' | 'guardian') => Promise<void>
  onRemoveParent?: (parentId: string) => Promise<void>
  onUpdateParentRelationship?: (parentId: string, relationship: 'father' | 'mother' | 'guardian') => Promise<void>
  onAddStudent?: (studentId: string) => Promise<void>
  onRemoveStudent?: (studentId: string) => Promise<void>
}

const RELATIONSHIP_OPTIONS = [
  { value: 'father', label: '父親' },
  { value: 'mother', label: '母親' },
  { value: 'guardian', label: '監護人' },
] as const

/**
 * Family Relationship Editor Component
 */
export function FamilyRelationshipEditor({
  familyCode,
  familyMembers,
  availableParents,
  availableStudents,
  onAddParent,
  onRemoveParent,
  onUpdateParentRelationship,
  onAddStudent,
  onRemoveStudent,
}: FamilyRelationshipEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parentSearchTerm, setParentSearchTerm] = useState('')
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false)
  const [studentSearchTerm, setStudentSearchTerm] = useState('')
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false)
  const [editingParentId, setEditingParentId] = useState<string | null>(null)
  const [editingRelationship, setEditingRelationship] = useState<'father' | 'mother' | 'guardian' | null>(null)

  // Separate parents and students
  const parents = familyMembers.filter((m) => m.type === 'parent')
  const students = familyMembers.filter((m) => m.type === 'student')

  // Filter available parents (exclude already added)
  const filteredAvailableParents = availableParents.filter(
    (p) =>
      !parents.some((existing) => existing.id === p.id) &&
      (p.name?.toLowerCase().includes(parentSearchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(parentSearchTerm.toLowerCase()))
  )

  // Filter available students (exclude already added)
  const filteredAvailableStudents = availableStudents.filter(
    (s) =>
      !students.some((existing) => existing.id === s.id) &&
      (s.name?.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(studentSearchTerm.toLowerCase()))
  )

  /**
   * Handle adding a parent
   */
  const handleAddParent = async (parentId: string, relationship: 'father' | 'mother' | 'guardian') => {
    try {
      setIsLoading(true)
      setError(null)
      await onAddParent?.(parentId, relationship)
      setParentSearchTerm('')
      setParentDropdownOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add parent')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle removing a parent
   */
  const handleRemoveParent = async (parentId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      await onRemoveParent?.(parentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove parent')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle updating parent relationship
   */
  const handleUpdateRelationship = async (parentId: string, newRelationship: 'father' | 'mother' | 'guardian') => {
    try {
      setIsLoading(true)
      setError(null)
      await onUpdateParentRelationship?.(parentId, newRelationship)
      setEditingParentId(null)
      setEditingRelationship(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update relationship')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle adding a student
   */
  const handleAddStudent = async (studentId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      await onAddStudent?.(studentId)
      setStudentSearchTerm('')
      setStudentDropdownOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add student')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle removing a student
   */
  const handleRemoveStudent = async (studentId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      await onRemoveStudent?.(studentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove student')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-900 font-medium">錯誤</p>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Family Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-900">
          <strong>家族代碼：</strong> {familyCode}
        </p>
      </div>

      {/* Parents Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">家族成員 ({parents.length})</h3>

        {/* Add Parent Button */}
        <div className="mb-6">
          <div className="relative">
            <button
              type="button"
              onClick={() => setParentDropdownOpen(!parentDropdownOpen)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-left hover:bg-gray-50 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={filteredAvailableParents.length === 0 || isLoading}
            >
              <span className="text-gray-700">
                {filteredAvailableParents.length > 0 ? '+ 新增家族成員' : '所有成員已新增'}
              </span>
            </button>

            {parentDropdownOpen && filteredAvailableParents.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    placeholder="搜尋家族成員..."
                    value={parentSearchTerm}
                    onChange={(e) => setParentSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {filteredAvailableParents.map((parent) => (
                    <div key={parent.id} className="border-b border-gray-100 last:border-b-0">
                      <div className="px-3 py-2 hover:bg-gray-50">
                        <div className="text-sm font-medium text-gray-900">{parent.name}</div>
                        <div className="text-xs text-gray-500 mb-2">{parent.email}</div>
                        <div className="flex gap-2">
                          {RELATIONSHIP_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleAddParent(parent.id, opt.value)}
                              disabled={isLoading}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Parents List - Organized by Relationship */}
        {parents.length > 0 ? (
          <div className="space-y-6">
            {/* Father Section */}
            {parents.some((p) => p.relationship === 'father') && (
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-blue-600 rounded-full"></span>
                  父親
                </h4>
                <div className="space-y-2 ml-5">
                  {parents
                    .filter((p) => p.relationship === 'father')
                    .map((parent) => (
                      <div
                        key={parent.id}
                        className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{parent.name}</div>
                          <div className="text-xs text-gray-500">{parent.email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveParent(parent.id)}
                          className="px-2 py-1 text-xs text-red-600 hover:text-red-800 border border-red-300 rounded"
                          disabled={isLoading}
                        >
                          移除
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Mother Section */}
            {parents.some((p) => p.relationship === 'mother') && (
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-pink-600 rounded-full"></span>
                  母親
                </h4>
                <div className="space-y-2 ml-5">
                  {parents
                    .filter((p) => p.relationship === 'mother')
                    .map((parent) => (
                      <div
                        key={parent.id}
                        className="flex items-center justify-between p-3 bg-pink-50 border border-pink-200 rounded-md"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{parent.name}</div>
                          <div className="text-xs text-gray-500">{parent.email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveParent(parent.id)}
                          className="px-2 py-1 text-xs text-red-600 hover:text-red-800 border border-red-300 rounded"
                          disabled={isLoading}
                        >
                          移除
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Guardians Section */}
            {parents.some((p) => p.relationship === 'guardian') && (
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-purple-600 rounded-full"></span>
                  監護人
                </h4>
                <div className="space-y-2 ml-5">
                  {parents
                    .filter((p) => p.relationship === 'guardian')
                    .map((parent) => (
                      <div
                        key={parent.id}
                        className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-md"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{parent.name}</div>
                          <div className="text-xs text-gray-500">{parent.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingParentId === parent.id ? (
                            <select
                              value={editingRelationship || parent.relationship || ''}
                              onChange={(e) => {
                                const newRelationship = e.target.value as 'father' | 'mother' | 'guardian'
                                setEditingRelationship(newRelationship)
                                handleUpdateRelationship(parent.id, newRelationship)
                              }}
                              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-purple-500"
                              disabled={isLoading}
                            >
                              {RELATIONSHIP_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingParentId(parent.id)
                                setEditingRelationship(parent.relationship)
                              }}
                              className="px-2 py-1 text-xs text-purple-600 hover:text-purple-800 border border-purple-300 rounded"
                              disabled={isLoading}
                            >
                              編輯
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveParent(parent.id)}
                            className="px-2 py-1 text-xs text-red-600 hover:text-red-800 border border-red-300 rounded"
                            disabled={isLoading}
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-center">
            <p className="text-sm text-gray-600">沒有家族成員</p>
          </div>
        )}
      </div>

      {/* Students Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">學生成員 ({students.length})</h3>

        {/* Add Student */}
        <div className="mb-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setStudentDropdownOpen(!studentDropdownOpen)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-left hover:bg-gray-50 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={filteredAvailableStudents.length === 0 || isLoading}
            >
              <span className="text-gray-700">
                {filteredAvailableStudents.length > 0 ? '+ 新增學生' : '所有學生已新增'}
              </span>
            </button>

            {studentDropdownOpen && filteredAvailableStudents.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    placeholder="搜尋學生..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {filteredAvailableStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleAddStudent(student.id)}
                      disabled={isLoading}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 disabled:opacity-50"
                    >
                      <div className="text-sm font-medium text-gray-900">{student.name}</div>
                      <div className="text-xs text-gray-500">{student.email}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Students List */}
        {students.length > 0 ? (
          <div className="space-y-2">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{student.name}</div>
                  <div className="text-xs text-gray-500">{student.email}</div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveStudent(student.id)}
                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800 border border-red-300 rounded"
                  disabled={isLoading}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-center">
            <p className="text-sm text-gray-600">沒有學生成員</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default FamilyRelationshipEditor
