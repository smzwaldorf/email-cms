import { deploymentEnvironment } from './cloudflare-config.mjs'
export function databaseName(env) {
  return deploymentEnvironment(env) === 'production' ? 'production-news' : 'smz-cms'
}
