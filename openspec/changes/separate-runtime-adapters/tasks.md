## 1. Runtime boundaries

- [x] 1.1 Expose Application handler with explicit context and no startup side effects; verify import isolation and root/CORS/404/auth-denial parity in runtime adapter tests.
- [x] 1.2 Implement Node HTTP lifecycle with bind-error cleanup, idempotent stop and active-handler drain including disconnected clients; verify resource close ordering and failure propagation in runtime adapter tests.
- [x] 1.3 Implement Worker polling lifecycle with explicit start, no overlap, failed-run recovery and stop/drain; verify fake-executor and fake-timer tests without invoking the live queue.
- [x] 1.4 Implement Process composition and Process signals in guarded CLI entries preserving commands and closing the lazy process pool; verify import isolation, repeated-signal cleanup and shutdown failures in runtime adapter tests.

## 2. Verification and documentation

- [x] 2.1 Run runtime, auth, parent-readonly, delivery and frontend global-logout regressions; compare backend/frontend compiler diagnostics with the inherited baseline and verify no new diagnostics.
- [x] 2.2 Document adapter usage, Node dependencies, pool ownership and drain limits in README and runtime guide; validate Spectra artifacts, review changed files and report verification without committing or starting live delivery.
