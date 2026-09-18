import { pathToFileURL } from 'node:url';
export const demoId = n => `de900000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const row = (table, key, values) => ({ table, key, values });
const quote = name => name.split('.').map(part => { if (!/^[a-z_]+$/.test(part)) throw Error('Invalid seed identifier'); return `"${part}"`; }).join('.');
export async function applyPlan(client, rows, { apply = false } = {}) {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(1936553061)');
    let existing = 0;
    for (const entry of rows) {
      const keys = Array.isArray(entry.key) ? entry.key : [entry.key];
      const where = keys.map((key, i) => `${quote(key)} = $${i + 1}`).join(' AND ');
      const found = await client.query(`SELECT * FROM ${quote(entry.table)} WHERE ${where}`, keys.map(key => entry.values[key]));
      if (found.rows.length) {
        existing++;
        // Never silently repoint a demo login or group identity on a rerun.
        for (const key of ['email', 'normalized_login_email', 'normalized_email', 'code', 'auth_family_id']) {
          if (key in entry.values && found.rows[0][key] !== entry.values[key]) throw Error(`Demo identity conflict in ${entry.table}; inspect existing data`);
        }
      }
    }
    if (existing && existing !== rows.length) throw Error('Partial demo fixture exists; refusing to merge, overwrite or restore removed rows');
    if (existing === rows.length) { await client.query('ROLLBACK'); return { state: 'already-present', inserted: 0 }; }
    for (const entry of rows) {
      const keys = Object.keys(entry.values);
      await client.query(`INSERT INTO ${quote(entry.table)} (${keys.map(quote).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, keys.map(key => entry.values[key]));
    }
    for (const entry of rows.filter(entry => entry.deferred)) {
      const keys = Object.keys(entry.deferred);
      if (Array.isArray(entry.key)) throw Error('Deferred fixture update requires one primary key');
      await client.query(`UPDATE ${quote(entry.table)} SET ${keys.map((key, i) => `${quote(key)} = $${i + 1}`).join(',')} WHERE ${quote(entry.key)} = $${keys.length + 1}`, [...Object.values(entry.deferred), entry.values[entry.key]]);
    }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    return { state: apply ? 'created' : 'rehearsed-and-rolled-back', inserted: rows.length };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
export async function runSeed(buildPlan, envFiles) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--check', '--apply'].includes(arg)) || args.length > 1) throw Error('Usage: npm run seed:demo -- [--check | --apply]');
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: envFiles, quiet: true }); // Explicit shell variables win.
  const rows = buildPlan(process.env);
  console.log(JSON.stringify({ profile: 'smz-newsletter-demo-v1', rows: rows.length, mode: args[0] ?? 'plan', sendsEmail: false }));
  if (!args.length) return;
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL required');
  const target = new URL(process.env.DATABASE_URL);
  if (process.env.DEMO_DATABASE_CONFIRM !== `${target.hostname}${target.pathname}`) throw Error('Set DEMO_DATABASE_CONFIRM to the exact database host/name (no credentials)');
  const { Client } = (await import('pg')).default;
  const client = new Client({ connectionString: target.href });
  await client.connect();
  try { console.log(JSON.stringify(await applyPlan(client, rows, { apply: args[0] === '--apply' }))); }
  finally { await client.end(); }
}
export function isMain(url) { return process.argv[1] && pathToFileURL(process.argv[1]).href === url; }
