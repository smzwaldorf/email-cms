// Publishes email template artwork (apps/backend/templates/email/<source>/assets/*)
// to a dedicated Cloudflare Pages project so emails can reference the slices over
// https. Resend rejects data: URIs and Gmail blocks them, so the templates point at
// https://<project>.pages.dev/<source>/<file> instead.
//
// Usage: node scripts/email-assets-deploy.mjs [--project smz-email-assets] [--dry-run]
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const projectIndex = args.indexOf('--project')
const project = projectIndex >= 0 ? args[projectIndex + 1] : 'smz-email-assets'
const dryRun = args.includes('--dry-run')
if (!/^[a-z0-9][a-z0-9-]*$/.test(project ?? '')) throw new Error('Invalid --project name')

const templatesRoot = fileURLToPath(new URL('../apps/backend/templates/email/', import.meta.url))
const staging = await mkdtemp(path.join(tmpdir(), 'email-assets-'))
const published = []
try {
  for (const source of (await readdir(templatesRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
    const assetsDir = path.join(templatesRoot, source.name, 'assets')
    let files
    try {
      files = (await readdir(assetsDir)).filter((name) => /\.(jpe?g|png|gif|webp)$/i.test(name)).sort()
    } catch {
      continue
    }
    for (const file of files) {
      await cp(path.join(assetsDir, file), path.join(staging, source.name, file))
      published.push(`/${source.name}/${file}`)
    }
  }
  if (published.length === 0) throw new Error('No email template assets found to publish')
  // Slices are immutable per filename; let clients and the edge cache them for a year.
  await writeFile(path.join(staging, '_headers'), '/*\n  Cache-Control: public, max-age=31536000, immutable\n  X-Content-Type-Options: nosniff\n')
  await writeFile(path.join(staging, 'index.html'), '<!doctype html><title>SMZ email assets</title>\n')

  console.info(`Publishing ${published.length} asset(s) to Pages project "${project}":`)
  for (const file of published) console.info(`  https://${project}.pages.dev${file}`)
  if (dryRun) {
    console.info('Dry run; skipping wrangler pages deploy')
  } else {
    const result = spawnSync(
      'npx',
      ['wrangler', 'pages', 'deploy', staging, '--project-name', project, '--branch', 'main', '--commit-dirty=true'],
      { stdio: 'inherit' },
    )
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
} finally {
  await rm(staging, { recursive: true, force: true })
}
