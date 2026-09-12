/** Signals belong to the executable composition root, never to reusable adapters. */
export function installShutdownSignals(stop: () => Promise<void>): () => void {
  let stopping = false
  const dispose = () => {
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
  }
  const shutdown = () => {
    if (stopping) return
    stopping = true
    void Promise.resolve().then(stop).catch(error => {
      console.error('CMS runtime shutdown failed:', error)
      process.exitCode = 1
    }).finally(dispose)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  return dispose
}
