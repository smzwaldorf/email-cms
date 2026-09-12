import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../apps/backend/templates/email/', import.meta.url))
const files = {}
async function walk(dir) {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full)
    else if (/\.(json|hbs|html)$/i.test(entry.name)) files[`/templates/email/${path.relative(root, full).split(path.sep).join('/')}`] = await readFile(full, 'utf8')
  }
}
await walk(root)
const target = new URL('../apps/backend/src/generated/emailTemplates.json', import.meta.url)
await mkdir(new URL('.', target), { recursive: true })
await writeFile(target, JSON.stringify(files, null, 2) + '\n')
console.info(`Bundled ${Object.keys(files).length} email template files`)
