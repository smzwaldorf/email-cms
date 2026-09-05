## Context
This branch starts at b9689c7, preserving the backend-owned reader API. The saved checkout and its uncommitted Resend proposal remain untouched. Existing advanced-permission-management is a separate planning scope; central directory facts must no longer be edited as CMS admission rules.

## Goals / Non-Goals
Goals: central admission and live roles, fail-closed API actions, retained local identity/data links, class visibility, guarded publishing and mocked pipeline verification.
Non-goals: deployment, real delivery, new provider, broad analytics/bulk policy product work.

## Decisions
- Public OIDC client email-cms uses http://localhost:5174/auth/callback and logout http://localhost:5174/login; issuer http://localhost:3000/api/auth; canonical resource http://localhost:3000/api/directory/v1. Preserve examples on 5173/4000. Registration is an explicit optional auth seed overlay.
- Validate access-context and UserInfo on every authenticated request. Bind sub and clientId. Preserve 401 invalid, 403 revoked and 503 unavailable; never fall back to local roles. SMZ owns verified email/adult/approval policy.
- Keep issuer+sub links first. Bootstrap existing local data association only with an unambiguous verified email. An admitted new identity receives a local user anchor, not a CMS-specific admission gate. Conflicting links fail closed. Local legacy role columns remain for data compatibility and never grant request privileges.
- Use SMZ classScopes.parent/teacher codes and map them to local classes.class_code. No fallback to local memberships and no matching by display name. Unknown codes grant no access. CMS family/enrollment history remains business data for recipient preparation, not login/reader authorization.
- Explicit action allowlist: admin owns composition, publish, delivery and CMS configuration; teacher can edit content within assigned class scope; parent/student read published content in allowed scope. Mixed roles union read scope while parent scope never grants writes. Unknown actions deny even admins.
- Lock down generic query and RPC entry points. No external worker/provider send or local role/relationship mutation via RPC. Existing data service helpers may remain internal. Server validates teacher article ID, editable fields and class scope; client cannot supply the acting identity.
- Dashboard publish enters existing readiness/audience confirmation. Provider handoff stays worker-owned with ready recipients and durable jobs/batches; callbacks retain verification and tracking correlation.

## Risks / Trade-offs
Directory outages stop protected actions; report 503 so the user can retry. Local association conflicts require reviewed linking. Class code reconciliation is an explicit rollout prerequisite. Legacy generic client data access needs targeted checks after restriction. No database seed/reset is run.

## Migration Plan
Validate artifacts; implement auth/permission boundary; test denied gateways and scoped edits; verify existing mocked preparation/worker/provider/callback/deep-link tests; document optional registration and remaining integration prerequisites. No destructive data migration.
