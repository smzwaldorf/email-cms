import { useEffect, useState } from 'react'
import type { AdminUser } from '@/types/admin'
import { adminService, AdminServiceError } from '@/services/adminService'
import { AdminLayout } from '@/components/admin/AdminLayout'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import NotificationToast from '@/components/admin/NotificationToast'

type PageState = 'list' | 'create' | 'edit'

export function StudentManagementPage() {
  const [students, setStudents] = useState<AdminUser[]>([])
  const [name, setName] = useState('')
  const [editingStudent, setEditingStudent] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [pageState, setPageState] = useState<PageState>('list')
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; studentId?: string }>({ isOpen: false })

  const loadStudents = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await adminService.fetchStudents()
      setStudents(data)
    } catch (err) {
      setError(err instanceof AdminServiceError ? err.message : 'Failed to load students')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadStudents()
  }, [])

  const handleCreate = async () => {
    try {
      setIsSaving(true)
      await adminService.createStudent(name)
      setNotification({ message: '學生已成功新增', type: 'success' })
      setName('')
      setPageState('list')
      await loadStudents()
    } catch (err) {
      setNotification({
        message: err instanceof AdminServiceError ? err.message : 'Failed to create student',
        type: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingStudent) return
    try {
      setIsSaving(true)
      await adminService.updateStudent(editingStudent.id, { name })
      setNotification({ message: '學生資料已更新', type: 'success' })
      setName('')
      setEditingStudent(null)
      setPageState('list')
      await loadStudents()
    } catch (err) {
      setNotification({
        message: err instanceof AdminServiceError ? err.message : 'Failed to update student',
        type: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm.studentId) return
    try {
      setIsSaving(true)
      await adminService.deleteStudent(deleteConfirm.studentId)
      setNotification({ message: '學生已刪除', type: 'success' })
      setDeleteConfirm({ isOpen: false })
      await loadStudents()
    } catch (err) {
      setNotification({
        message: err instanceof AdminServiceError ? err.message : 'Failed to delete student',
        type: 'error',
      })
      setDeleteConfirm({ isOpen: false })
    } finally {
      setIsSaving(false)
    }
  }

  if (pageState === 'create' || (pageState === 'edit' && editingStudent)) {
    return (
      <AdminLayout activeTab="students">
        <div className="space-y-6">
          <button
            onClick={() => {
              setPageState('list')
              setEditingStudent(null)
              setName('')
            }}
            className="group flex items-center text-waldorf-clay-500 hover:text-waldorf-peach-600 transition-all duration-300 font-medium"
          >
            <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </button>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-waldorf-cream-200 p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">
              {pageState === 'create' ? '新增學生' : '編輯學生'}
            </h2>
            <label className="block">
              <span className="block text-sm font-medium text-waldorf-clay-600 mb-2">姓名</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="學生姓名"
                className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300"
              />
            </label>
            <div className="flex justify-end">
              <button
                onClick={pageState === 'create' ? handleCreate : handleUpdate}
                disabled={isSaving}
                className="px-5 py-2.5 bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 text-white rounded-xl disabled:opacity-50"
              >
                {isSaving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      activeTab="students"
      headerAction={
        <button
          onClick={() => {
            setName('')
            setPageState('create')
          }}
          className="group px-5 py-2.5 bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 text-white rounded-xl hover:from-waldorf-sage-600 hover:to-waldorf-sage-700 transition-all duration-300 font-medium shadow-lg shadow-waldorf-sage-200/50 flex items-center space-x-2"
        >
          <svg className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>新增學生</span>
        </button>
      }
    >
      <div className="space-y-6">
        <p className="text-waldorf-clay-600">學生總數：{students.length}</p>
        {error && <div className="text-waldorf-rose-700 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl p-4">{error}</div>}
        {isLoading ? (
          <div className="text-waldorf-clay-500">載入中...</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-waldorf-cream-200">
            <table className="w-full bg-white">
              <thead className="bg-waldorf-cream-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-waldorf-clay-600 uppercase">姓名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-waldorf-clay-600 uppercase">建立時間</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-waldorf-clay-600 uppercase">操作</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-t border-waldorf-cream-100">
                    <td className="px-4 py-3 text-sm text-waldorf-clay-700">{student.name}</td>
                    <td className="px-4 py-3 text-sm text-waldorf-clay-700">
                      {new Date(student.createdAt).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      <button
                        onClick={() => {
                          setEditingStudent(student)
                          setName(student.name)
                          setPageState('edit')
                        }}
                        className="px-3 py-1.5 bg-waldorf-clay-100 text-waldorf-clay-700 text-xs rounded-lg hover:bg-waldorf-clay-200"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, studentId: student.id })}
                        className="px-3 py-1.5 bg-waldorf-rose-100 text-waldorf-rose-700 text-xs rounded-lg hover:bg-waldorf-rose-200"
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title="刪除學生"
          message="確定要刪除這位學生嗎？相關家庭與班級關聯也會移除。"
          confirmText="刪除"
          cancelText="取消"
          isDangerous={true}
          isLoading={isSaving}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm({ isOpen: false })}
        />

        {notification && (
          <NotificationToast
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </AdminLayout>
  )
}

export default StudentManagementPage
