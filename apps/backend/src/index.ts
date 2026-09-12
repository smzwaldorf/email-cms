import { createCmsApplication } from '#/application'
import { loadBackendConfig } from '#/config'
import { closePool } from '#/lib/db'
import { getSupabaseClient } from '#/lib/supabase'
import { startNodeHttp } from '#/runtime/nodeHttp'
import { installShutdownSignals } from '#/runtime/signals'

export async function main(): Promise<void> {
  await import('#/env')
  const config = loadBackendConfig()
  const runtime = await startNodeHttp({
    application: createCmsApplication({ supabase: getSupabaseClient(), corsOrigin: config.corsOrigin }),
    port: config.port,
    closeResources: closePool,
  })
  installShutdownSignals(runtime.stop)
  console.info(`Email CMS backend listening on http://localhost:${config.port}`)
}

if (require.main === module) {
  void main().catch(error => {
    console.error('CMS backend startup failed:', error)
    process.exitCode = 1
  })
}
