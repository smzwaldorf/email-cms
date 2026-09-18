export function secretConfiguration(env) {
const { CMS_SESSION_SECRET, CMS_OIDC_CLIENT_SECRET, RESEND_API_KEY, RESEND_FROM_EMAIL, JWT_SECRET } = env
if (!/^[a-f0-9]{64}$/i.test(CMS_SESSION_SECRET ?? '') || (CMS_OIDC_CLIENT_SECRET?.length ?? 0) < 32) throw new Error('Persistent CMS session secrets must be configured')
if (!RESEND_API_KEY?.startsWith('re_') || !RESEND_FROM_EMAIL || /[\r\n]/.test(RESEND_FROM_EMAIL) || !/@/.test(RESEND_FROM_EMAIL)) throw new Error('Configure RESEND_API_KEY and verified RESEND_FROM_EMAIL before deployment')
if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET === CMS_SESSION_SECRET || /change-me|placeholder|local-/i.test(JWT_SECRET)) throw new Error('Configure a separate persistent JWT_SECRET of at least 32 characters for tracking')
return { CMS_SESSION_SECRET, CMS_OIDC_CLIENT_SECRET, RESEND_API_KEY, RESEND_FROM_EMAIL, JWT_SECRET }
}
