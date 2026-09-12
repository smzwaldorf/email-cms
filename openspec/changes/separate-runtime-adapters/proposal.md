## Summary

Separate CMS application construction and delivery execution from their Node process adapters.

## Motivation

HTTP import currently starts a listener and worker import starts polling; neither entry owns graceful resource cleanup. Explicit lifecycle boundaries allow other invocation adapters without changing CMS business rules.

## Proposed Solution

Expose an application handler with explicit route context. Keep Node CLI entrypoints as composition roots that load environment and start adapters. Add HTTP stop/drain and a non-overlapping worker polling adapter that drains execution before closing owned resources.

## Capabilities

### New Capabilities

- `cms-runtime-adapters`: Explicit HTTP and worker invocation lifecycle with safe Node defaults.

### Modified Capabilities

None. Existing authentication, delivery claims, retries and provider behavior are preserved.

## Impact

- Affected specs: cms-runtime-adapters
- Affected code:
  - Modified: `apps/backend/src/index.ts`, `apps/backend/src/worker/index.ts`, `apps/backend/src/routes.ts`, `README.md`
  - New: `apps/backend/src/application.ts`, `apps/backend/src/runtime/nodeHttp.ts`, `apps/backend/src/runtime/pollingWorker.ts`, `apps/backend/src/runtime/signals.ts`, `apps/backend/tests/unit/runtime-adapters.test.ts`, `specs/docs/RUNTIME_ADAPTERS.md`
