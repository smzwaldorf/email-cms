import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { useAuth } from '@/context/AuthContext'
import { backendRequest } from '@/services/backendApi'
import { ANALYTICS_CONFIG } from '@/config/analytics'
import { canAccessCmsPanel } from '@email-cms/shared'

export function CmsVisitTracker() {
  const location = useLocation()
  const { user, isLoading } = useAuth()
  const previous = useRef('')
  useEffect(() => {
    if (isLoading || !user) { previous.current = ''; return }
    const path = location.pathname
    // Reader routes own article attribution and published/draft eligibility.
    if (path !== '/' && !(canAccessCmsPanel({ roles: user.roles ?? [user.role] }) && /^\/(admin(?:\/|$)|editor\/)/.test(path))) { previous.current = ''; return }
    const key = `${user.id}:${path}`
    if (previous.current === key) return
    previous.current = key // Claim before async work, including StrictMode effect replay.
    let sessionId = sessionStorage.getItem(ANALYTICS_CONFIG.sessionIdStorageKey)
    if (!sessionId) {
      sessionId = uuid()
      sessionStorage.setItem(ANALYTICS_CONFIG.sessionIdStorageKey, sessionId)
    }
    void backendRequest('/api/cms/visits', { method: 'POST', keepalive: true,
      body: JSON.stringify({ id: uuid(), sessionId, path }) }).catch(() => {})
  }, [user, isLoading, location.pathname, location.key])
  return null
}
