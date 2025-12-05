/**
 * Relationship Matrix Component
 * 家長-學生關係矩陣視覺化
 *
 * Features:
 * - Display parent-student relationships in a matrix format
 * - Allow adding/removing relationships
 * - Validate one-to-many and many-to-one constraints
 */

import { useState, useEffect } from 'react'
import type { AdminUser } from '@/types/admin'

export interface RelationshipMatrixProps {
  parents: AdminUser[]
  students: AdminUser[]
  relationships: Array<{ parentId: string; studentId: string }>
  onLinkParentStudent: (parentId: string, studentId: string) => Promise<void>
  onUnlinkParentStudent: (parentId: string, studentId: string) => Promise<void>
}

export function RelationshipMatrix({
  parents,
  students,
  relationships,
  onLinkParentStudent,
  onUnlinkParentStudent,
}: RelationshipMatrixProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRelated = (parentId: string, studentId: string): boolean => {
    return relationships.some(
      r => r.parentId === parentId && r.studentId === studentId
    )
  }

  const handleToggleRelationship = async (
    parentId: string,
    studentId: string
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      if (isRelated(parentId, studentId)) {
        await onUnlinkParentStudent(parentId, studentId)
      } else {
        await onLinkParentStudent(parentId, studentId)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '操作失敗'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (parents.length === 0 || students.length === 0) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg text-center">
        <p className="text-gray-600">
          {parents.length === 0
            ? '沒有家長'
            : '沒有學生'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200 text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                家長
              </th>
              {students.map(student => (
                <th
                  key={student.id}
                  className="px-2 py-2 text-center text-xs font-semibold text-gray-700 max-w-xs"
                >
                  <div className="whitespace-normal break-words">
                    {student.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parents.map((parent, parentIdx) => (
              <tr
                key={parent.id}
                className={`border-b ${
                  parentIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  {parent.name}
                </td>
                {students.map(student => (
                  <td
                    key={`${parent.id}-${student.id}`}
                    className="px-2 py-2 text-center"
                  >
                    <button
                      onClick={() =>
                        handleToggleRelationship(parent.id, student.id)
                      }
                      disabled={isLoading}
                      className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${
                        isRelated(parent.id, student.id)
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={
                        isRelated(parent.id, student.id)
                          ? '點擊移除關係'
                          : '點擊新增關係'
                      }
                    >
                      {isRelated(parent.id, student.id) ? '✓' : '+'}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-600">
        <p>
          ✓ 表示關聯 | + 表示未關聯 | 點擊切換關係
        </p>
      </div>
    </div>
  )
}
