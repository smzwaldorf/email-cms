import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/authService'
import WeekService from '@/services/WeekService'

type CallbackStatus = 'processing' | 'success' | 'error'

async function defaultDestination(): Promise<string> {
  const latestWeek = await WeekService.getLatestPublishedWeek()
  if (latestWeek) {
    const routeKey = latestWeek.week_number || latestWeek.id
    return latestWeek.week_number && /^\d{4}-W\d{2}$/.test(latestWeek.week_number)
      ? `/week/${routeKey}`
      : `/newsletter/${routeKey}`
  }
  return '/'
}

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<CallbackStatus>('processing')
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const result = await authService.completeSignIn()
        if (!active) return
        setStatus('success')
        navigate(result.redirectTo || await defaultDestination(), { replace: true })
      } catch (caught) {
        if (!active) return
        console.error('SMZ Identity callback failed', caught)
        setError(caught instanceof Error ? caught.message : 'Authentication could not be completed.')
        setStatus('error')
      }
    })()
    return () => {
      active = false
    }
  }, [navigate, attempt])

  return (
    <div className="min-h-screen bg-gradient-to-br from-waldorf-sage to-waldorf-cream flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md text-center">
        {status === 'processing' && (
          <>
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">正在驗證</h1>
            <p className="text-gray-600">Completing your SMZ Identity sign-in...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">✓</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">登入成功！</h1>
            <p className="text-gray-600">Redirecting to the newsletter...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">!</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">驗證失敗</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <button type="button" className="mb-4 underline" onClick={() => { setStatus('processing'); setAttempt(value => value + 1) }}>
              重試驗證
            </button>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-150"
            >
              返回登入
            </button>
          </>
        )}
      </div>
    </div>
  )
}
