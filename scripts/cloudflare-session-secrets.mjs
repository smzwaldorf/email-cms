import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const { CMS_SESSION_SECRET, CMS_OIDC_CLIENT_SECRET } = process.env
if (!/^[a-f0-9]{64}$/i.test(CMS_SESSION_SECRET ?? '') || (CMS_OIDC_CLIENT_SECRET?.length ?? 0) < 32) throw new Error('Persistent CMS session secrets must be configured')
const directory = await mkdtemp(join(tmpdir(), 'cms-secrets-'))
try {
  const file = join(directory, 'secrets.json')
  await writeFile(file, JSON.stringify({ CMS_SESSION_SECRET, CMS_OIDC_CLIENT_SECRET }), { mode: 0o600 })
  const result = spawnSync('npx', ['wrangler', 'secret', 'bulk', file, '--config', '.wrangler/deploy/cms.json'], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error('CMS session secret provisioning failed')
} finally { await rm(directory, { recursive: true, force: true }) }
