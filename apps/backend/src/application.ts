import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleApiRequest, type RouteContext } from '#/routes'

/** Node request contract. Construction does not own process or database lifecycle. */
export interface CmsApplication {
  handle(request: IncomingMessage, response: ServerResponse): Promise<void>
}

export function createCmsApplication(context: RouteContext): CmsApplication {
  return { handle: (request, response) => handleApiRequest(request, response, context) }
}
