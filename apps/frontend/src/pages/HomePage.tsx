import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import WeekService from '@/services/WeekService'

/** Resolve an authenticated landing page even before the first newsletter is published. */
export function HomePage() {
  const { user, isLoading, signOut } = useAuth()
  const [destination, setDestination] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const isAdmin = user?.role === 'admin' || user?.roles?.includes('admin')

  useEffect(() => {
    if (!user) return
    if (isAdmin) {
      setDestination('/admin')
      setLoading(false)
      return
    }
    let active = true
    void WeekService.getLatestPublishedWeek().then(week => {
      if (active) setError(false)
      if (active && week) setDestination(week.week_number ? `/week/${week.week_number}` : `/newsletter/${week.id}`)
    }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user, isAdmin])

  if (isLoading) return <p className="p-8">正在載入…</p>
  if (!user) return <Navigate to="/login" replace />
  if (loading) return <p className="p-8">正在載入電子報…</p>
  if (destination) return <Navigate to={destination} replace />
  return <main className="mx-auto max-w-xl p-8 text-center">
    <h1 className="mb-4 text-2xl font-semibold">{error ? '暫時無法載入電子報' : '尚未有已發布的電子報'}</h1>
    <p className="mb-6">{error ? '連線恢復後會自動重試。' : '你已成功登入。新的電子報發布後，便可在這裡閱讀。'}</p>
    <Link className="mr-6 underline" to="/">首頁</Link>
    {isAdmin && <Link className="mr-6 underline" to="/admin">管理後台</Link>}
    <button className="underline" onClick={() => { void signOut() }}>登出</button>
  </main>
}
