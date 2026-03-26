import { useEffect, useMemo, useState } from 'react'
import type { AdminUser, Class, Family } from '@/types/admin'
import { adminService, AdminServiceError } from '@/services/adminService'
import { AdminLayout } from '@/components/admin/AdminLayout'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import NotificationToast from '@/components/admin/NotificationToast'

type PageState = 'list' | 'create' | 'edit'
type WizardStep = 'details' | 'family' | 'class' | 'review' | 'done'
type FamilyMode = 'skip' | 'existing' | 'create'

interface WizardStatus {
  status: 'success' | 'failed' | 'skipped'
  message: string
}

interface WizardResult {
  createdStudent: AdminUser
  familyLink: WizardStatus
  classAssign: WizardStatus
}

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
  const [wizardStep, setWizardStep] = useState<WizardStep>('details')
  const [wizardErrors, setWizardErrors] = useState<{
    name?: string
    class?: string
    familySelection?: string
    familyName?: string
  }>({})
  const [selectedFamilyId, setSelectedFamilyId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [familyMode, setFamilyMode] = useState<FamilyMode>('skip')
  const [newFamilyName, setNewFamilyName] = useState('')
  const [newFamilyDescription, setNewFamilyDescription] = useState('')
  const [availableFamilies, setAvailableFamilies] = useState<Family[]>([])
  const [availableClasses, setAvailableClasses] = useState<Class[]>([])
  const [wizardResult, setWizardResult] = useState<WizardResult | null>(null)
  const [isLoadingWizardOptions, setIsLoadingWizardOptions] = useState(false)
  const [showInactiveStudents, setShowInactiveStudents] = useState(false)

  const loadStudents = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await adminService.fetchStudents({ includeInactive: showInactiveStudents })
      setStudents(data)
    } catch (err) {
      setError(err instanceof AdminServiceError ? err.message : 'Failed to load students')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadStudents()
  }, [showInactiveStudents])

  const resetWizard = () => {
    setName('')
    setSelectedFamilyId('')
    setSelectedClassId('')
    setFamilyMode('skip')
    setNewFamilyName('')
    setNewFamilyDescription('')
    setWizardStep('details')
    setWizardErrors({})
    setWizardResult(null)
  }

  const loadWizardOptions = async () => {
    try {
      setIsLoadingWizardOptions(true)
      const [families, classes] = await Promise.all([
        adminService.fetchFamilies(),
        adminService.fetchClasses(),
      ])
      setAvailableFamilies(families.filter((family) => family.isActive !== false))
      setAvailableClasses(classes.filter((item) => item.isActive !== false))
    } catch (err) {
      setNotification({
        message: err instanceof AdminServiceError ? err.message : '無法載入精靈選項',
        type: 'error',
      })
    } finally {
      setIsLoadingWizardOptions(false)
    }
  }

  const currentStepIndex = useMemo(() => {
    const order: WizardStep[] = ['details', 'family', 'class', 'review', 'done']
    return order.indexOf(wizardStep)
  }, [wizardStep])

  const validateCurrentStep = (): boolean => {
    if (wizardStep === 'details') {
      if (!name.trim()) {
        setWizardErrors({ name: '學生姓名為必填項' })
        return false
      }
    }

    if (wizardStep === 'family') {
      const nextErrors: {
        familySelection?: string
        familyName?: string
      } = {}

      if (familyMode === 'existing' && !selectedFamilyId) {
        nextErrors.familySelection = '請選擇既有家庭，或改為建立新家庭'
      }

      if (familyMode === 'create') {
        if (!newFamilyName.trim()) {
          nextErrors.familyName = '新家庭名稱為必填項'
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        setWizardErrors(nextErrors)
        return false
      }
    }

    setWizardErrors({})
    return true
  }

  const goToNextStep = () => {
    if (!validateCurrentStep()) return

    if (wizardStep === 'details') setWizardStep('family')
    else if (wizardStep === 'family') setWizardStep('class')
    else if (wizardStep === 'class') setWizardStep('review')
  }

  const goToPreviousStep = () => {
    if (wizardStep === 'family') setWizardStep('details')
    else if (wizardStep === 'class') setWizardStep('family')
    else if (wizardStep === 'review') setWizardStep('class')
  }

  const submitWizard = async () => {
    try {
      setIsSaving(true)
      const createdStudent = await adminService.createStudent(name)
      let resolvedFamilyId: string | null = null

      let familyLink: WizardStatus = { status: 'skipped', message: '已略過家庭連結' }
      let classAssign: WizardStatus = { status: 'skipped', message: '已略過班級分配' }

      if (familyMode === 'create') {
        try {
          const createdFamily = await adminService.createFamily(
            newFamilyName,
            newFamilyDescription,
            [],
          )
          resolvedFamilyId = createdFamily.id
          setSelectedFamilyId(createdFamily.id)
          setFamilyMode('existing')
          await adminService.addStudentToFamily(createdFamily.id, createdStudent.id)
          familyLink = { status: 'success', message: '已建立並連結新家庭' }
        } catch (err) {
          familyLink = {
            status: 'failed',
            message: err instanceof AdminServiceError ? err.message : '建立家庭失敗，可稍後重試',
          }
        }
      } else if (familyMode === 'existing' && selectedFamilyId) {
        try {
          await adminService.addStudentToFamily(selectedFamilyId, createdStudent.id)
          resolvedFamilyId = selectedFamilyId
          familyLink = { status: 'success', message: '已成功連結家庭' }
        } catch (err) {
          familyLink = {
            status: 'failed',
            message: err instanceof AdminServiceError ? err.message : '家庭連結失敗，可稍後重試',
          }
        }
      }

      if (selectedClassId && resolvedFamilyId) {
        try {
          await adminService.addStudentToClassEnrollment(
            selectedClassId,
            createdStudent.id,
            resolvedFamilyId
          )
          classAssign = { status: 'success', message: '已成功分配班級' }
        } catch (err) {
          classAssign = {
            status: 'failed',
            message: err instanceof AdminServiceError ? err.message : '班級分配失敗，可稍後重試',
          }
        }
      } else if (selectedClassId && !resolvedFamilyId) {
        classAssign = {
          status: 'skipped',
          message: '家庭尚未就緒，已暫緩班級分配',
        }
      }

      setWizardResult({
        createdStudent,
        familyLink,
        classAssign,
      })
      setWizardStep('done')
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

  const retryFamilyLink = async () => {
    if (!wizardResult) return
    try {
      setIsSaving(true)
      if (familyMode === 'create') {
        const createdFamily = await adminService.createFamily(
          newFamilyName,
          newFamilyDescription,
          [],
        )
        setSelectedFamilyId(createdFamily.id)
        setFamilyMode('existing')
        await adminService.addStudentToFamily(createdFamily.id, wizardResult.createdStudent.id)
      } else {
        if (!selectedFamilyId) return
        await adminService.addStudentToFamily(selectedFamilyId, wizardResult.createdStudent.id)
      }
      setWizardResult({
        ...wizardResult,
        familyLink: { status: 'success', message: '已成功重試家庭連結' },
      })
    } catch (err) {
      setWizardResult({
        ...wizardResult,
        familyLink: {
          status: 'failed',
          message: err instanceof AdminServiceError ? err.message : '家庭連結重試失敗',
        },
      })
    } finally {
      setIsSaving(false)
    }
  }

  const retryClassAssignment = async () => {
    if (!wizardResult || !selectedClassId || !selectedFamilyId) return
    try {
      setIsSaving(true)
      await adminService.addStudentToClassEnrollment(
        selectedClassId,
        wizardResult.createdStudent.id,
        selectedFamilyId
      )
      setWizardResult({
        ...wizardResult,
        classAssign: { status: 'success', message: '已成功重試班級分配' },
      })
    } catch (err) {
      setWizardResult({
        ...wizardResult,
        classAssign: {
          status: 'failed',
          message: err instanceof AdminServiceError ? err.message : '班級分配重試失敗',
        },
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
      await adminService.deactivateStudent(deleteConfirm.studentId)
      setNotification({ message: '學生已停用', type: 'success' })
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

  const handleActivate = async (studentId: string) => {
    try {
      setIsSaving(true)
      await adminService.activateStudent(studentId)
      setNotification({ message: '學生已啟用', type: 'success' })
      await loadStudents()
    } catch (err) {
      setNotification({
        message: err instanceof AdminServiceError ? err.message : 'Failed to activate student',
        type: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (pageState === 'create') {
    const selectedFamily = availableFamilies.find((item) => item.id === selectedFamilyId)
    const selectedClass = availableClasses.find((item) => item.id === selectedClassId)
    const canAssignClass = familyMode === 'existing' ? Boolean(selectedFamilyId) : familyMode === 'create'
    const familySummary = familyMode === 'existing'
      ? (selectedFamily?.name || '未選擇')
      : familyMode === 'create'
        ? `新家庭：${newFamilyName || '未命名'}`
        : '略過'

    return (
      <AdminLayout activeTab="students">
        <div className="space-y-6">
          <button
            onClick={() => {
              setPageState('list')
              resetWizard()
            }}
            className="group flex items-center text-waldorf-clay-500 hover:text-waldorf-peach-600 transition-all duration-300 font-medium"
          >
            <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回學生列表
          </button>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-waldorf-cream-200 p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold text-waldorf-clay-800">新增學生精靈</h2>
              <p className="text-sm text-waldorf-clay-600">
                步驟 {Math.max(currentStepIndex + 1, 1)} / 5
              </p>
            </div>

            {isLoadingWizardOptions ? (
              <p className="text-waldorf-clay-500">載入精靈選項中...</p>
            ) : (
              <>
                {wizardStep === 'details' && (
                  <label className="block">
                    <span className="block text-sm font-medium text-waldorf-clay-600 mb-2">學生姓名（必填）</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="學生姓名"
                      className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300"
                    />
                    {wizardErrors.name && (
                      <span className="text-sm text-waldorf-rose-700 mt-2 block">{wizardErrors.name}</span>
                    )}
                  </label>
                )}

                {wizardStep === 'family' && (
                  <div className="space-y-3">
                    <p className="text-sm text-waldorf-clay-600">選填：將學生連結到家庭</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFamilyMode('skip')
                          setSelectedFamilyId('')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs ${familyMode === 'skip' ? 'bg-waldorf-sage-100 text-waldorf-sage-700' : 'bg-waldorf-cream-100 text-waldorf-clay-700'}`}
                      >
                        略過
                      </button>
                      <button
                        type="button"
                        onClick={() => setFamilyMode('existing')}
                        className={`px-3 py-1.5 rounded-lg text-xs ${familyMode === 'existing' ? 'bg-waldorf-sage-100 text-waldorf-sage-700' : 'bg-waldorf-cream-100 text-waldorf-clay-700'}`}
                      >
                        使用既有家庭
                      </button>
                      <button
                        type="button"
                        onClick={() => setFamilyMode('create')}
                        className={`px-3 py-1.5 rounded-lg text-xs ${familyMode === 'create' ? 'bg-waldorf-sage-100 text-waldorf-sage-700' : 'bg-waldorf-cream-100 text-waldorf-clay-700'}`}
                      >
                        建立新家庭
                      </button>
                    </div>

                    {familyMode === 'existing' && (
                      <>
                        <select
                          value={selectedFamilyId}
                          onChange={(event) => setSelectedFamilyId(event.target.value)}
                          className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300"
                        >
                          <option value="">請選擇家庭</option>
                          {availableFamilies.map((family) => (
                            <option key={family.id} value={family.id}>
                              {family.name}
                            </option>
                          ))}
                        </select>
                        {wizardErrors.familySelection && (
                          <span className="text-sm text-waldorf-rose-700">{wizardErrors.familySelection}</span>
                        )}
                      </>
                    )}

                    {familyMode === 'create' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newFamilyName}
                          onChange={(event) => setNewFamilyName(event.target.value)}
                          placeholder="新家庭名稱"
                          className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300"
                        />
                        {wizardErrors.familyName && (
                          <span className="text-sm text-waldorf-rose-700">{wizardErrors.familyName}</span>
                        )}
                        <textarea
                          value={newFamilyDescription}
                          onChange={(event) => setNewFamilyDescription(event.target.value)}
                          placeholder="家庭描述（選填）"
                          className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300"
                        />
                      </div>
                    )}
                  </div>
                )}

                {wizardStep === 'class' && (
                  <div className="space-y-3">
                    <p className="text-sm text-waldorf-clay-600">
                      選填：指定初始班級
                    </p>
                    {!canAssignClass && (
                      <p className="text-sm text-waldorf-clay-500">
                        尚未建立家庭時，先建立學生即可，班級可於後續家庭建立後再設定。
                      </p>
                    )}
                    <select
                      value={selectedClassId}
                      onChange={(event) => setSelectedClassId(event.target.value)}
                      disabled={!canAssignClass}
                      className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300"
                    >
                      <option value="">
                        {canAssignClass ? '略過班級分配' : '請先選擇或建立家庭'}
                      </option>
                      {availableClasses.map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>
                          {classItem.name}
                        </option>
                      ))}
                    </select>
                    {wizardErrors.class && (
                      <span className="text-sm text-waldorf-rose-700 mt-2 block">{wizardErrors.class}</span>
                    )}
                  </div>
                )}

                {wizardStep === 'review' && (
                  <div className="space-y-3 text-sm text-waldorf-clay-700">
                    <p><strong>學生姓名：</strong>{name.trim()}</p>
                    <p><strong>家庭：</strong>{familySummary}</p>
                    <p><strong>班級：</strong>{selectedClass?.name || '略過'}</p>
                  </div>
                )}

                {wizardStep === 'done' && wizardResult && (
                  <div className="space-y-4 text-sm text-waldorf-clay-700">
                    <p><strong>學生已建立：</strong>{wizardResult.createdStudent.name}</p>

                    <div className="rounded-xl border border-waldorf-cream-200 p-4 space-y-2">
                      <p><strong>家庭連結：</strong>{wizardResult.familyLink.message}</p>
                      {wizardResult.familyLink.status === 'failed' && (familyMode === 'create' || Boolean(selectedFamilyId)) && (
                        <button
                          onClick={retryFamilyLink}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-waldorf-clay-100 text-waldorf-clay-700 text-xs rounded-lg hover:bg-waldorf-clay-200 disabled:opacity-50"
                        >
                          重試家庭連結
                        </button>
                      )}
                    </div>

                    <div className="rounded-xl border border-waldorf-cream-200 p-4 space-y-2">
                      <p><strong>班級分配：</strong>{wizardResult.classAssign.message}</p>
                      {wizardResult.classAssign.status === 'failed' && selectedClassId && selectedFamilyId && (
                        <button
                          onClick={retryClassAssignment}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-waldorf-clay-100 text-waldorf-clay-700 text-xs rounded-lg hover:bg-waldorf-clay-200 disabled:opacity-50"
                        >
                          重試班級分配
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between">
              <button
                onClick={goToPreviousStep}
                disabled={wizardStep === 'details' || wizardStep === 'done' || isSaving}
                className="px-4 py-2 border border-waldorf-cream-300 rounded-lg text-waldorf-clay-700 disabled:opacity-40"
              >
                上一步
              </button>

              <div className="space-x-2">
                {wizardStep !== 'done' && (
                  <button
                    onClick={goToNextStep}
                    disabled={wizardStep === 'review' || isSaving}
                    className="px-4 py-2 border border-waldorf-cream-300 rounded-lg text-waldorf-clay-700 disabled:opacity-40"
                  >
                    下一步
                  </button>
                )}

                {wizardStep === 'review' && (
                  <button
                    onClick={submitWizard}
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 text-white rounded-xl disabled:opacity-50"
                  >
                    {isSaving ? '建立中...' : '確認建立'}
                  </button>
                )}

                {wizardStep === 'done' && (
                  <button
                    onClick={() => {
                      setNotification({ message: '學生建立流程完成', type: 'success' })
                      setPageState('list')
                      resetWizard()
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 text-white rounded-xl"
                  >
                    完成
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (pageState === 'edit' && editingStudent) {
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
              編輯學生
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
                onClick={handleUpdate}
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
            resetWizard()
            void loadWizardOptions()
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
        <label className="inline-flex items-center gap-2 text-sm text-waldorf-clay-700">
          <input
            type="checkbox"
            checked={showInactiveStudents}
            onChange={(event) => setShowInactiveStudents(event.target.checked)}
            className="rounded border-waldorf-cream-300 text-waldorf-sage-600 focus:ring-waldorf-sage-300"
          />
          顯示停用學生
        </label>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-waldorf-clay-600 uppercase">狀態</th>
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
                    <td className="px-4 py-3 text-sm text-waldorf-clay-700">
                      {student.status === 'active' ? '啟用中' : '已停用'}
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
                      {student.status === 'active' ? (
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, studentId: student.id })}
                          className="px-3 py-1.5 bg-waldorf-rose-100 text-waldorf-rose-700 text-xs rounded-lg hover:bg-waldorf-rose-200"
                        >
                          停用
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(student.id)}
                          className="px-3 py-1.5 bg-waldorf-sage-100 text-waldorf-sage-700 text-xs rounded-lg hover:bg-waldorf-sage-200"
                        >
                          啟用
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title="停用學生"
          message="確定要停用這位學生嗎？停用後可再啟用，歷史關聯會保留。"
          confirmText="停用"
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
