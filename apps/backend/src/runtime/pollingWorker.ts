export interface DeliveryExecutor {
  runOnce(): Promise<number>
}

export interface PollingWorkerOptions {
  executor: DeliveryExecutor
  pollIntervalMs: number
  closeResources(): Promise<void>
  onProcessed?(count: number): void
  onError?(error: unknown): void
}

/** One-shot lifecycle: construction is inert; stopping permanently disables start. */
export function createPollingWorker(options: PollingWorkerOptions) {
  if (!Number.isSafeInteger(options.pollIntervalMs) || options.pollIntervalMs <= 0 || options.pollIntervalMs > 2_147_483_647) {
    throw new Error('pollIntervalMs must be a positive timer-safe integer')
  }
  let started = false
  let stopping = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let active: Promise<void> | undefined
  let stopped: Promise<void> | undefined

  function tick() {
    active = Promise.resolve()
      .then(async () => {
        // stop can arrive between start and this microtask; don't begin new work then.
        if (stopping) return
        const count = await options.executor.runOnce()
        options.onProcessed?.(count)
      })
      .catch(error => {
        // A failing observer must not leave an unhandled rejection in the scheduler.
        try {
          if (options.onError) options.onError(error)
          else console.error('Newsletter delivery worker tick failed:', error)
        } catch (observerError) { console.error('Worker error observer failed:', observerError) }
      })
      .finally(() => {
        active = undefined
        if (!stopping) timer = setTimeout(tick, options.pollIntervalMs)
      })
  }

  return {
    start() {
      if (stopping) throw new Error('Cannot restart a stopped worker')
      if (started) return
      started = true
      tick()
    },
    stop(): Promise<void> {
      if (!stopped) {
        stopping = true
        if (timer) clearTimeout(timer)
        stopped = (async () => {
          await active
          await options.closeResources()
        })()
      }
      return stopped
    },
  }
}
