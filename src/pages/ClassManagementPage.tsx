/**
 * Class Management Page
 * 班級管理頁面
 * Page for managing all classes in the system
 *
 * Features:
 * - View all classes in a table
 * - Create new classes
 * - Edit existing classes
 * - Delete classes with confirmation
 * - Filter and search classes
 * - Error handling and loading states
 */

import { useEffect, useState } from 'react'
import type { Class, AdminUser } from '@/types/admin'
import { adminService, AdminServiceError } from '@/services/adminService'
import ClassList from '@/components/admin/ClassList'
import ClassForm from '@/components/admin/ClassForm'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import NotificationToast from '@/components/admin/NotificationToast'
import { AdminLayout } from '@/components/admin/AdminLayout'

type PageState = 'list' | 'create' | 'edit'

/**
 * Class Management Page
 */
export function ClassManagementPage() {
  // State management
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageState, setPageState] = useState<PageState>('list')
  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; classId?: string }>({
    isOpen: false,
  })
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  /**
   * Load classes on mount
   */
  useEffect(() => {
    loadClasses()
    loadStudents()
  }, [])

  /**
   * Load all classes
   */
  const loadClasses = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await adminService.fetchClasses()
      setClasses(data)
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to load classes'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Load all students
   */
  const loadStudents = async () => {
    try {
      const data = await adminService.fetchUsers?.('student')
      if (data) {
        setStudents(data)
      }
    } catch (err) {
      console.error('Failed to load students:', err)
    }
  }

  /**
   * Handle create class
   */
  const handleCreateClass = async (classData: Class) => {
    try {
      setIsSaving(true)
      await adminService.createClass(classData.name, classData.description, classData.studentIds)
      setNotification({ message: '班級已成功新增', type: 'success' })
      setPageState('list')
      await loadClasses()
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to create class'
      setNotification({ message, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle edit class
   */
  const handleEditClass = async (classData: Class) => {
    try {
      setIsSaving(true)
      await adminService.updateClass(classData.id, {
        name: classData.name,
        description: classData.description,
        studentIds: classData.studentIds,
      })
      setNotification({ message: '班級已成功更新', type: 'success' })
      setPageState('list')
      await loadClasses()
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to update class'
      setNotification({ message, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle delete class
   */
  const handleDeleteClass = async (classId: string) => {
    try {
      setIsSaving(true)
      await adminService.deleteClass(classId)
      setNotification({ message: '班級已成功刪除', type: 'success' })
      setDeleteConfirm({ isOpen: false })
      await loadClasses()
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to delete class'
      setNotification({ message, type: 'error' })
      setDeleteConfirm({ isOpen: false })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle edit button click
   */
  const handleEditClick = (classId: string) => {
    const classToEdit = classes.find((c) => c.id === classId)
    if (classToEdit) {
      setSelectedClass(classToEdit)
      setPageState('edit')
    }
  }

  /**
   * Handle delete button click
   */
  const handleDeleteClick = (classId: string) => {
    setDeleteConfirm({ isOpen: true, classId })
  }

  // Render loading state
  if (isLoading) {
    return (
      <AdminLayout activeTab="classes">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">載入班級中...</span>
        </div>
      </AdminLayout>
    )
  }

  // Render list view
  if (pageState === 'list') {
    return (
      <AdminLayout
        activeTab="classes"
        headerAction={
          <button
            onClick={() => setPageState('create')}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium"
            data-testid="create-btn"
          >
            新增班級
          </button>
        }
      >
        <div className="space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">錯誤</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Class list */}
          <ClassList
            classes={classes}
            isLoading={false}
            error={null}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
          />

          {/* Notification */}
          {notification && (
            <NotificationToast
              message={notification.message}
              type={notification.type}
              onClose={() => setNotification(null)}
            />
          )}

          {/* Delete confirmation dialog */}
          <ConfirmDialog
            isOpen={deleteConfirm.isOpen}
            title="刪除班級"
            message="確定要刪除這個班級嗎？此操作無法復原。"
            confirmText="刪除"
            cancelText="取消"
            isDangerous={true}
            isLoading={isSaving}
            onConfirm={() => {
              if (deleteConfirm.classId) {
                handleDeleteClass(deleteConfirm.classId)
              }
            }}
            onCancel={() => setDeleteConfirm({ isOpen: false })}
          />
        </div>
      </AdminLayout>
    )
  }

  // Render create view
  if (pageState === 'create') {
    return (
      <AdminLayout activeTab="classes">
        <div className="space-y-4">
          <button
            onClick={() => setPageState('list')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            data-testid="back-btn"
          >
            ← 返回
          </button>
          <ClassForm
            isNew={true}
            onSave={handleCreateClass}
            onCancel={() => setPageState('list')}
            availableStudents={students}
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

  // Render edit view
  if (pageState === 'edit' && selectedClass) {
    return (
      <AdminLayout activeTab="classes">
        <div className="space-y-4">
          <button
            onClick={() => setPageState('list')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            data-testid="back-btn"
          >
            ← 返回
          </button>
          <ClassForm
            class={selectedClass}
            isNew={false}
            onSave={handleEditClass}
            onCancel={() => setPageState('list')}
            availableStudents={students}
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

  return null
}

export default ClassManagementPage
