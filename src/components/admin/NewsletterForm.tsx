import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService, AdminServiceError } from '@/services/adminService'

export function NewsletterForm() {
  const navigate = useNavigate()
  const [weekNumber, setWeekNumber] = useState('')
  const [releaseDate, setReleaseDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Basic validation
      if (!weekNumber.match(/^\d{4}-W\d{2}$/)) {
        throw new Error('週次格式錯誤，應為 YYYY-Www (例如: 2025-W48)')
      }

      await adminService.createNewsletter(weekNumber, releaseDate)
      navigate('/admin')
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

  return (
    <div className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-xl shadow-waldorf-clay-200/20 p-8 border border-waldorf-cream-200/50 animate-fade-in-up">
      <h2 className="text-3xl font-display font-bold mb-2 text-waldorf-clay-800 tracking-tight">建立新電子報</h2>
      <p className="text-waldorf-clay-500 mb-8 font-medium">輸入週次和發布日期以建立新的電子報</p>

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
        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <label htmlFor="weekNumber" className="block text-sm font-semibold text-waldorf-clay-700 mb-2">
            週次 (Week Number) <span className="text-waldorf-rose-500">*</span>
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              id="weekNumber"
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              placeholder="2025-W48"
              required
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
          <p className="mt-2 text-xs text-waldorf-clay-500 font-medium">格式: YYYY-Www (例如: 2025-W48)</p>
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
            onClick={() => navigate('/admin')}
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
            {isSubmitting ? '建立中...' : '建立電子報'}
          </button>
        </div>
      </form>
    </div>
  )
}
