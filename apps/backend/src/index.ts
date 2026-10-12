import { createCmsApplication } from '#/application'
import { loadBackendConfig } from '#/config'
import { closePool } from '#/lib/db'
import { getSupabaseClient } from '#/lib/supabase'
import { startNodeHttp } from '#/runtime/nodeHttp'
import { installShutdownSignals } from '#/runtime/signals'
import { openNodeMediaStorage } from '#/runtime/nodeMediaStorage'

export async function main(): Promise<void> {
  await import('#/env')
  const config = loadBackendConfig()
  const storage = await openNodeMediaStorage()
  const runtime = await startNodeHttp({
    application: createCmsApplication({ supabase: getSupabaseClient(), corsOrigin: config.corsOrigin, mediaBucket: storage.bucket }),
    port: config.port,
    closeResources: async () => { await closePool(); await storage.dispose() },
  })
  installShutdownSignals(runtime.stop)
  console.info(`Email CMS backend listening on http://localhost:${config.port}`)
}

const invokedDirectly = require.main === module || /(?:^|\/)src\/index\.ts$|(?:^|\/)dist\/index\.js$/.test(process.argv[1] ?? '')

if (invokedDirectly) {
  void main().catch(error => {
    console.error('CMS backend startup failed:', error)
    process.exitCode = 1
  })
}
