import { appendFileSync } from 'node:fs';
const service = process.argv[2];
if (!['auth', 'news'].includes(service) || process.env.DEPLOYMENT_ENVIRONMENT !== 'production') throw new Error('Production service required');
const database = `production-${service}`;
const name = `production-smz-${service}`;
const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token, DATABASE_URL: connectionString, GITHUB_ENV: envFile } = process.env;
if (!account || !token || !connectionString || !envFile) throw new Error('Missing production provisioning credentials');
const url = new URL(connectionString);
if (url.protocol !== 'postgresql:' || url.pathname !== `/${database}` || url.hostname !== 'aws-ap-northeast-1-2.pg.psdb.cloud' || !url.username || !url.password) throw new Error('Unexpected production database target');
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/hyperdrive/configs`;
async function request(path = '', body) {
  const response = await fetch(endpoint + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  // Never log provider error bodies: they can contain submitted connection details.
  if (!response.ok || !result.success) throw new Error(`Hyperdrive API failed (${response.status}; codes ${(result.errors ?? []).map(e => e.code).join(',')})`);
  return result.result;
}
const configs = await request();
const matches = configs.filter(c => c.name === name);
if (matches.length > 1) throw new Error('Duplicate production connector names');
let config = matches[0];
if (config) config = await request(`/${config.id}`);
else throw new Error('Create the dedicated production connector in the Cloudflare dashboard first');
if (config.origin?.database !== database || config.origin?.host !== url.hostname || config.origin?.user !== decodeURIComponent(url.username) || config.caching?.disabled !== true || config.origin_connection_limit !== 5) throw new Error('Existing production connector does not match expected isolated configuration');
if (!/^[a-f0-9]{32}$/.test(config.id)) throw new Error('Invalid Hyperdrive ID');
appendFileSync(envFile, `CLOUDFLARE_HYPERDRIVE_ID=${config.id}\n`);
console.log(`Verified ${name} connector ${config.id}, database ${database}, caching disabled, connection limit 5`);
