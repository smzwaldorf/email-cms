import { AsyncLocalStorage } from 'node:async_hooks'

export interface IdentityTransport {
  fetch(input: string, init?: RequestInit): Promise<Response>
}
const environment = new AsyncLocalStorage<{
  values: Record<string, string | undefined>
  identityTransport?: IdentityTransport
}>()

export function runtimeEnvironment(): Record<string, string | undefined> {
  return environment.getStore()?.values ?? process.env
}

export function identityFetch(url: string, init?: RequestInit): Promise<Response> {
  const transport = environment.getStore()?.identityTransport
  return transport ? transport.fetch(url, init) : fetch(url, init)
}

export function withRuntimeEnvironment<T>(values: Record<string, string | undefined>, run: () => T, identityTransport?: IdentityTransport): T {
  return environment.run({ values, identityTransport }, run)
}
