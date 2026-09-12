import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// TypeScript preserves path aliases. Resolve only emitted CommonJS require calls
// so plain Node can execute the same application tested through Vite/Wrangler.
const root = fileURLToPath(new URL('../apps/backend/dist/', import.meta.url))
const shared = fileURLToPath(new URL('../packages/shared/dist/', import.meta.url))
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) { await visit(file); continue }
    if (!entry.name.endsWith('.js')) continue
    const source = await readFile(file, 'utf8')
    const resolved = source.replace(/require\((['"])(#\/|#shared\/)([^'"]+)\1\)/g, (_match, _quote, alias, suffix) => {
      const target = path.resolve(alias === '#/' ? root : shared, `${suffix}.js`)
      const relative = path.relative(path.dirname(file), target).split(path.sep).join('/')
      return `require(${JSON.stringify(relative.startsWith('.') ? relative : `./${relative}`)})`
    })
    if (resolved !== source) await writeFile(file, resolved)
  }
}
await visit(root)
