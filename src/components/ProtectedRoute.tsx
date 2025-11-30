/**
 * Protected Route Component
 * Redirects unauthenticated users to login page
 * Shows loading state while checking authentication
 */

import React from 'react'
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

  // Show loading state while checking auth
  if (isLoading) {
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You do not have permission to view this page. Required role: <span className="font-semibold">{requiredRole}</span>
          </p>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Render protected content
  return <>{children}</>
}
