import { useState, type Dispatch, type SetStateAction } from 'react'
import { getStoredAuthUser } from '@/services/backendClient'
import { serverSessionMode } from '@/services/serverSessionMode'

/** Non-credential local drafts are scoped to a person and document; logout clears them. */
export function usePersistentDraft<T>(document: string, initial: T): [T, Dispatch<SetStateAction<T>>, () => void, T | null, () => void] {
  const user = getStoredAuthUser()
  const key = serverSessionMode && user?.id ? `email-cms-draft:${user.id}:${document}` : null
  const baseline = JSON.stringify(initial)
  const [saved] = useState<{ baseline: string; value: T } | null>(() => {
    try { return key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null } catch { return null }
  })
  const [value, update] = useState<T>(() => saved?.baseline === baseline ? saved.value : initial)
  const [conflicting, setConflicting] = useState<T | null>(() => saved && saved.baseline !== baseline ? saved.value : null)
  const setValue: Dispatch<SetStateAction<T>> = next => update(previous => {
    const updated = typeof next === 'function' ? (next as (value: T) => T)(previous) : next
    if (key) {
      try { localStorage.setItem(key, JSON.stringify({ baseline, value: updated })) } catch { /* The mounted editor still retains the draft when storage is full. */ }
    }
    return updated
  })
  const clear = () => { if (key) localStorage.removeItem(key); setConflicting(null) }
  const restore = () => { if (conflicting) setValue(conflicting); setConflicting(null) }
  return [value, setValue, clear, conflicting, restore]
}
