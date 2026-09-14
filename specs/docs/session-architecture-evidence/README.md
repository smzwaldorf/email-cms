# Historical session architecture evidence

These files preserve the pre-implementation audit of the legacy browser token manager. Expected failures in `test-results.txt` describe that earlier implementation; they are not failures of the current production backend-session mode.

The `.test.ts.txt` file is intentionally not an executable regression test. Do not add this folder to CI test discovery. Current regression tests live under `apps/backend/tests` and `apps/frontend/tests`; see [session verification](../SESSION-VERIFICATION.md).
