#!/usr/bin/env node
/**
 * Turn a `pg_dump --schema-only --schema=public` from local Supabase
 * into a vanilla Postgres schema: no auth schema, no RLS, no Storage.
 */
import fs from 'node:fs'

const inputPath = process.argv[2]
const outputPath = process.argv[3]
if (!inputPath || !outputPath) {
  console.error('Usage: node db/sanitize-schema.mjs <input.sql> <output.sql>')
  process.exit(1)
}

const AUTH_ONLY_FUNCTIONS = new Set([
  'admin_create_user_role',
  'admin_delete_user_role',
  'admin_update_user_display_name',
  'admin_update_user_role',
  'delete_user_sessions',
  'get_auth_user_family_ids',
  'get_user_sessions',
  'is_admin_user',
])

const raw = fs.readFileSync(inputPath, 'utf8')
if (/CREATE TABLE public\.(families|family_enrollment|students|student_class_enrollment|teacher_profiles|teacher_class_assignment|classes|user_roles|user_role_assignments)\s*\(/i.test(raw)) {
  throw new Error('Identity masters belong to Auth. Apply the retirement migration before exporting a CMS schema.')
}

const withoutRestrict = raw
  .replace(/^\\restrict .*$/gm, '')
  .replace(/^\\unrestrict .*$/gm, '')
  .replace(/^[ \t]*--[^\n]*\n/gm, '')

const statements = splitSqlStatements(withoutRestrict)
const kept = []

for (const statement of statements) {
  const trimmed = statement.trim()
  if (!trimmed) continue
  if (isDroppedStatement(trimmed)) continue
  kept.push(rewriteStatement(trimmed))
}

const header = `-- Vanilla Postgres schema for email-cms.
-- Generated from the local Supabase public schema.
-- Stripped: auth.users FKs, RLS policies, Storage, auth-only RPCs.
-- Identity masters live in Auth; historical external IDs have no cascading directory FKs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

`

fs.writeFileSync(outputPath, `${header}${kept.map((statement) => `${statement.trim()};`).join('\n\n')}\n`)
console.log(`Wrote ${kept.length} statements to ${outputPath}`)

function splitSqlStatements(sql) {
  const statements = []
  let current = ''
  let inSingle = false
  let inDollar = null

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]
    const next = sql[i + 1]

    if (!inSingle && char === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/)
      if (match) {
        const tag = match[0]
        if (!inDollar) {
          inDollar = tag
          current += tag
          i += tag.length - 1
          continue
        }
        if (inDollar === tag) {
          inDollar = null
          current += tag
          i += tag.length - 1
          continue
        }
      }
    }

    if (!inDollar && char === "'" && sql[i - 1] !== '\\') {
      inSingle = !inSingle
    }

    if (!inSingle && !inDollar && char === ';') {
      statements.push(current)
      current = ''
      continue
    }

    current += char
  }

  if (current.trim()) statements.push(current)
  return statements
}

function sqlCommand(statement) {
  return statement
    .replace(/^(\s*--[^\n]*\n)+/g, '')
    .replace(/^\s+/, '')
}

function isDroppedStatement(statement) {
  const command = sqlCommand(statement)
  if (!command) return true
  if (/^\\/.test(command)) return true
  if (/^CREATE POLICY\b/i.test(command)) return true
  if (/ENABLE ROW LEVEL SECURITY/i.test(command)) return true
  if (/DISABLE ROW LEVEL SECURITY/i.test(command)) return true
  if (/FORCE ROW LEVEL SECURITY/i.test(command)) return true
  if (/^GRANT\b/i.test(command) || /^REVOKE\b/i.test(command)) return true
  if (/^ALTER DEFAULT PRIVILEGES\b/i.test(command)) return true
  if (/TO\s+(anon|authenticated|service_role)\b/i.test(command)) return true
  if (/^COMMENT ON POLICY\b/i.test(command)) return true
  if (/^COMMENT ON SCHEMA\b/i.test(command)) return true

  const functionName = command.match(/^CREATE FUNCTION public\.([a-z0-9_]+)/i)?.[1]
  if (functionName && AUTH_ONLY_FUNCTIONS.has(functionName)) return true

  const commentFn = command.match(/^COMMENT ON FUNCTION public\.([a-z0-9_]+)/i)?.[1]
  if (commentFn && AUTH_ONLY_FUNCTIONS.has(commentFn)) return true

  return false
}

function rewriteStatement(statement) {
  let next = statement
  if (/REFERENCES auth\.users\(id\)/.test(next)) throw new Error('Remove cross-domain identity foreign keys before exporting CMS schema')
  next = next.replace(/CREATE SCHEMA public;?/i, 'CREATE SCHEMA IF NOT EXISTS public;')
  next = next.replace(
    /DEFAULT auth\.uid\(\)/g,
    'DEFAULT NULL',
  )
  return next
}
