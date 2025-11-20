/**
 * Protected Route Component
 * Redirects unauthenticated users to login page
 * Shows loading state while checking authentication
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

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
  if (!isAuthenticated) {
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

  // Render protected content
  return <>{children}</>
}
