/**
 * Week Selector Component
 * Dropdown to select and navigate between available newsletter weeks
 */

import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFetchAllWeeks } from '@/hooks/useFetchAllWeeks'
import { formatWeekNumber } from '@/utils/formatters'

export const WeekSelector: React.FC = () => {
  const navigate = useNavigate()
  const { weekNumber: paramWeekNumber } = useParams<{ weekNumber: string }>()
  const currentWeekNumber = paramWeekNumber || '2025-W47'
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { weeks, isLoading, error } = useFetchAllWeeks({
    publishedOnly: true,
    limit: 50,
    sortOrder: 'desc',
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleWeekSelect = (weekNumber: string) => {
    if (weekNumber !== currentWeekNumber) {
      navigate(`/week/${weekNumber}`)
    }
    setIsOpen(false)
  }

  const selectedWeek = weeks.find((w) => w.week_number === currentWeekNumber)
  const displayLabel = selectedWeek ? formatWeekNumber(selectedWeek.week_number) : currentWeekNumber

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || weeks.length === 0}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
          ${
            isLoading
              ? 'bg-waldorf-cream-100 text-waldorf-clay-400 cursor-not-allowed'
              : 'bg-waldorf-peach-100 text-waldorf-clay-800 hover:bg-waldorf-peach-200 active:bg-waldorf-peach-300'
          }
        `}
      >
        <span className="text-sm">{displayLabel}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />

          {/* Menu Content */}
          <div
            className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg z-40 border border-waldorf-cream-200 overflow-hidden"
            style={{ maxHeight: '400px', overflowY: 'auto' }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-waldorf-cream-200 bg-waldorf-cream-50 sticky top-0">
              <p className="text-sm font-semibold text-waldorf-clay-800">選擇週數</p>
              {error && (
                <p className="text-xs text-red-600 mt-1">載入失敗，請重試</p>
              )}
            </div>

            {/* Week List */}
            {isLoading ? (
              <div className="px-4 py-8 text-center text-waldorf-clay-600">
                <p className="text-sm">載入中...</p>
              </div>
            ) : weeks.length === 0 ? (
              <div className="px-4 py-8 text-center text-waldorf-clay-600">
                <p className="text-sm">沒有可用的週數</p>
              </div>
            ) : (
              <div className="py-2">
                {weeks.map((week) => (
                  <button
                    key={week.week_number}
                    onClick={() => handleWeekSelect(week.week_number)}
                    className={`
                      w-full text-left px-4 py-2.5 text-sm transition-colors duration-150
                      ${
                        week.week_number === currentWeekNumber
                          ? 'bg-waldorf-peach-100 text-waldorf-clay-900 font-semibold'
                          : 'text-waldorf-clay-700 hover:bg-waldorf-cream-100'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span>{formatWeekNumber(week.week_number)}</span>
                      {week.week_number === currentWeekNumber && (
                        <svg className="w-4 h-4 text-waldorf-peach-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-waldorf-clay-500 mt-0.5">
                      {new Date(week.release_date).toLocaleDateString('zh-TW', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
