const { CMS_ORIGIN: cms, CMS_API_ORIGIN: api, SMZ_AUTH_ISSUER: issuer } = process.env
if (!cms || !api || !issuer) throw new Error('CMS_ORIGIN, CMS_API_ORIGIN and SMZ_AUTH_ISSUER are required')
async function check(name, url, predicate, options) {
  const response = await fetch(url, { redirect: 'manual', ...options })
  if (!await predicate(response)) throw new Error(`${name} failed (HTTP ${response.status})`)
  console.info(`${name}: passed`)
}
await check('Worker database health', `${api}/health`, async r => r.status === 200 && (await r.json()).database === 'connected')
await check('Unauthenticated session denial', `${api}/api/auth/session`, r => r.status === 401 && r.headers.get('access-control-allow-origin') === cms)
await check('CORS preflight', `${api}/api/auth/session`, r => r.status === 204 && r.headers.get('access-control-allow-origin') === cms, { method: 'OPTIONS', headers: { Origin: cms } })
for (const route of ['/', '/auth/callback?code=smoke-no-state', '/logout/local']) {
  await check(`Pages ${route}`, `${cms}${route}`, async r => r.status === 200 && (await r.text()).includes('<div id="root">'))
}
await check('Trusted logout frame policy', `${cms}/logout/local`, r => r.headers.get('content-security-policy') === `frame-ancestors ${new URL(issuer).origin}`)
console.info('Deployment smoke passed. Authenticated login and coordinated logout still require a separate browser check.')
