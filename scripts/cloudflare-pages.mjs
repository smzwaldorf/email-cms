import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
const { CMS_ORIGIN, CMS_API_ORIGIN, SMZ_AUTH_ISSUER } = process.env
for (const value of [CMS_ORIGIN, CMS_API_ORIGIN, SMZ_AUTH_ISSUER]) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || /(^|\.)(localhost|example\.(com|test|org))$/.test(url.hostname)) throw new Error('Real HTTPS production origins are required')
}
const result = spawnSync('npm', ['run', 'build', '-w', '@email-cms/frontend'], {
  stdio: 'inherit', env: { ...process.env, VITE_CMS_SERVER_SESSION: 'true', VITE_APP_URL: CMS_ORIGIN, VITE_BACKEND_URL: CMS_API_ORIGIN, VITE_SMZ_AUTH_ISSUER: SMZ_AUTH_ISSUER },
})
if (result.status !== 0) process.exit(result.status ?? 1)
await writeFile(new URL('../apps/frontend/dist/_headers', import.meta.url), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n/logout/local\n  Content-Security-Policy: frame-ancestors ${new URL(SMZ_AUTH_ISSUER).origin}\n  Cache-Control: no-store\n`)
console.info('Pages bundle and trusted local-logout headers are ready')

await writeFile(new URL('../apps/frontend/dist/_worker.js', import.meta.url), `export default { async fetch(request, env) { const url = new URL(request.url); if (url.pathname.startsWith('/api/')) { const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body; const downstream = new Request(request.url, { method: request.method, headers: request.headers, body, redirect: 'manual' }); return env.CMS_API.fetch(downstream); } return env.ASSETS.fetch(request); } };\n`)
