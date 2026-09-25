import { AdminLayout } from '@/components/admin/AdminLayout'
import { MediaDashboard } from '@/components/MediaDashboard'

export function AdminMediaPage() {
  return (
    <AdminLayout activeTab="media">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-waldorf-clay-800">媒體管理</h2>
          <p className="mt-1 text-sm text-waldorf-clay-500">
            檢查媒體使用情況，並安全刪除未使用的檔案。
          </p>
        </div>
        <MediaDashboard />
      </div>
    </AdminLayout>
  )
}

export default AdminMediaPage
