import '#/env'
import { createServer } from 'node:http'
import { loadBackendConfig } from '#/config'
import { handleApiRequest } from '#/routes'
import { getSupabaseClient } from '#/lib/supabase'

const config = loadBackendConfig()
const supabase = getSupabaseClient()

const server = createServer((request, response) => {
  void handleApiRequest(request, response, {
    supabase,
    corsOrigin: config.corsOrigin,
  })
})

server.listen(config.port, () => {
  console.info(`Email CMS backend listening on http://localhost:${config.port}`)
})
