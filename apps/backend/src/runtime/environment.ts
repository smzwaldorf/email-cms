import { AsyncLocalStorage } from 'node:async_hooks'

const environment = new AsyncLocalStorage<Record<string, string | undefined>>()

export function runtimeEnvironment(): Record<string, string | undefined> {
  return environment.getStore() ?? process.env
}

export function withRuntimeEnvironment<T>(values: Record<string, string | undefined>, run: () => T): T {
  return environment.run(values, run)
}
