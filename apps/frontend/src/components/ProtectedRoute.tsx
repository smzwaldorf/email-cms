/**
 * Protected Route Component
 * Redirects unauthenticated users to login page
 * Shows loading state while checking authentication
 */

import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

import { canAccess } from '@/lib/rbac'
import { canAccessCmsPanel } from '@email-cms/shared'
import type { UserRole } from '@/types/auth'
import { buildLoginRedirectPath } from '@/utils/urlUtils'

export interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
  cmsPanel?: boolean
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, cmsPanel }) => {
  const { user, isAuthenticated, isLoading, signInWithGoogle } = useAuth()

  const [showTimeout, setShowTimeout] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [recoveryError, setRecoveryError] = useState(false)

  const recoverSession = async () => {
    setRecovering(true)
    setRecoveryError(false)
    try {
      await signInWithGoogle(window.location.pathname + window.location.search + window.location.hash)
    } catch {
      setRecoveryError(true)
    } finally {
      setRecovering(false)
    }
  }

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isLoading) {
      timer = setTimeout(() => {
        setShowTimeout(true)
      }, 8000)
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">正在確認登入狀態</h3>
            <p className="text-gray-600 mb-6">
              登入服務回應較慢。你可以繼續等候，或重新驗證身分以返回目前頁面。
            </p>
            <button 
              onClick={() => void recoverSession()}
              disabled={recovering}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
            >
              {recovering ? '正在重新連線…' : '重新連線並登入'}
            </button>
            {recoveryError && <p role="alert" className="mt-4 text-red-700">目前無法連線至登入服務，請稍後再試。</p>}
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-waldorf-peach border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    const redirectPath = buildLoginRedirectPath(window.location.pathname, window.location.search)
    return <Navigate to={redirectPath} replace />
  }

  // Check role requirement if specified
  if ((cmsPanel && !canAccessCmsPanel({ roles: user.roles ?? [user.role] })) || (requiredRole && !canAccess(user, requiredRole))) {
    return <Navigate to="/" replace />
  }

  // Render protected content
  return <>{children}</>
}
