// Narrow declaration of the documented server bridge. Import Worker types explicitly
// so HTMLRewriter Element and Buffer globals don't collide with the CMS DOM/Node types.
declare module 'cloudflare:node' {
  import type { Server } from 'node:http'
  import type { ExecutionContext } from '@cloudflare/workers-types'
  export function httpServerHandler(server: Server): {
    fetch(request: Request, env: unknown, context: ExecutionContext): Promise<Response>
  }
}
