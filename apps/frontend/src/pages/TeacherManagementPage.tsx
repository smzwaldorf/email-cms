import { useEffect, useState } from 'react'
import type { AdminUser } from '@/types/admin'
import { adminService, AdminServiceError } from '@/services/adminService'
import type { TeacherAssignedClass } from '@/services/adminService'
import { AdminLayout } from '@/components/admin/AdminLayout'
import TeacherList from '@/components/admin/TeacherList'
import TeacherForm from '@/components/admin/TeacherForm'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import NotificationToast from '@/components/admin/NotificationToast'

type PageState = 'list' | 'create' | 'edit'

function extractTeacherValidationMessage(err: unknown): string | null {
  if (!(err instanceof AdminServiceError)) return null
  if (err.code !== 'TEACHER_VALIDATION_ERROR') return null
  try {
    const parsed = JSON.parse(err.message)
    const fieldErrors = parsed?.fieldErrors
    return fieldErrors ? Object.values(fieldErrors)[0] as string : null
  } catch {
    return err.message
  }
}

export function TeacherManagementPage() {
  const [teachers, setTeachers] = useState<AdminUser[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageState, setPageState] = useState<PageState>('list')
  const [selectedTeacher, setSelectedTeacher] = useState<AdminUser | null>(null)
  const [assignedClasses, setAssignedClasses] = useState<TeacherAssignedClass[]>([])
  const [isLoadingAssignedClasses, setIsLoadingAssignedClasses] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean
    teacherId?: string
    action?: 'activate' | 'deactivate'
  }>({ isOpen: false })
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  const loadTeachers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await adminService.fetchTeachers({ includeInactive: showInactive })
      setTeachers(data)
    } catch (err) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to load teachers'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTeachers()
  }, [showInactive])

  useEffect(() => {
    const loadAssignedClasses = async () => {
      if (pageState !== 'edit' || !selectedTeacher) return
      try {
        setIsLoadingAssignedClasses(true)
        const classes = await adminService.fetchTeacherAssignedClasses(selectedTeacher.id)
        setAssignedClasses(classes)
      } catch {
        setAssignedClasses([])
      } finally {
        setIsLoadingAssignedClasses(false)
      }
    }
    void loadAssignedClasses()
  }, [pageState, selectedTeacher?.id])

  const handleCreateTeacher = async (payload: { name: string; email: string }) => {
    try {
      setIsSaving(true)
      await adminService.createTeacher(payload.email, payload.name)
      setNotification({ message: '教師已成功新增', type: 'success' })
      setPageState('list')
      await loadTeachers()
    } catch (err) {
      setNotification({
        message:
          extractTeacherValidationMessage(err) ||
          (err instanceof AdminServiceError ? err.message : 'Failed to create teacher'),
        type: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateTeacher = async (payload: { name: string; email: string }) => {
    if (!selectedTeacher) return
    try {
      setIsSaving(true)
      await adminService.updateTeacher(selectedTeacher.id, { name: payload.name })
      setNotification({ message: '教師資料已更新', type: 'success' })
      setPageState('list')
      await loadTeachers()
    } catch (err) {
      setNotification({
        message:
          extractTeacherValidationMessage(err) ||
          (err instanceof AdminServiceError ? err.message : 'Failed to update teacher'),
        type: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmLifecycle = async () => {
    if (!confirmAction.teacherId || !confirmAction.action) return
    try {
      setIsSaving(true)
      if (confirmAction.action === 'activate') {
        await adminService.activateTeacher(confirmAction.teacherId)
        setNotification({ message: '教師已啟用', type: 'success' })
      } else {
        await adminService.deactivateTeacher(confirmAction.teacherId)
        setNotification({ message: '教師已停用', type: 'success' })
      }
      setConfirmAction({ isOpen: false })
      await loadTeachers()
    } catch (err) {
      setNotification({
        message: err instanceof AdminServiceError ? err.message : '教師狀態更新失敗',
        type: 'error',
      })
      setConfirmAction({ isOpen: false })
    } finally {
      setIsSaving(false)
    }
  }

  if (pageState === 'create') {
    return (
      <AdminLayout activeTab="teachers">
        <div className="space-y-6">
          <button
            onClick={() => setPageState('list')}
            className="group flex items-center text-waldorf-clay-500 hover:text-waldorf-peach-600 transition-all duration-300 font-medium"
          >
            <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </button>
          <TeacherForm isNew={true} onSave={handleCreateTeacher} onCancel={() => setPageState('list')} />
        </div>
      </AdminLayout>
    )
  }

  if (pageState === 'edit' && selectedTeacher) {
    return (
      <AdminLayout activeTab="teachers">
        <div className="space-y-6">
          <button
            onClick={() => setPageState('list')}
            className="group flex items-center text-waldorf-clay-500 hover:text-waldorf-peach-600 transition-all duration-300 font-medium"
          >
            <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </button>
          <TeacherForm
            teacher={selectedTeacher}
            isNew={false}
            assignedClasses={assignedClasses}
            isLoadingAssignedClasses={isLoadingAssignedClasses}
            onSave={handleUpdateTeacher}
            onCancel={() => setPageState('list')}
          />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      activeTab="teachers"
      headerAction={
        <button
          onClick={() => setPageState('create')}
          className="group px-5 py-2.5 bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 text-white rounded-xl hover:from-waldorf-sage-600 hover:to-waldorf-sage-700 transition-all duration-300 font-medium shadow-lg shadow-waldorf-sage-200/50 flex items-center space-x-2"
          data-testid="create-teacher-btn"
        >
          <svg className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>新增教師</span>
        </button>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-waldorf-clay-600">教師總數：{teachers.length}</p>
          <label className="inline-flex items-center gap-2 text-sm text-waldorf-clay-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              data-testid="include-inactive-teachers-toggle"
            />
            顯示停用教師
          </label>
        </div>

        <TeacherList
          teachers={teachers}
          isLoading={isLoading}
          error={error}
          onEdit={(teacher) => {
            setSelectedTeacher(teacher)
            setPageState('edit')
          }}
          onActivate={(teacherId) => setConfirmAction({ isOpen: true, teacherId, action: 'activate' })}
          onDeactivate={(teacherId) => setConfirmAction({ isOpen: true, teacherId, action: 'deactivate' })}
        />

        <ConfirmDialog
          isOpen={confirmAction.isOpen}
          title={confirmAction.action === 'activate' ? '啟用教師' : '停用教師'}
          message={
            confirmAction.action === 'activate'
              ? '確定要啟用這位教師嗎？'
              : '確定要停用這位教師嗎？停用後將不會出現在預設教師選擇清單。'
          }
          confirmText={confirmAction.action === 'activate' ? '啟用' : '停用'}
          cancelText="取消"
          isDangerous={confirmAction.action !== 'activate'}
          isLoading={isSaving}
          onConfirm={handleConfirmLifecycle}
          onCancel={() => setConfirmAction({ isOpen: false })}
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

export default TeacherManagementPage
