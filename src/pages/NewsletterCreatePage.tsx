import { useSearchParams } from 'react-router-dom'
import { NewsletterForm } from '@/components/admin/NewsletterForm'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function NewsletterCreatePage() {
  const [searchParams] = useSearchParams()

  return (
    <ErrorBoundary>
      <AdminLayout activeTab="newsletters">
        <div className="space-y-6">
          <NewsletterForm initialTemplateId={searchParams.get('template')} />

          {/* Decorative footer accent */}
          <div className="h-1 w-24 bg-gradient-to-r from-waldorf-peach-400 to-waldorf-sage-400 rounded-full mx-auto opacity-60 animate-fade-in" style={{ animationDelay: '0.3s' }}></div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}
