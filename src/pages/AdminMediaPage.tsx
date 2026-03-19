import { AdminLayout } from '@/components/admin/AdminLayout'
import { MediaDashboard } from '@/components/MediaDashboard'

export function AdminMediaPage() {
  return (
    <AdminLayout activeTab="media">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-waldorf-clay-800">Media Management</h2>
          <p className="mt-1 text-sm text-waldorf-clay-500">
            Review media usage and safely delete unused assets.
          </p>
        </div>
        <MediaDashboard />
      </div>
    </AdminLayout>
  )
}

export default AdminMediaPage
