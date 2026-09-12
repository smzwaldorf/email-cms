import { readFile, writeFile } from 'node:fs/promises'
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
const enums = new Map([...schema.matchAll(/CREATE TYPE public\.(\w+) AS ENUM \(([\s\S]*?)\n\);/g)].map(([, name, values]) => [name, [...values.matchAll(/'([^']+)'/g)].map(m => JSON.stringify(m[1])).join(' | ')]))
let output = '// Generated from db/schema.sql by scripts/generate-sql-types.mjs.\nexport interface SqlTables {\n'
let count = 0
for (const [, name, body] of schema.matchAll(/CREATE TABLE public\.(\w+) \(([\s\S]*?)\n\);/g)) {
  count++
  output += `  ${name}: {\n`
  for (const line of body.split('\n')) {
    const match = line.match(/^    ([a-z_]+) (.+?)(?:,)?$/)
    if (!match) continue
    const [, column, definition] = match
    const sqlType = definition.split(/ DEFAULT | NOT NULL| COLLATE | GENERATED /)[0].replace(/,$/, '')
    let type = /^public\./.test(sqlType) ? enums.get(sqlType.slice(7))
      : /^(bigint|numeric)/.test(sqlType) ? 'number | string'
      : /^(integer|smallint|real|double precision)/.test(sqlType) ? 'number'
      : /^boolean/.test(sqlType) ? 'boolean'
      : /^json/.test(sqlType) ? 'Record<string, unknown>' : 'string'
    if (!type) throw new Error(`Unknown SQL type ${sqlType}`)
    if (/\[\]/.test(sqlType)) type = `Array<${type}>`
    if (!definition.includes('NOT NULL')) type += ' | null'
    output += `    ${column}: ${type}\n`
  }
  output += '  }\n'
}
output += '}\n'
await writeFile(new URL('../packages/shared/src/types/sqlRows.ts', import.meta.url), output)
console.info(`Generated types for ${count} tables`)
