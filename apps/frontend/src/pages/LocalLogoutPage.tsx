import { useEffect, useState } from 'react'
import { authService } from '@/services/authService'
import { smzAuthIssuer } from '@/services/smzAuth'

/** Unprotected cleanup endpoint for Auth's registered front-channel logout. */
export function LocalLogoutPage() {
  const [complete, setComplete] = useState(false)
  const [invalid, setInvalid] = useState(false)
  useEffect(() => {
    let active = true
    const authOrigin = new URL(smzAuthIssuer()).origin
    const state = new URLSearchParams(window.location.search).get('logout_state')
    let trustedFrame = false
    try {
      trustedFrame = window.parent !== window && new URL(document.referrer).origin === authOrigin &&
        typeof state === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(state)
    } catch { /* An absent or malformed referrer is not a trusted logout frame. */ }
    if (!trustedFrame) { setInvalid(true); return }
    void authService.clearSessionForGlobalLogout().then(() => {
      if (!active) return
      setComplete(true)
      window.parent.postMessage({ type: 'smz:logout-complete', state }, authOrigin)
    }).catch(() => { /* Auth's bounded cleanup timeout reports unsuccessful local cleanup. */ })
    return () => { active = false }
  }, [])
  return <p>{invalid ? 'Invalid logout request.' : complete ? 'Signed out of Email CMS.' : 'Signing out of Email CMS…'}</p>
}
