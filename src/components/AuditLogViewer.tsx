/**
 * Audit Log Viewer Component
 * Displays authentication audit events with filtering and export capabilities.
 *
 * Features:
 * - View all authentication events in a paginated table
 * - Filter by auth method (Google OAuth, Magic Link, Email/Password)
 * - Filter by event type (login, logout, OAuth, magic links, etc.)
 * - Filter by time range (1d, 7d, 30d, 90d)
 * - Export audit logs to CSV
 * - Display user agent and metadata for each event
 */

import React, { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

export type AuthEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'oauth_google_start'
  | 'oauth_google_success'
  | 'oauth_google_failure'
  | 'magic_link_sent'
  | 'magic_link_verified'
  | 'magic_link_expired'
  | 'token_refresh_success'
  | 'token_refresh_failure'
  | 'session_expired'

export type AuthMethod = 'google_oauth' | 'magic_link' | 'email_password'

/**
 * Audit event record from database
 */
interface AuditEvent {
  id: string
  user_id: string | null
  event_type: AuthEventType
  auth_method: AuthMethod | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, any> | null
  created_at: string
}

/**
 * Event type display information
 */
const EVENT_TYPE_INFO: Record<AuthEventType, { label: string; color: string }> = {
  login_success: { label: 'Login Success', color: 'green' },
  login_failure: { label: 'Login Failure', color: 'red' },
  logout: { label: 'Logout', color: 'gray' },
  oauth_google_start: { label: 'OAuth Start', color: 'blue' },
  oauth_google_success: { label: 'OAuth Success', color: 'green' },
  oauth_google_failure: { label: 'OAuth Failure', color: 'red' },
  magic_link_sent: { label: 'Magic Link Sent', color: 'blue' },
  magic_link_verified: { label: 'Magic Link Verified', color: 'green' },
  magic_link_expired: { label: 'Magic Link Expired', color: 'orange' },
  token_refresh_success: { label: 'Token Refresh Success', color: 'green' },
  token_refresh_failure: { label: 'Token Refresh Failure', color: 'red' },
  session_expired: { label: 'Session Expired', color: 'orange' },
}

const AUTH_METHOD_INFO: Record<AuthMethod, string> = {
  google_oauth: 'Google OAuth',
  magic_link: 'Magic Link',
  email_password: 'Email/Password',
}

/**
 * Format a date for display
 */
const formatDate = (isoString: string): string => {
  const date = new Date(isoString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Get days ago date
 */
const getDaysAgoDate = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

/**
 * Audit Log Viewer Component
 */
export const AuditLogViewer: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [filterMethod, setFilterMethod] = useState<AuthMethod | 'all'>('all')
  const [filterEventType, setFilterEventType] = useState<AuthEventType | 'all'>('all')
  const [filterDays, setFilterDays] = useState<number>(7)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const eventsPerPage = 25

  // Expanded metadata
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  /**
   * Fetch audit events with current filters
   */
  const fetchAuditLogs = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const supabase = getSupabaseClient()

      // Build query
      let query = supabase
        .from('auth_events')
        .select('*')
        .gte('created_at', getDaysAgoDate(filterDays))
        .order('created_at', { ascending: false })
        .limit(500) // Limit for performance

      // Apply filters
      if (filterMethod !== 'all') {
        query = query.eq('auth_method', filterMethod)
      }

      if (filterEventType !== 'all') {
        query = query.eq('event_type', filterEventType)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        throw new Error(queryError.message)
      }

      setEvents((data as AuditEvent[]) || [])
      setCurrentPage(1) // Reset to first page on filter change
    } catch (err: any) {
      console.error('Error fetching audit logs:', err)
      setError(err.message || 'Failed to load audit logs')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch logs on mount and when filters change
  useEffect(() => {
    fetchAuditLogs()
  }, [filterMethod, filterEventType, filterDays])

  /**
   * Export events to CSV
   */
  const handleExportCSV = () => {
    if (events.length === 0) {
      alert('No events to export')
      return
    }

    // Prepare CSV data
    const headers = ['Timestamp', 'User ID', 'Event Type', 'Auth Method', 'User Agent', 'Metadata']
    const rows = events.map((event) => [
      formatDate(event.created_at),
      event.user_id || '(unauthenticated)',
      event.event_type,
      event.auth_method || '-',
      event.user_agent || '-',
      event.metadata ? JSON.stringify(event.metadata) : '-',
    ])

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Pagination
  const totalPages = Math.ceil(events.length / eventsPerPage)
  const startIndex = (currentPage - 1) * eventsPerPage
  const paginatedEvents = events.slice(startIndex, startIndex + eventsPerPage)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
            <select
              value={filterDays}
              onChange={(e) => setFilterDays(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-peach-500"
            >
              <option value={1}>Last 1 day</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>

          {/* Auth Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Auth Method</label>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value as AuthMethod | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-peach-500"
            >
              <option value="all">All Methods</option>
              <option value="google_oauth">Google OAuth</option>
              <option value="magic_link">Magic Link</option>
              <option value="email_password">Email/Password</option>
            </select>
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value as AuthEventType | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-waldorf-peach-500"
            >
              <option value="all">All Events</option>
              <option value="login_success">Login Success</option>
              <option value="login_failure">Login Failure</option>
              <option value="logout">Logout</option>
              <option value="oauth_google_start">OAuth Start</option>
              <option value="oauth_google_success">OAuth Success</option>
              <option value="oauth_google_failure">OAuth Failure</option>
              <option value="magic_link_sent">Magic Link Sent</option>
              <option value="magic_link_verified">Magic Link Verified</option>
              <option value="magic_link_expired">Magic Link Expired</option>
            </select>
          </div>
        </div>

        {/* Export Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleExportCSV}
            disabled={events.length === 0 || isLoading}
            className="px-4 py-2 bg-waldorf-peach-500 text-white rounded-md hover:bg-opacity-90 disabled:opacity-50 transition-colors"
          >
            📥 Export to CSV
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-waldorf-peach-500 border-t-transparent"></div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* No Data */}
      {!isLoading && !error && events.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No authentication events found for the selected filters.
        </div>
      )}

      {/* Events Table */}
      {!isLoading && !error && events.length > 0 && (
        <div>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(startIndex + eventsPerPage, events.length)} of {events.length} events
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedEvents.map((event) => {
                    const isExpanded = expandedEventId === event.id
                    const eventInfo = EVENT_TYPE_INFO[event.event_type]

                    return (
                      <React.Fragment key={event.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(event.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {event.user_id ? event.user_id.substring(0, 8) : '(unauthenticated)'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                              ${eventInfo.color === 'green' ? 'bg-green-100 text-green-800' : ''}
                              ${eventInfo.color === 'red' ? 'bg-red-100 text-red-800' : ''}
                              ${eventInfo.color === 'blue' ? 'bg-blue-100 text-blue-800' : ''}
                              ${eventInfo.color === 'gray' ? 'bg-gray-100 text-gray-800' : ''}
                              ${eventInfo.color === 'orange' ? 'bg-orange-100 text-orange-800' : ''}`}
                            >
                              {eventInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {event.auth_method ? AUTH_METHOD_INFO[event.auth_method] : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="max-w-xs truncate" title={event.user_agent || ''}>
                              {event.user_agent ? event.user_agent.substring(0, 40) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <button
                                onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                                className="text-waldorf-peach-500 hover:text-waldorf-peach-700 font-medium"
                              >
                                {isExpanded ? '▼' : '▶'} View
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Expanded Metadata Row */}
                        {isExpanded && event.metadata && (
                          <tr className="bg-gray-50">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="bg-white border border-gray-200 rounded p-4">
                                <p className="text-sm font-medium text-gray-900 mb-2">Additional Info:</p>
                                <pre className="text-xs text-gray-600 overflow-auto max-h-32 bg-gray-50 p-2 rounded">
                                  {JSON.stringify(event.metadata, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Previous
                </button>

                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
