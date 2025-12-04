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
  classes?: Array<{ id: string; name: string }> // Classes student belongs to
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
        <div className="p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl animate-fade-in">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-waldorf-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-waldorf-rose-900 font-semibold">錯誤</p>
              <p className="text-waldorf-rose-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Family Info */}
      <div className="p-4 bg-waldorf-sage-50 border border-waldorf-sage-200 rounded-xl">
        <p className="text-waldorf-sage-900 font-medium">
          <span className="text-waldorf-sage-700">家族代碼：</span> <span className="font-display font-semibold text-waldorf-clay-800">{familyCode}</span>
        </p>
      </div>

      {/* Parents Section */}
      <div>
        <h3 className="text-lg font-display font-bold text-waldorf-clay-800 mb-4">家族成員 <span className="text-waldorf-sage-600 text-base font-normal">({parents.length})</span></h3>

        {/* Add Parent Button */}
        <div className="mb-6">
          <div className="relative">
            <button
              type="button"
              onClick={() => setParentDropdownOpen(!parentDropdownOpen)}
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl shadow-sm bg-waldorf-cream-50 text-left hover:bg-waldorf-cream-100 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 transition-all duration-200 font-medium text-waldorf-clay-700"
              disabled={filteredAvailableParents.length === 0 || isLoading}
            >
              <span>
                {filteredAvailableParents.length > 0 ? '+ 新增家族成員' : '所有成員已新增'}
              </span>
            </button>

            {parentDropdownOpen && filteredAvailableParents.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-waldorf-cream-200 rounded-xl shadow-xl shadow-waldorf-clay-200/20 z-10 animate-scale-in">
                <div className="p-3 border-b border-waldorf-cream-200">
                  <input
                    type="text"
                    placeholder="搜尋家族成員..."
                    value={parentSearchTerm}
                    onChange={(e) => setParentSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-waldorf-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 bg-waldorf-cream-50 transition-all duration-200"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {filteredAvailableParents.map((parent) => (
                    <div key={parent.id} className="border-b border-waldorf-cream-100 last:border-b-0">
                      <div className="px-4 py-3 hover:bg-waldorf-cream-50 transition-colors duration-200">
                        <div className="text-sm font-medium text-waldorf-clay-900">{parent.name}</div>
                        <div className="text-xs text-waldorf-clay-500 mb-3">{parent.email}</div>
                        <div className="flex gap-2 flex-wrap">
                          {RELATIONSHIP_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleAddParent(parent.id, opt.value)}
                              disabled={isLoading}
                              className="px-3 py-1.5 text-xs bg-waldorf-peach-100 text-waldorf-peach-700 rounded-lg hover:bg-waldorf-peach-200 transition-colors duration-200 disabled:opacity-50 font-medium"
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
                <h4 className="text-sm font-semibold text-waldorf-clay-700 mb-3 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-waldorf-peach-500 rounded-full"></span>
                  父親
                </h4>
                <div className="space-y-2 ml-5">
                  {parents
                    .filter((p) => p.relationship === 'father')
                    .map((parent) => (
                      <div
                        key={parent.id}
                        className="flex items-center justify-between p-3 bg-waldorf-peach-50 border border-waldorf-peach-200 rounded-lg hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-waldorf-clay-900">{parent.name}</div>
                          <div className="text-xs text-waldorf-clay-500">{parent.email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveParent(parent.id)}
                          className="px-3 py-1.5 text-xs text-waldorf-rose-700 bg-waldorf-rose-100 border border-waldorf-rose-200 rounded-lg hover:bg-waldorf-rose-200 transition-colors duration-200 disabled:opacity-50 font-medium"
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
                <h4 className="text-sm font-semibold text-waldorf-clay-700 mb-3 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-waldorf-rose-500 rounded-full"></span>
                  母親
                </h4>
                <div className="space-y-2 ml-5">
                  {parents
                    .filter((p) => p.relationship === 'mother')
                    .map((parent) => (
                      <div
                        key={parent.id}
                        className="flex items-center justify-between p-3 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-lg hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-waldorf-clay-900">{parent.name}</div>
                          <div className="text-xs text-waldorf-clay-500">{parent.email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveParent(parent.id)}
                          className="px-3 py-1.5 text-xs text-waldorf-rose-700 bg-waldorf-rose-100 border border-waldorf-rose-200 rounded-lg hover:bg-waldorf-rose-200 transition-colors duration-200 disabled:opacity-50 font-medium"
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
                <h4 className="text-sm font-semibold text-waldorf-clay-700 mb-3 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-waldorf-lavender-500 rounded-full"></span>
                  監護人
                </h4>
                <div className="space-y-2 ml-5">
                  {parents
                    .filter((p) => p.relationship === 'guardian')
                    .map((parent) => (
                      <div
                        key={parent.id}
                        className="flex items-center justify-between p-3 bg-waldorf-lavender-50 border border-waldorf-lavender-200 rounded-lg hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-waldorf-clay-900">{parent.name}</div>
                          <div className="text-xs text-waldorf-clay-500">{parent.email}</div>
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
                              className="px-3 py-1.5 text-xs border border-waldorf-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 bg-waldorf-cream-50 transition-all duration-200 font-medium"
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
                              className="px-3 py-1.5 text-xs text-waldorf-lavender-700 bg-waldorf-lavender-100 border border-waldorf-lavender-200 rounded-lg hover:bg-waldorf-lavender-200 transition-colors duration-200 disabled:opacity-50 font-medium"
                              disabled={isLoading}
                            >
                              編輯
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveParent(parent.id)}
                            className="px-3 py-1.5 text-xs text-waldorf-rose-700 bg-waldorf-rose-100 border border-waldorf-rose-200 rounded-lg hover:bg-waldorf-rose-200 transition-colors duration-200 disabled:opacity-50 font-medium"
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
          <div className="p-6 bg-waldorf-cream-50 border border-waldorf-cream-200 rounded-xl text-center">
            <p className="text-sm text-waldorf-clay-600 font-medium">沒有家族成員</p>
          </div>
        )}
      </div>

      {/* Students Section */}
      <div>
        <h3 className="text-lg font-display font-bold text-waldorf-clay-800 mb-4">學生成員 <span className="text-waldorf-sage-600 text-base font-normal">({students.length})</span></h3>

        {/* Add Student */}
        <div className="mb-6">
          <div className="relative">
            <button
              type="button"
              onClick={() => setStudentDropdownOpen(!studentDropdownOpen)}
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl shadow-sm bg-waldorf-cream-50 text-left hover:bg-waldorf-cream-100 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 transition-all duration-200 font-medium text-waldorf-clay-700"
              disabled={filteredAvailableStudents.length === 0 || isLoading}
            >
              <span>
                {filteredAvailableStudents.length > 0 ? '+ 新增學生' : '所有學生已新增'}
              </span>
            </button>

            {studentDropdownOpen && filteredAvailableStudents.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-waldorf-cream-200 rounded-xl shadow-xl shadow-waldorf-clay-200/20 z-10 animate-scale-in">
                <div className="p-3 border-b border-waldorf-cream-200">
                  <input
                    type="text"
                    placeholder="搜尋學生..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-waldorf-cream-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 bg-waldorf-cream-50 transition-all duration-200"
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
                      className="w-full text-left px-4 py-3 hover:bg-waldorf-cream-50 border-b border-waldorf-cream-100 last:border-b-0 disabled:opacity-50 transition-colors duration-200"
                    >
                      <div className="text-sm font-medium text-waldorf-clay-900">{student.name}</div>
                      <div className="text-xs text-waldorf-clay-500">{student.email}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Students List */}
        {students.length > 0 ? (
          <div className="space-y-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-4 bg-waldorf-sage-50 border border-waldorf-sage-200 rounded-lg hover:shadow-md transition-all duration-200"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-waldorf-clay-900">{student.name}</div>
                  <div className="text-xs text-waldorf-clay-500 mb-2">{student.email}</div>
                  {student.classes && student.classes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {student.classes.map((classItem) => (
                        <span
                          key={classItem.id}
                          className="inline-flex items-center px-2.5 py-1 text-xs bg-waldorf-lavender-100 text-waldorf-lavender-700 rounded-full font-medium"
                        >
                          {classItem.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveStudent(student.id)}
                  className="px-3 py-1.5 text-xs text-waldorf-rose-700 bg-waldorf-rose-100 border border-waldorf-rose-200 rounded-lg hover:bg-waldorf-rose-200 transition-colors duration-200 disabled:opacity-50 font-medium whitespace-nowrap ml-4"
                  disabled={isLoading}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 bg-waldorf-cream-50 border border-waldorf-cream-200 rounded-xl text-center">
            <p className="text-sm text-waldorf-clay-600 font-medium">沒有學生成員</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default FamilyRelationshipEditor
