import React from 'react'
import { AuditLogEntry } from '@/types/admin'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface AuditLogProps {
  logs: AuditLogEntry[]
  isLoading: boolean
  error: string | null
}

export const AuditLog: React.FC<AuditLogProps> = ({ logs, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    )
  }

  return (
    <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-waldorf-peach-100 mb-4">
        <svg className="h-6 w-6 text-waldorf-peach-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900">Feature is coming</h3>
      <p className="mt-1 text-sm text-gray-500">Operation logs tracking will be available in a future update.</p>
    </div>
  )
}
