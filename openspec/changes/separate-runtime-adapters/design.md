## Context

The HTTP entry imports environment and immediately listens. The worker entry immediately runs and uses an overlapping interval. Routes already expose an asynchronous Node request handler and NewsletterDeliveryWorker exposes runOnce. Existing services use lazy process-global PostgreSQL and environment reads.

## Goals / Non-Goals

Goals: explicit application/request handler and Node process adapter boundaries, graceful resource ownership, non-overlapping polling, default command parity.

Non-goals: Fetch/edge compatibility, Cloudflare deployment, database/service singleton rewrite, new provider behavior, migrations, live worker execution, commits or deployment.

## Decisions

### Application handler

createCmsApplication(context) returns handle(request, response), using the existing route handler and explicit Supabase-compatible client plus CORS origin. It does not load environment, listen, install signals or start jobs. Node request types remain explicit rather than pretending to provide a portable Fetch API.

### Node HTTP lifecycle

startNodeHttp accepts application, port, optional host and an owned-resource close callback. It returns the listening server and idempotent stop. Stop rejects newly received requests with 503, closes listener/idle connections, drains request promises including disconnected responses, then closes resources. Startup failure closes owned resources and surfaces the error. Request rejection produces 500 or destroys an already-started response. CLI main loads environment and composes the lazy process pool; imports of CLI entrypoints are guarded. Resource sharing across embedded instances requires the caller to own pool closure.

### Worker polling lifecycle

createPollingWorker accepts runOnce executor, positive poll interval, result/error callbacks and owned-resource close callback. Construction does no work. start triggers one immediate run; the next timeout is scheduled only after it completes. stop cancels the timer, blocks future runs, awaits the active run, then closes resources once. Stopped instances cannot restart. Failure is logged and polling resumes after the delay. Existing executor claims/retries/provider logic remains untouched.

### Process signals

installShutdownSignals wires SIGINT/SIGTERM to one stop operation and removes listeners when it settles. Failure sets a nonzero process exit code and is reported; the adapter does not force exit while business work drains. HTTP and worker entrypoints use this helper and retain existing npm commands.

## Implementation Contract

Importing application, adapters or guarded CLI entries creates no listener, timer, pool connection, environment load or provider request. Root/CORS/404/auth-denial responses match direct routing. HTTP startup rejects bind errors after cleanup; stop is idempotent and waits for handler completion before closeResources. Worker start executes only once per instance, runOnce never overlaps, stop before start closes resources without executing, and failures remain visible. Tests use ephemeral local HTTP servers and fake executors/resources, never a live delivery queue. Existing auth, parent-readonly, delivery and frontend global-logout regression suites remain gates. Production builds are compared against inherited diagnostics.

## Risks / Trade-offs

- Global lazy pool and process environment remain shared: only the default one-process composition owns closePool; embedded instances must coordinate ownership. No claim of isolated tenants.
- Node HTTP, pg, Buffer, AsyncLocalStorage and file templates remain Node-specific: a future host must supply compatible facilities or refactor those dependencies.
- A stalled handler or provider call can stall graceful drain: no forced cutoff is introduced because terminating a send can duplicate external effects; operators retain process termination control.
- Poll interval is now a delay after completion, reducing throughput during slow batches to prevent overlap.

## Migration Plan

Keep backend dev/start and worker dev/start scripts and ports unchanged. Rollback restores prior entrypoint wiring; no schema or queue changes are needed.
