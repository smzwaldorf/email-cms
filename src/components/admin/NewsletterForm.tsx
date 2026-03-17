import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService, AdminServiceError } from '@/services/adminService'
import type { AdminNewsletter } from '@/types/admin'
import { getAdminNewsletterPath } from '@/utils/adminNewsletterRoutes'

interface NewsletterFormProps {
  mode?: 'create' | 'edit'
  newsletter?: AdminNewsletter | null
  onCancel?: () => void
  onSuccess?: (newsletter: AdminNewsletter) => void
  initialTemplateId?: string | null
}

export function NewsletterForm({
  mode = 'create',
  newsletter = null,
  onCancel,
  onSuccess,
  initialTemplateId = null,
}: NewsletterFormProps) {
  const navigate = useNavigate()
  const [weekNumber, setWeekNumber] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [releaseDate, setReleaseDate] = useState('')
  const [templateId, setTemplateId] = useState(initialTemplateId || '')
  const [availableTemplates, setAvailableTemplates] = useState<AdminNewsletter[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!newsletter) return

    setWeekNumber(newsletter.weekNumber || '')
    setTitle(newsletter.title || '')
    setDescription(newsletter.description || '')
    setReleaseDate(newsletter.releaseDate || '')
  }, [newsletter])

  useEffect(() => {
    if (mode !== 'create') return

    const loadTemplates = async () => {
      try {
        setIsLoadingTemplates(true)
        const templates = await adminService.fetchNewsletters()
        setAvailableTemplates(templates)
      } catch (err) {
        console.error('Failed to load newsletter templates:', err)
      } finally {
        setIsLoadingTemplates(false)
      }
    }

    loadTemplates()
  }, [mode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Validate week number format if provided
      if (weekNumber && !weekNumber.match(/^\d{4}-W\d{2}$/)) {
        throw new Error('週次格式錯誤，應為 YYYY-Www (例如: 2025-W48)')
      }

      const metadata = {
        title,
        description,
      }

      let savedNewsletter: AdminNewsletter
      if (mode === 'edit' && newsletter?.id) {
        savedNewsletter = await adminService.updateNewsletter(newsletter.id, {
          weekNumber: weekNumber || null,
          title,
          description,
          releaseDate,
        })
      } else if (templateId) {
        savedNewsletter = await adminService.createNewsletterFromTemplate(templateId, {
          weekNumber: weekNumber || null,
          title,
          description,
          releaseDate,
        })
      } else {
        savedNewsletter = await adminService.createNewsletter(
          weekNumber || null,
          releaseDate,
          metadata
        )
      }

      if (onSuccess) {
        onSuccess(savedNewsletter)
      } else {
        navigate(getAdminNewsletterPath(savedNewsletter))
      }
    } catch (err) {
      const message = err instanceof AdminServiceError
        ? err.message
        : err instanceof Error
          ? err.message
          : '建立失敗'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Set default week number to next week
  const handleSetNextWeek = () => {
    const today = new Date()
    const year = today.getFullYear()
    // Simple approximation, for production use a library like date-fns
    const week = Math.ceil((today.getDate() - 1 - today.getDay()) / 7) + 1
    setWeekNumber(`${year}-W${String(week + 1).padStart(2, '0')}`)
    
    // Set release date to next Sunday
    const nextSunday = new Date(today)
    nextSunday.setDate(today.getDate() + (7 - today.getDay()))
    setReleaseDate(nextSunday.toISOString().split('T')[0])
  }

  const heading = mode === 'edit' ? '編輯電子報' : '建立新電子報'
  const descriptionText = mode === 'edit'
    ? '更新草稿電子報的週次、標題與發布資訊'
    : '輸入週次、標題和發布日期以建立新的電子報'
  const submitLabel = mode === 'edit' ? '儲存電子報' : '建立電子報'

  return (
    <div className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-xl shadow-waldorf-clay-200/20 p-8 border border-waldorf-cream-200/50 animate-fade-in-up">
      <h2 className="text-3xl font-display font-bold mb-2 text-waldorf-clay-800 tracking-tight">{heading}</h2>
      <p className="text-waldorf-clay-500 mb-8 font-medium">{descriptionText}</p>

      {error && (
        <div className="mb-6 p-4 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-xl text-waldorf-rose-700 font-medium animate-fade-in">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {mode === 'create' && (
          <div className="animate-fade-in-up">
            <label htmlFor="templateId" className="block text-sm font-semibold text-waldorf-clay-700 mb-2">
              從既有電子報開始 (可選)
            </label>
            <select
              id="templateId"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 text-waldorf-clay-700 transition-all duration-200"
              data-testid="template-select"
            >
              <option value="">空白草稿</option>
              {availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.weekNumber || template.title || template.id} · {template.status}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-waldorf-clay-500 font-medium">
              {isLoadingTemplates ? '載入模板中...' : '可選擇上一期電子報作為模板，系統會建立新的草稿內容。'}
            </p>
          </div>
        )}

        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <label htmlFor="weekNumber" className="block text-sm font-semibold text-waldorf-clay-700 mb-2">
            週次 (Week Number)
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              id="weekNumber"
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              placeholder="2025-W48"
              className="flex-1 px-4 py-3 border border-waldorf-cream-300 rounded-xl bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 text-waldorf-clay-700 placeholder-waldorf-clay-400 transition-all duration-200"
            />
            <button
              type="button"
              onClick={handleSetNextWeek}
              className="px-4 py-3 bg-waldorf-peach-100 text-waldorf-peach-700 rounded-xl hover:bg-waldorf-peach-200 text-sm font-medium transition-all duration-200 whitespace-nowrap"
            >
              自動填寫下週
            </button>
          </div>
          <p className="mt-2 text-xs text-waldorf-clay-500 font-medium">格式: YYYY-Www (例如: 2025-W48) · 選填</p>
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <label htmlFor="title" className="block text-sm font-semibold text-waldorf-clay-700 mb-2">
            標題 (Title)
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="本週電子報"
            className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 text-waldorf-clay-700 placeholder-waldorf-clay-400 transition-all duration-200"
          />
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '0.18s' }}>
          <label htmlFor="description" className="block text-sm font-semibold text-waldorf-clay-700 mb-2">
            摘要 (Description)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="簡短描述本期電子報內容"
            className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 text-waldorf-clay-700 placeholder-waldorf-clay-400 transition-all duration-200"
          />
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <label htmlFor="releaseDate" className="block text-sm font-semibold text-waldorf-clay-700 mb-2">
            預計發布日期 (Release Date) <span className="text-waldorf-rose-500">*</span>
          </label>
          <input
            type="date"
            id="releaseDate"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            required
            className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 text-waldorf-clay-700 transition-all duration-200"
          />
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-waldorf-cream-200/50 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <button
            type="button"
            onClick={() => onCancel ? onCancel() : navigate('/admin')}
            className="px-6 py-2.5 text-waldorf-clay-700 bg-waldorf-cream-100 border border-waldorf-cream-300 rounded-xl hover:bg-waldorf-cream-200 font-medium transition-all duration-200"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-white bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 hover:from-waldorf-sage-600 hover:to-waldorf-sage-700 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-waldorf-sage-200/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            {isSubmitting ? '儲存中...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
