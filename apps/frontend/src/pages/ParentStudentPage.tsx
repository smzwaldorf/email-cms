import { useEffect, useState } from 'react'
import { RelationshipMatrix } from '@/components/admin/RelationshipMatrix'
import { adminService } from '@/services/adminService'
import type { AdminUser } from '@/types/admin'
import { AdminLayout } from '@/components/admin/AdminLayout'

export function ParentStudentPage() {
  const [parents, setParents] = useState<AdminUser[]>([])
  const [students, setStudents] = useState<AdminUser[]>([])
  const [relationships, setRelationships] = useState<Array<{ parentId: string; studentId: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load all users
      const users = await adminService.fetchUsers()

      // Separate parents and students
      const parentList = users.filter(u => u.role === 'parent')
      const studentList = users.filter(u => u.role === 'student')

      setParents(parentList)
      setStudents(studentList)

      // Load relationships
      const rels = await adminService.getParentStudentRelationships()
      setRelationships(rels)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '加載資料失敗'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinkParentStudent = async (parentId: string, studentId: string) => {
    try {
      await adminService.linkParentToStudent(parentId, studentId)
      // Update local relationships
      setRelationships([...relationships, { parentId, studentId }])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '建立關係失敗'
      )
    }
  }

  const handleUnlinkParentStudent = async (parentId: string, studentId: string) => {
    try {
      await adminService.unlinkParentFromStudent(parentId, studentId)
      // Update local relationships
      setRelationships(
        relationships.filter(
          r => !(r.parentId === parentId && r.studentId === studentId)
        )
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '移除關係失敗'
      )
    }
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              家長-學生關係管理
            </h1>
            <p className="text-gray-600">
              管理家長與學生之間的一對多和多對一關係
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 font-semibold hover:underline"
              >
                關閉
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-600">加載中...</p>
              </div>
            </div>
          )}

          {/* Relationship Matrix */}
          {!isLoading && parents.length > 0 && students.length > 0 && (
            <>
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>家長人數:</strong> {parents.length} | <strong>學生人數:</strong> {students.length} | <strong>現有關係:</strong> {relationships.length}
                </p>
              </div>

              <RelationshipMatrix
                parents={parents}
                students={students}
                relationships={relationships}
                onLinkParentStudent={handleLinkParentStudent}
                onUnlinkParentStudent={handleUnlinkParentStudent}
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={loadData}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  刷新
                </button>
              </div>
            </>
          )}

          {!isLoading && (parents.length === 0 || students.length === 0) && (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <p className="text-yellow-800">
                {parents.length === 0
                  ? '沒有家長帳戶，請先建立家長用戶'
                  : '沒有學生帳戶，請先建立學生用戶'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
