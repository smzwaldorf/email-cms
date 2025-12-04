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
    <div className="bg-white rounded-lg shadow p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">建立新電子報</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="weekNumber" className="block text-sm font-medium text-gray-700 mb-1">
            週次 (Week Number) <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="weekNumber"
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              placeholder="2025-W48"
              required
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSetNextWeek}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              自動填寫下週
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">格式: YYYY-Www</p>
        </div>

        <div>
          <label htmlFor="releaseDate" className="block text-sm font-medium text-gray-700 mb-1">
            預計發布日期 (Release Date) <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="releaseDate"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>



        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {isSubmitting ? '建立中...' : '建立電子報'}
          </button>
        </div>
      </form>
    </div>
  )
}
