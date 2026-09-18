import { Link } from 'react-router-dom'
import type { NewsletterStatus } from '@/types/admin'
import { getAdminNewsletterPath } from '@/utils/adminNewsletterRoutes'

export type NewsletterWorkflowStep = 'create' | 'compose' | 'preview' | 'publish'

export const NEWSLETTER_WORKFLOW_STEPS: NewsletterWorkflowStep[] = ['create', 'compose', 'preview', 'publish']

interface WorkflowNewsletter {
  id: string
  weekNumber?: string | null
  status?: NewsletterStatus
}

interface NewsletterWorkflowStepsProps {
  current: NewsletterWorkflowStep
  /** When provided, completed/upcoming steps become links into that newsletter's pages. */
  newsletter?: WorkflowNewsletter | null
  className?: string
}

const STEP_COPY: Record<NewsletterWorkflowStep, { label: string; hint: string }> = {
  create: { label: '建立電子報', hint: '週次、標題與發布日期' },
  compose: { label: '編排文章', hint: '加入、排序與班級投遞' },
  preview: { label: '預覽郵件', hint: '以實際家庭檢視寄送內容' },
  publish: { label: '發布寄送', hint: '確認投遞對象後寄出' },
}

export function getNewsletterPreviewPath(newsletterId: string): string {
  return `/admin/newsletters/preview?newsletter=${encodeURIComponent(newsletterId)}`
}

function stepPath(step: NewsletterWorkflowStep, newsletter: WorkflowNewsletter): string | null {
  switch (step) {
    case 'compose':
    case 'publish':
      return getAdminNewsletterPath(newsletter)
    case 'preview':
      return getNewsletterPreviewPath(newsletter.id)
    default:
      return null
  }
}

/**
 * Horizontal progress indicator for the newsletter publishing workflow:
 * create → compose articles → preview email → publish & deliver.
 */
export function NewsletterWorkflowSteps({ current, newsletter = null, className = '' }: NewsletterWorkflowStepsProps) {
  const currentIndex = NEWSLETTER_WORKFLOW_STEPS.indexOf(current)
  const isDelivered = newsletter?.status === 'published' || newsletter?.status === 'archived'

  return (
    <nav aria-label="電子報流程" className={className}>
      <ol className="flex flex-wrap items-stretch gap-y-3 rounded-2xl border border-waldorf-cream-200 bg-white/70 backdrop-blur-sm px-4 py-3 sm:px-6">
        {NEWSLETTER_WORKFLOW_STEPS.map((step, index) => {
          const isCurrent = step === current
          const isComplete = isDelivered ? !isCurrent : index < currentIndex
          const to = newsletter && !isCurrent ? stepPath(step, newsletter) : null
          const copy = STEP_COPY[step]

          const circleClass = isCurrent
            ? 'bg-gradient-to-br from-waldorf-peach-500 to-waldorf-peach-600 text-white shadow-md shadow-waldorf-peach-200/60 ring-4 ring-waldorf-peach-100'
            : isComplete
              ? 'bg-waldorf-sage-500 text-white'
              : 'bg-waldorf-cream-100 text-waldorf-clay-400 border border-waldorf-cream-300'

          const content = (
            <>
              <span
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all ${circleClass}`}
                aria-hidden="true"
              >
                {isComplete ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-semibold leading-tight ${
                    isCurrent ? 'text-waldorf-clay-800' : isComplete ? 'text-waldorf-sage-700' : 'text-waldorf-clay-500'
                  }`}
                >
                  {copy.label}
                </span>
                <span className="hidden md:block text-xs text-waldorf-clay-400 leading-tight mt-0.5">{copy.hint}</span>
              </span>
            </>
          )

          return (
            <li key={step} className="flex flex-1 min-w-[140px] items-center" aria-current={isCurrent ? 'step' : undefined}>
              {to ? (
                <Link
                  to={to}
                  className="group flex items-center gap-3 rounded-xl px-2 py-1 -mx-2 hover:bg-waldorf-cream-100/80 transition-colors"
                  title={`前往${copy.label}`}
                >
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-2 py-1 -mx-2">{content}</div>
              )}
              {index < NEWSLETTER_WORKFLOW_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`mx-3 hidden sm:block h-px flex-1 ${isComplete ? 'bg-waldorf-sage-300' : 'bg-waldorf-cream-300'}`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default NewsletterWorkflowSteps
