# CMS runtime adapters

CMS already runs as long-running Node processes. This boundary keeps those commands as the defaults and allows another invocation adapter to reuse application routing or delivery execution.

**The application handler uses Node IncomingMessage/ServerResponse.** The Cloudflare adapter bridges Fetch through Cloudflare’s Node HTTP server API and supplies invocation-scoped environment and PostgreSQL pools. Node defaults retain the process environment and lazy pool; embedded Node instances sharing that pool must coordinate ownership and drain before closing it. See [Cloudflare deployment](CLOUDFLARE.md).

## Application and Node process adapter

- `apps/backend/src/application.ts`: createCmsApplication({supabase, corsOrigin}) returns an asynchronous handle(request, response). Construction does not listen, load environment or start delivery.
- `apps/backend/src/runtime/nodeHttp.ts`: startNodeHttp({application, port, host?, closeResources}) starts a Node listener and returns {server, stop}. A host can be supplied for embedding/tests; the CLI preserves its existing listen address and configured port.
- `apps/backend/src/index.ts`: guarded executable composition root loads environment, constructs the app, starts HTTP and installs SIGINT/SIGTERM handling. Importing the file does not run main.
- `apps/backend/src/runtime/signals.ts`: installShutdownSignals(stop) coalesces repeated signals, reports shutdown failure through stderr and exit code 1, and removes signal listeners after stop settles. Embedders can call stop directly without process signal registration.

Example inside a backend module:

```ts
import { createCmsApplication } from '#/application'
import { startNodeHttp } from '#/runtime/nodeHttp'
import { getSupabaseClient } from '#/lib/supabase'
import { closePool } from '#/lib/db'

const application = createCmsApplication({
  supabase: getSupabaseClient(),
  corsOrigin: 'http://localhost:5174',
})
const runtime = await startNodeHttp({
  application,
  host: '127.0.0.1',
  port: 8787,
  closeResources: closePool, // Only when this runtime owns the process pool.
})
// Later, after the host decides to shut down:
await runtime.stop()
```

The host supplies environment before making requests. Reusing an already-owned pool requires a no-op closeResources callback on individual adapters and a host-level final close after all consumers stop. Injecting a route client does not make the existing service singletons isolated.

Stop is idempotent. It blocks newly received requests with 503, stops accepting connections, closes idle connections, awaits active handler promises and listener closure, then closes owned resources exactly once. It tracks application promises even after clients disconnect. Bind failure closes owned resources and rejects startup. Unexpected handler rejection returns a generic 500 before headers, or destroys an already-started response; cleanup errors are surfaced.

## Delivery executor and polling adapter

`apps/backend/src/worker/deliveryWorker.ts` retains NewsletterDeliveryWorker.runOnce(). Its atomic queued-job claims, attempts, retry scheduling, preparation and configured provider behavior are unchanged. A run can process the existing bounded batch, including provider effects.

`apps/backend/src/runtime/pollingWorker.ts` exposes createPollingWorker({executor, pollIntervalMs, closeResources, onProcessed?, onError?}). Construction is inert; start() starts an immediate run. Repeated start is harmless until stop; a stopped instance cannot restart. The next timeout begins only after the previous run settles, so one adapter never overlaps its runs. The poll interval is a delay after completion, rather than a fixed interval that can overlap slow batches. An execution failure is reported and polling resumes after the delay.

stop() cancels future polling, prevents a queued first run from beginning, waits for an already-running runOnce to settle, then closes resources. It does not interrupt an in-progress provider effect or undo a claimed batch. Stop before start closes resources without executing any work. Hosts using runOnce directly must await its completion before closing shared resources and must enforce their own invocation concurrency; existing database claims still protect competing workers.

`apps/backend/src/worker/index.ts` is the guarded Node worker composition root. Importing it starts nothing. Only executing its main through an explicitly selected worker command starts delivery.

## Commands and remaining limits

Existing commands remain unchanged:

| Purpose | Command |
| --- | --- |
| HTTP development | npm run backend:dev |
| HTTP built output | npm run start -w @email-cms/backend |
| Worker development, starts delivery | npm run worker:dev |
| Worker built output, starts delivery | npm run worker:start -w @email-cms/backend |

Build emitted output before using built commands. The shared, backend and frontend compiler checks now pass. Backend builds resolve emitted CommonJS aliases for plain Node execution. TypeScript emission alone is not evidence of a passing build.

Node HTTP, Buffer, AsyncLocalStorage and pg remain dependencies. Email templates are generated into a bundled JSON module before backend builds. Cloudflare fetch and scheduled adapters are in `apps/backend/src/cloudflare`; scheduling is disabled by default. This does not add durable media storage or migrate email providers.

Graceful stop intentionally has no forced cutoff: a stalled request or provider call can delay exit. An external process supervisor can impose its own termination policy; a forced kill during an external send requires reconciliation before retry to avoid duplicate effects. Multiple adapters using the same pool must drain together before closing it.

## Verification

Runtime tests use ephemeral loopback HTTP servers and fake worker executors/resources. They never query the live delivery queue or send provider email. Run:

```bash
npm run test -w @email-cms/backend -- tests/unit/runtime-adapters.test.ts
```

Coverage includes inactive imports, root/404/CORS/auth-denial parity, bind-error cleanup, concurrent stop calls, disconnected-client drain, requests arriving on existing sockets during shutdown, worker overlap prevention and error recovery, stop-before-start, repeated signals and cleanup failures. Existing auth, parent-readonly, delivery fixture and frontend global-logout suites verify preserved behavior. Live cross-service/browser evidence is recorded separately in the ownership review.
