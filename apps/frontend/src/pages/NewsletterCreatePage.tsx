import { useSearchParams } from 'react-router-dom'
import { NewsletterForm } from '@/components/admin/NewsletterForm'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { NewsletterWorkflowSteps } from '@/components/admin/NewsletterWorkflowSteps'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const NEXT_STEPS = [
  { title: '編排文章', body: '建立後會直接進入文章編排頁，可加入既有文章或新建草稿並調整順序。' },
  { title: '預覽郵件', body: '選擇一個實際家庭，檢視個人化後的郵件主旨與內容。' },
  { title: '發布寄送', body: '確認投遞對象與資格檢查後，一鍵發布並建立寄送批次。' },
]

export function NewsletterCreatePage() {
  const [searchParams] = useSearchParams()
  const sourceNewsletterId = searchParams.get('sourceNewsletter')
  const isTemplateCreation = sourceNewsletterId !== null
  const templateId = searchParams.get('template')

  return (
    <ErrorBoundary>
      <AdminLayout
        activeTab={isTemplateCreation ? 'templates' : 'newsletters'}
        contentVariant="plain"
        title={isTemplateCreation ? '建立電子報模板' : '建立新電子報'}
        description={
          isTemplateCreation
            ? '把既有電子報的文章結構存成可重複使用的模板。'
            : '第一步：設定週次、標題與發布日期，接著就能編排文章。'
        }
        backLink={{
          to: isTemplateCreation ? '/admin/templates' : '/admin',
          label: isTemplateCreation ? '返回模板列表' : '返回電子報列表',
        }}
      >
        <div className="space-y-6">
          {!isTemplateCreation && <NewsletterWorkflowSteps current="create" />}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <NewsletterForm
              mode={isTemplateCreation ? 'create-template' : 'create'}
              initialTemplateId={templateId}
              initialSourceNewsletterId={sourceNewsletterId}
            />

            {!isTemplateCreation && (
              <aside className="self-start rounded-2xl border border-waldorf-cream-200 bg-white/60 backdrop-blur-sm p-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-waldorf-clay-400">接下來</p>
                <ol className="mt-4 space-y-4">
                  {NEXT_STEPS.map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-waldorf-cream-100 text-xs font-semibold text-waldorf-clay-500">
                        {index + 2}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-waldorf-clay-700">{step.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-waldorf-clay-500">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 border-t border-waldorf-cream-200 pt-4 text-xs leading-relaxed text-waldorf-clay-500">
                  小提示：從模板建立可直接沿用上一期的文章結構，只需替換內容。
                </p>
              </aside>
            )}
          </div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  )
}
