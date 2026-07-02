import type { AdminUser } from '@/types/admin'

export interface TeacherListProps {
  teachers: AdminUser[]
  isLoading?: boolean
  error?: string | null
  onEdit?: (teacher: AdminUser) => void
  onActivate?: (teacherId: string) => void
  onDeactivate?: (teacherId: string) => void
}

export function TeacherList({
  teachers,
  isLoading = false,
  error = null,
  onEdit,
  onActivate,
  onDeactivate,
}: TeacherListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 rounded-full border-4 border-waldorf-cream-200 border-t-waldorf-sage-500 animate-spin"></div>
        <span className="mt-4 text-waldorf-clay-500 font-medium">載入教師中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl">
        <p className="text-waldorf-rose-800 font-semibold">錯誤</p>
        <p className="text-waldorf-rose-600 text-sm mt-1">{error}</p>
      </div>
    )
  }

  if (!teachers.length) {
    return (
      <div className="text-center py-14 text-waldorf-clay-500">
        尚無教師資料，請先新增教師。
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-waldorf-cream-200 shadow-sm">
      <table className="w-full">
        <thead className="bg-gradient-to-r from-waldorf-cream-100 to-waldorf-cream-50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">姓名</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">Email</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">狀態</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-waldorf-cream-100">
          {teachers.map((teacher) => {
            const isDisabled = teacher.status === 'disabled'
            return (
              <tr key={teacher.id} className="hover:bg-waldorf-cream-50/50 transition-colors duration-200">
                <td className="px-6 py-4 text-sm font-medium text-waldorf-clay-800">{teacher.name || '-'}</td>
                <td className="px-6 py-4 text-sm text-waldorf-clay-600">{teacher.email}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isDisabled
                        ? 'bg-waldorf-clay-100 text-waldorf-clay-700'
                        : 'bg-waldorf-sage-100 text-waldorf-sage-700'
                    }`}
                  >
                    {isDisabled ? '停用' : '啟用'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit?.(teacher)}
                      className="px-3 py-1.5 bg-waldorf-clay-100 text-waldorf-clay-700 text-xs font-medium rounded-lg hover:bg-waldorf-clay-200 transition-all duration-200 disabled:opacity-50"
                      data-testid={`edit-teacher-btn-${teacher.id}`}
                      disabled={!onEdit}
                    >
                      編輯
                    </button>
                    {isDisabled ? (
                      <button
                        onClick={() => onActivate?.(teacher.id)}
                        className="px-3 py-1.5 bg-waldorf-sage-100 text-waldorf-sage-700 text-xs font-medium rounded-lg hover:bg-waldorf-sage-200 transition-all duration-200 disabled:opacity-50"
                        data-testid={`activate-teacher-btn-${teacher.id}`}
                        disabled={!onActivate}
                      >
                        啟用
                      </button>
                    ) : (
                      <button
                        onClick={() => onDeactivate?.(teacher.id)}
                        className="px-3 py-1.5 bg-waldorf-rose-100 text-waldorf-rose-700 text-xs font-medium rounded-lg hover:bg-waldorf-rose-200 transition-all duration-200 disabled:opacity-50"
                        data-testid={`deactivate-teacher-btn-${teacher.id}`}
                        disabled={!onDeactivate}
                      >
                        停用
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default TeacherList
