## Why
CMS already delegates OIDC but still derives privileges from local roles, exposes an unauthenticated database gateway, and lets generic RPC invoke internal delivery methods. These paths defeat central revocation and server action authorization.

## What Changes
- Consume live SMZ admission, roles and class codes with stable issuer/subject links; provision only a local data anchor for admitted identities.
- Centralize explicit CMS action permissions, preserve multi-role read union and teacher-only write scope, and deny unknown actions.
- Restrict database/RPC gateways; provide protected teacher article editing and consistent UI permissions.
- Route dashboard publish through existing readiness/audience confirmation and durable delivery workflow; retain Kit.

## Capabilities
### New Capabilities
- `cms-auth-boundary`: Central authentication and CMS authorization contract with guarded content and delivery operations.
### Modified Capabilities
- None.

## Impact
Backend auth/routes/reader, shared permission rules, frontend auth/edit/publish controls, regression tests and integration documentation. No production writes, real sends, provider replacement or destructive migration.
