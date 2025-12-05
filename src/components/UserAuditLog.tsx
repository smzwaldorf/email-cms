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
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl border border-waldorf-cream-200 shadow-sm">
        <h3 className="text-lg font-display font-semibold text-waldorf-clay-800 mb-4">Filters</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Time Range */}
          <div>
            <label className="block text-sm font-semibold text-waldorf-clay-700 mb-2">Time Range</label>
            <select
              value={filterDays}
              onChange={(e) => setFilterDays(Number(e.target.value))}
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 text-waldorf-clay-700 transition-all duration-200"
            >
              <option value={1}>Last 1 day</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>

          {/* Auth Method */}
          <div>
            <label className="block text-sm font-semibold text-waldorf-clay-700 mb-2">Auth Method</label>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value as AuthMethod | 'all')}
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 text-waldorf-clay-700 transition-all duration-200"
            >
              <option value="all">All Methods</option>
              <option value="google_oauth">Google OAuth</option>
              <option value="magic_link">Magic Link</option>
              <option value="email_password">Email/Password</option>
            </select>
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-semibold text-waldorf-clay-700 mb-2">Event Type</label>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value as AuthEventType | 'all')}
              className="w-full px-4 py-3 border border-waldorf-cream-300 rounded-xl bg-waldorf-cream-50 focus:outline-none focus:ring-2 focus:ring-waldorf-sage-300 focus:border-waldorf-sage-400 text-waldorf-clay-700 transition-all duration-200"
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
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleExportCSV}
            disabled={events.length === 0 || isLoading}
            className="px-6 py-2.5 text-white bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-waldorf-peach-200/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📥 Export to CSV
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center h-32">
          <div className="w-12 h-12 rounded-full border-4 border-waldorf-cream-200 border-t-waldorf-sage-500 animate-spin"></div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-6 bg-waldorf-rose-50 border border-waldorf-rose-200 rounded-2xl">
          <p className="text-waldorf-rose-800 font-semibold">Error</p>
          <p className="text-waldorf-rose-700 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* No Data */}
      {!isLoading && !error && events.length === 0 && (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-waldorf-clay-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-waldorf-clay-500 font-medium">No authentication events found</p>
          <p className="text-waldorf-clay-400 text-sm mt-1">Try adjusting your filter settings</p>
        </div>
      )}

      {/* Events Table */}
      {!isLoading && !error && events.length > 0 && (
        <div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden border border-waldorf-cream-200 shadow-lg shadow-waldorf-clay-100/50">
            <div className="px-6 py-4 border-b border-waldorf-cream-200 bg-gradient-to-r from-waldorf-cream-100 to-waldorf-cream-50">
              <p className="text-sm text-waldorf-clay-600">
                Showing <span className="font-semibold">{startIndex + 1}</span> to <span className="font-semibold">{Math.min(startIndex + eventsPerPage, events.length)}</span> of <span className="font-semibold">{events.length}</span> events
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-waldorf-cream-100 to-waldorf-cream-50">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                      Event
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                      Method
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                      Device
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-waldorf-clay-600 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-waldorf-cream-100">
                  {paginatedEvents.map((event) => {
                    const isExpanded = expandedEventId === event.id
                    const eventInfo = EVENT_TYPE_INFO[event.event_type]

                    return (
                      <React.Fragment key={event.id}>
                        <tr className="hover:bg-waldorf-cream-50/50 transition-colors duration-200">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-waldorf-clay-600">
                            {formatDate(event.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-waldorf-clay-600">
                            {event.user_id ? event.user_id.substring(0, 8) : '(unauthenticated)'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1.5 inline-flex text-xs leading-5 font-medium rounded-full
                              ${eventInfo.color === 'green' ? 'bg-waldorf-sage-100 text-waldorf-sage-700' : ''}
                              ${eventInfo.color === 'red' ? 'bg-waldorf-rose-100 text-waldorf-rose-700' : ''}
                              ${eventInfo.color === 'blue' ? 'bg-waldorf-lavender-100 text-waldorf-lavender-700' : ''}
                              ${eventInfo.color === 'gray' ? 'bg-waldorf-cream-200 text-waldorf-clay-700' : ''}
                              ${eventInfo.color === 'orange' ? 'bg-waldorf-peach-100 text-waldorf-peach-700' : ''}`}
                            >
                              {eventInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-waldorf-clay-600">
                            {event.auth_method ? AUTH_METHOD_INFO[event.auth_method] : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-waldorf-clay-600">
                            <div className="max-w-xs truncate" title={event.user_agent || ''}>
                              {event.user_agent ? event.user_agent.substring(0, 40) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <button
                                onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                                className="text-waldorf-peach-600 hover:text-waldorf-peach-700 font-medium"
                              >
                                {isExpanded ? '▼' : '▶'} View
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Expanded Metadata Row */}
                        {isExpanded && event.metadata && (
                          <tr className="bg-waldorf-cream-50/50">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="bg-white border border-waldorf-cream-200 rounded-xl p-4">
                                <p className="text-sm font-medium text-waldorf-clay-900 mb-3">Additional Info:</p>
                                <pre className="text-xs text-waldorf-clay-600 overflow-auto max-h-32 bg-waldorf-cream-50 p-3 rounded-lg border border-waldorf-cream-200 font-mono">
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
              <div className="px-6 py-4 border-t border-waldorf-cream-200 bg-gradient-to-r from-waldorf-cream-100 to-waldorf-cream-50 flex justify-between items-center">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-waldorf-cream-300 rounded-lg text-sm font-medium text-waldorf-clay-700 hover:bg-waldorf-cream-100 transition-all duration-200 disabled:opacity-50"
                >
                  Previous
                </button>

                <span className="text-sm text-waldorf-clay-600">
                  Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-waldorf-cream-300 rounded-lg text-sm font-medium text-waldorf-clay-700 hover:bg-waldorf-cream-100 transition-all duration-200 disabled:opacity-50"
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
