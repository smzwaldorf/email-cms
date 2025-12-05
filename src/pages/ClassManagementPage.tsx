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
import { getSupabaseServiceClient } from '@/lib/supabase'
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
  const [teachers, setTeachers] = useState<AdminUser[]>([])
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
    loadTeachers()
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
      const supabase = getSupabaseServiceClient()
      const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) {
        throw new Error(`Failed to fetch students: ${error.message}`)
      }

      // Convert students table format to AdminUser format
      const studentList: AdminUser[] = (data || []).map((student: any) => ({
        id: student.id,
        name: student.name,
        email: '',
        role: 'student' as const,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))

      setStudents(studentList)
      console.log(`Loaded ${studentList.length} students:`, studentList)
    } catch (err) {
      console.error('Failed to load students:', err)
      setError(`無法加載學生列表: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * Load all teachers
   */
  const loadTeachers = async () => {
    try {
      const allUsers = await adminService.fetchUsers()
      // Filter for teachers only
      const teacherList = allUsers.filter((user) => user.role === 'teacher')
      setTeachers(teacherList)
      console.log(`Loaded ${teacherList.length} teachers:`, teacherList)
    } catch (err) {
      console.error('Failed to load teachers:', err)
      setError(`無法加載教師列表: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * Handle create class
   */
  const handleCreateClass = async (classData: Class) => {
    try {
      setIsSaving(true)
      await adminService.createClass(classData.name, classData.description, classData.studentIds, classData.teacherIds)
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
        teacherIds: classData.teacherIds,
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
        <div className="flex flex-col items-center justify-center h-64">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-waldorf-cream-200 border-t-waldorf-sage-500 animate-spin"></div>
          </div>
          <span className="mt-4 text-waldorf-clay-500 font-medium">載入班級中...</span>
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
            className="group px-5 py-2.5 bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 text-white rounded-xl hover:from-waldorf-sage-600 hover:to-waldorf-sage-700 transition-all duration-300 font-medium shadow-lg shadow-waldorf-sage-200/50 flex items-center space-x-2"
            data-testid="create-btn"
          >
            <svg className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>新增班級</span>
          </button>
        }
      >
        <div className="space-y-6">
          {/* Info message */}
          <div className="p-4 bg-waldorf-sage-50 border border-waldorf-sage-200 rounded-xl animate-fade-in">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-waldorf-sage-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-waldorf-sage-800">
                班級: <strong className="font-semibold">{classes.length}</strong> | 學生: <strong className="font-semibold">{students.length}</strong>
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl animate-fade-in">
              <p className="text-waldorf-rose-800 font-semibold">錯誤</p>
              <p className="text-waldorf-rose-600 text-sm mt-1">{error}</p>
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
        <div className="space-y-6">
          <button
            onClick={() => setPageState('list')}
            className="group flex items-center text-waldorf-clay-500 hover:text-waldorf-peach-600 transition-all duration-300 font-medium"
            data-testid="back-btn"
          >
            <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </button>
          <ClassForm
            isNew={true}
            onSave={handleCreateClass}
            onCancel={() => setPageState('list')}
            availableStudents={students}
            availableTeachers={teachers}
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
        <div className="space-y-6">
          <button
            onClick={() => setPageState('list')}
            className="group flex items-center text-waldorf-clay-500 hover:text-waldorf-peach-600 transition-all duration-300 font-medium"
            data-testid="back-btn"
          >
            <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </button>
          <ClassForm
            class={selectedClass}
            isNew={false}
            onSave={handleEditClass}
            onCancel={() => setPageState('list')}
            availableStudents={students}
            availableTeachers={teachers}
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
