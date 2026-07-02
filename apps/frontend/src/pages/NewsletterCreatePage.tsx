import { useSearchParams } from 'react-router-dom'
import { NewsletterForm } from '@/components/admin/NewsletterForm'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function NewsletterCreatePage() {
  const [searchParams] = useSearchParams()
  const sourceNewsletterId = searchParams.get('sourceNewsletter')
  const isTemplateCreation = sourceNewsletterId !== null
  const templateId = searchParams.get('template')

  return (
    <ErrorBoundary>
      <AdminLayout activeTab={isTemplateCreation ? 'templates' : 'newsletters'}>
        <div className="space-y-6">
          <NewsletterForm
            mode={isTemplateCreation ? 'create-template' : 'create'}
            initialTemplateId={templateId}
            initialSourceNewsletterId={sourceNewsletterId}
          />

          {/* Decorative footer accent */}
          <div className="h-1 w-24 bg-gradient-to-r from-waldorf-peach-400 to-waldorf-sage-400 rounded-full mx-auto opacity-60 animate-fade-in" style={{ animationDelay: '0.3s' }}></div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}
