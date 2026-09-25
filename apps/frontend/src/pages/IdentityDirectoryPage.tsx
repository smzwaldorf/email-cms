import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { backendRequest } from '@/services/backendApi'
import { adminService } from '@/services/adminService'

interface Entry { id: string; displayName: string; code?: string }
type Kind = 'families' | 'classes' | 'teachers' | 'parents' | 'students' | 'users' | 'relationships'

/** Only the family/class summaries already used in CMS are shown here. */
export function IdentityDirectoryPage({ kind = 'users' }: { kind?: Kind }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError] = useState('')
  const hasSummary = kind === 'families' || kind === 'classes'
  useEffect(() => {
    let active = true
    setEntries(null)
    setError('')
    const request = kind === 'families'
      ? backendRequest<{ families: Entry[] }>('/api/admin/directory/families').then(value => value.families)
      : kind === 'classes'
        ? adminService.fetchClasses().then(value => value.map(row => ({ id: row.id, displayName: row.name, code: row.code })))
        : null
    request?.then(value => {
      if (active) setEntries(value)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '無法載入通訊錄')
    })
    return () => { active = false }
  }, [kind])
  const managementUrl = new URL('/admin', import.meta.env.VITE_SMZ_AUTH_ISSUER || 'http://localhost:3000/api/auth').toString()
  return <AdminLayout activeTab={kind === 'relationships' ? 'families' : kind}>
    <section className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold capitalize">{kind}</h1>
      <p>請在 SMZ Auth 管理帳號、家庭、班級與關係。</p>
      <a href={managementUrl} className="underline">前往 SMZ Auth 管理</a>
      {hasSummary && (error ? <p role="alert">{error}</p> : !entries ? <p role="status">正在載入通訊錄…</p> : <>
        <p>{entries.length} 筆來自 SMZ Auth 的資料</p>
        <ul>{entries.map(entry => <li key={entry.id} className="py-3">
          <strong>{entry.displayName}</strong>{entry.code && <span> · {entry.code}</span>}
        </li>)}</ul>
      </>)}
    </section>
  </AdminLayout>
}
