/**
 * Family Management Page
 * 家族管理頁面
 * Page for managing all families in the system
 *
 * Features:
 * - View all families in a table
 * - Create new families
 * - Edit existing families
 * - Delete families with confirmation
 * - Filter and search families
 * - Error handling and loading states
 */

import { useEffect, useState } from 'react'
import type { Family, AdminUser } from '@/types/admin'
import { adminService, AdminServiceError } from '@/services/adminService'
import FamilyList from '@/components/admin/FamilyList'
import FamilyForm from '@/components/admin/FamilyForm'
import FamilyRelationshipEditor, { type FamilyMember } from '@/components/admin/FamilyRelationshipEditor'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import NotificationToast from '@/components/admin/NotificationToast'
import { AdminLayout } from '@/components/admin/AdminLayout'

type PageState = 'list' | 'create' | 'edit'

/**
 * Family Management Page
 */
export function FamilyManagementPage() {
  // State management
  const [families, setFamilies] = useState<Family[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageState, setPageState] = useState<PageState>('list')
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; familyId?: string }>({
    isOpen: false,
  })
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [availableParents, setAvailableParents] = useState<AdminUser[]>([])
  const [availableStudents, setAvailableStudents] = useState<AdminUser[]>([])
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false)

  /**
   * Load families on mount
   */
  useEffect(() => {
    loadFamilies()
  }, [])

  /**
   * Load all families
   */
  const loadFamilies = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await adminService.fetchFamilies()
      setFamilies(data)
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to load families'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle create family
   */
  const handleCreateFamily = async (familyData: Family) => {
    try {
      setIsSaving(true)
      await adminService.createFamily(
        familyData.name,
        familyData.description,
        familyData.relatedTopics
      )
      setNotification({ message: '家族已成功新增', type: 'success' })
      setPageState('list')
      await loadFamilies()
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to create family'
      setNotification({ message, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle edit family
   */
  const handleEditFamily = async (familyData: Family) => {
    try {
      setIsSaving(true)
      await adminService.updateFamily(familyData.id, {
        name: familyData.name,
        description: familyData.description,
        relatedTopics: familyData.relatedTopics,
      })
      setNotification({ message: '家族已成功更新', type: 'success' })
      setPageState('list')
      await loadFamilies()
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to update family'
      setNotification({ message, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle delete family
   */
  const handleDeleteFamily = async (familyId: string) => {
    try {
      setIsSaving(true)
      await adminService.deleteFamily(familyId)
      setNotification({ message: '家族已成功刪除', type: 'success' })
      setDeleteConfirm({ isOpen: false })
      await loadFamilies()
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to delete family'
      setNotification({ message, type: 'error' })
      setDeleteConfirm({ isOpen: false })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle edit button click
   */
  const handleEditClick = (familyId: string) => {
    const familyToEdit = families.find((f) => f.id === familyId)
    if (familyToEdit) {
      setSelectedFamily(familyToEdit)
      setPageState('edit')
      // Load family relationships when entering edit mode
      loadFamilyRelationships(familyToEdit)
    }
  }

  /**
   * Handle delete button click
   */
  const handleDeleteClick = (familyId: string) => {
    setDeleteConfirm({ isOpen: true, familyId })
  }

  /**
   * Load family members and available users when editing
   */
  const loadFamilyRelationships = async (family: Family) => {
    try {
      setIsLoadingRelationships(true)
      const [members, parents, students] = await Promise.all([
        adminService.getFamilyMembers(family.id),
        adminService.getAvailableParents(family.id),
        adminService.getAvailableStudents(family.id),
      ])
      setFamilyMembers(members as FamilyMember[])
      setAvailableParents(parents)
      setAvailableStudents(students)
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to load family relationships'
      setNotification({ message, type: 'error' })
    } finally {
      setIsLoadingRelationships(false)
    }
  }

  /**
   * Handle add parent to family
   */
  const handleAddParent = async (parentId: string, relationship: 'father' | 'mother' | 'guardian') => {
    if (!selectedFamily) return
    try {
      setIsSaving(true)
      await adminService.addParentToFamily(selectedFamily.id, parentId, relationship)
      await loadFamilyRelationships(selectedFamily)
      setNotification({ message: '家長已成功新增', type: 'success' })
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to add parent'
      setNotification({ message, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle remove parent from family
   */
  const handleRemoveParent = async (parentId: string) => {
    if (!selectedFamily) return
    try {
      setIsSaving(true)
      await adminService.removeParentFromFamily(selectedFamily.id, parentId)
      await loadFamilyRelationships(selectedFamily)
      setNotification({ message: '家長已成功移除', type: 'success' })
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to remove parent'
      setNotification({ message, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle update parent relationship
   */
  const handleUpdateParentRelationship = async (parentId: string, relationship: 'father' | 'mother' | 'guardian') => {
    if (!selectedFamily) return
    try {
      setIsSaving(true)
      await adminService.updateParentRelationship(selectedFamily.id, parentId, relationship)
      await loadFamilyRelationships(selectedFamily)
      setNotification({ message: '家長關係已成功更新', type: 'success' })
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to update parent relationship'
      setNotification({ message, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle add student to family
   */
  const handleAddStudent = async (studentId: string) => {
    if (!selectedFamily) return
    try {
      setIsSaving(true)
      await adminService.addStudentToFamily(selectedFamily.id, studentId)
      await loadFamilyRelationships(selectedFamily)
      setNotification({ message: '學生已成功新增', type: 'success' })
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to add student'
      setNotification({ message, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Handle remove student from family
   */
  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedFamily) return
    try {
      setIsSaving(true)
      await adminService.removeStudentFromFamily(selectedFamily.id, studentId)
      await loadFamilyRelationships(selectedFamily)
      setNotification({ message: '學生已成功移除', type: 'success' })
    } catch (err: any) {
      const message = err instanceof AdminServiceError ? err.message : 'Failed to remove student'
      setNotification({ message, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  // Render loading state
  if (isLoading) {
    return (
      <AdminLayout activeTab="families">
        <div className="flex flex-col items-center justify-center h-64">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-waldorf-cream-200 border-t-waldorf-sage-500 animate-spin"></div>
          </div>
          <span className="mt-4 text-waldorf-clay-500 font-medium">載入家族中...</span>
        </div>
      </AdminLayout>
    )
  }

  // Render list view
  if (pageState === 'list') {
    return (
      <AdminLayout
        activeTab="families"
        headerAction={
          <button
            onClick={() => setPageState('create')}
            className="group px-5 py-2.5 bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 text-white rounded-xl hover:from-waldorf-sage-600 hover:to-waldorf-sage-700 transition-all duration-300 font-medium shadow-lg shadow-waldorf-sage-200/50 flex items-center space-x-2"
            data-testid="create-btn"
          >
            <svg className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>新增家族</span>
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
                家族: <strong className="font-semibold">{families.length}</strong>
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

          {/* Family list */}
          <FamilyList
            families={families}
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
            title="刪除家族"
            message="確定要刪除這個家族嗎？此操作無法復原。"
            confirmText="刪除"
            cancelText="取消"
            isDangerous={true}
            isLoading={isSaving}
            onConfirm={() => {
              if (deleteConfirm.familyId) {
                handleDeleteFamily(deleteConfirm.familyId)
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
      <AdminLayout activeTab="families">
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
          <FamilyForm
            isNew={true}
            onSave={handleCreateFamily}
            onCancel={() => setPageState('list')}
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
  if (pageState === 'edit' && selectedFamily) {
    return (
      <AdminLayout activeTab="families">
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

          {/* Family Relationship Editor */}
          {isLoadingRelationships ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-waldorf-cream-200 border-t-waldorf-sage-500 animate-spin"></div>
              </div>
              <span className="mt-4 text-waldorf-clay-500 font-medium">載入家族成員中...</span>
            </div>
          ) : (
            <FamilyRelationshipEditor
              familyCode={selectedFamily.name}
              familyMembers={familyMembers}
              availableParents={availableParents}
              availableStudents={availableStudents}
              onAddParent={handleAddParent}
              onRemoveParent={handleRemoveParent}
              onUpdateParentRelationship={handleUpdateParentRelationship}
              onAddStudent={handleAddStudent}
              onRemoveStudent={handleRemoveStudent}
            />
          )}

          <FamilyForm
            family={selectedFamily}
            isNew={false}
            onSave={handleEditFamily}
            onCancel={() => setPageState('list')}
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

export default FamilyManagementPage
