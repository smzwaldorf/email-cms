/**
 * Protected Route Component
 * Redirects unauthenticated users to login page
 * Shows loading state while checking authentication
 */

import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

import { canAccess } from '@/lib/rbac'
import type { UserRole } from '@/types/auth'

export interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, isAuthenticated, isLoading } = useAuth()

  const [showTimeout, setShowTimeout] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isLoading) {
      timer = setTimeout(() => {
        setShowTimeout(true)
      }, 5000) // 5 seconds timeout
    } else {
      setShowTimeout(false)
    }
    return () => clearTimeout(timer)
  }, [isLoading])

  // Show loading state while checking auth
  if (isLoading) {
    if (showTimeout) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md mx-4">
            <div className="text-waldorf-peach-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Timeout</h3>
            <p className="text-gray-600 mb-6">
              Loading is taking longer than expected. Your session may have timed out.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-waldorf-peach border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    // Check if we are trying to access a short URL
    const pathParts = window.location.pathname.split('/')
    // Expected format: /week/:weekNumber/:shortId
    if (pathParts.length >= 4 && pathParts[1] === 'week' && pathParts[3]) {
      const shortId = pathParts[3]
      localStorage.setItem('pending_short_id', shortId)
      localStorage.setItem('pending_week_number', pathParts[2])
    }
    
    return <Navigate to="/login" replace />
  }

  // Check role requirement if specified
  if (requiredRole && !canAccess(user, requiredRole)) {
    return <Navigate to="/" replace />
  }

  // Render protected content
  return <>{children}</>
}
