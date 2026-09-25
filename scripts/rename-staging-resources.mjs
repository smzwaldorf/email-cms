// One-time, resumable migration. Renames existing resources; never copies or deletes them.
const account = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_API_TOKEN
if (account !== 'f1b69ad88454573ccaa3364b628fd114' || !token || process.env.DEPLOYMENT_ENVIRONMENT !== 'staging') throw new Error('Expected the SMZ staging account')
const resources = [['worker', 'smz-cms-api', 'staging-smz-news-api'], ['pages', 'smz-cms', 'staging-smz-news']]
async function request(path, method = 'GET', body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json()
  if (response.status === 404 && method === 'GET') return null
  if (!response.ok || !data.success) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data.errors)}`)
  return data.result
}
for (const [kind, from, to] of resources) {
  const prefix = kind === 'worker' ? 'workers/workers' : 'pages/projects'
  const current = await request(`${prefix}/${from}`)
  const target = await request(`${prefix}/${to}`)
  if (current && target) throw new Error(`Both ${from} and ${to} exist; refusing to overwrite`)
  if (!current && !target) throw new Error(`Neither ${from} nor ${to} exists`)
  if (!target) await request(`${prefix}/${from}`, 'PATCH', { name: to })
  const verified = await request(`${prefix}/${to}`)
  if (!verified || verified.name !== to) throw new Error(`Rename verification failed for ${to}`)
  console.log(`Verified ${kind}: ${to}${verified.subdomain ? ` (${verified.subdomain})` : ''}`)
}
