# Retiring CMS identity masters

Migration: `migrations/20260918_retire_identity_masters.sql`.

Auth owns family/person/class identity and memberships. CMS retains newsletter
preferences, content, delivery snapshots, analytics, audits and identifier-only
associations. No renamed profile table replaces the removed directory masters.

## Prerequisites

- Deploy/test the Auth-backed CMS runtime before applying the migration.
- Back up the exact target database; retain it outside the application database.
- Prepare reviewed `identity_reference_mappings` using stable Auth IDs. Existing
  OIDC links and unique verified codes may establish aliases. Do not merge names
  or email addresses. Null `auth_id` means unresolved, never eligible identity.
- Reconcile every pending/opted-out family preference. The migration aborts if
  these lack an explicit Auth family mapping. Preserve unmapped subscribed
  preferences as historical rows; their status does not subscribe a new identity.
- Stop CMS writers during the backup/apply/check window.

The migration creates its two domain/reference tables if needed. To preload
mappings, create `identity_reference_mappings` with the definition in the
migration and insert reviewed `(entity_type, legacy_id, auth_id)` values. Never
copy directory names, email addresses, global roles or lifecycle into this table.

## Behavior

1. Extract every newsletter preference and assert exact field equality.
2. Preserve legacy identifiers and any preloaded Auth associations.
3. Detach foreign keys pointing at the nine retired masters, retaining all
   referencing rows/IDs. Reject unexpected cross-schema constraints.
4. Drop those tables with RESTRICT; drop their private lifecycle functions.
5. Commit as one transaction. A failure rolls back the complete migration.

No historical class/family arrays are rewritten. Runtime resolves an explicit
alias to its canonical Auth ID for current access; unresolved aliases fail closed.
Historical report membership must not be invented from today's enrollments.

## Verification

On a restored local copy, compare counts and deterministic full-row digests for
all retained tables before/after. Assert all nine masters are absent, extracted
preferences match, migration rerun is safe, and an unmapped opt-out rejects with
all masters intact. Test the fresh `schema.sql` baseline and the current `seed:demo` fixture independently. The historical SQL snapshot is retired; do not use it as an import source.
Exercise login, directory pages, class targeting, paired-family previews,
audience preparation, worker authorization, reader access and analytics against
the migrated database before declaring the application cutover complete.

`schema.sql` is the current fresh-install baseline. Do not replay older upgrade
migrations (which target historical tables) over a fresh current baseline.
`sanitize-schema.mjs` rejects dumps containing retired masters to prevent their
accidental reintroduction.

## Recovery

For a failed transaction, issue ROLLBACK and resolve the reported dependency.
For a committed migration requiring rollback, stop application writers and
restore the verified pre-migration backup into a separate database first. Verify
its contents and point the matching old runtime at it. Do not restore over newer
CMS writes; reconcile any post-migration data before switching. Do not use
DROP ... CASCADE or delete directory parent rows as a rollback mechanism.

## Local evidence (2026-09-18)

- Restored-copy migration: nine master tables absent; 33 retained table counts
  and complete row digests unchanged.
- Idempotent rerun: passed.
- Fresh schema + seed: passed without the nine master tables.
- Unmapped opt-out guard: rejected and rolled back as expected.
- Working localhost migration committed on 2026-09-18 at 01:49 UTC: all nine
  masters absent; all 33 retained table counts and full-row digests unchanged.
- Four historical newsletter preferences preserved. None has a confirmed Auth
  family mapping; current canonical families default to pending consent. Do not
  infer consent from family names or email addresses.
- Explicit historical identifier aliases loaded: three classes and two people.
- Existing additive `20260913_cms_sessions.sql` applied locally, and confidential
  CMS server login enabled at localhost:5173. Fresh installs using server login
  also require that additive migration; its two tables store encrypted session
  credentials/flows, not family or class directory masters.
- Live server login and W47 paired-family preview passed: Friend's Family gets
  five shared articles without Grade 1A/1B body or links; the entitled family gets
  both class articles, seven total. No mail sent by this verification.
- Protected backup: `/tmp/email-cms-before-final-identity-retirement-20260918.dump`.
  Detailed before/after evidence: `/tmp/cms-identity-retirement-applied.json`.
- Production was not migrated. Legacy identity CRUD implementations remain
  unreachable from the current RPC surface; obsolete fixture tests need cleanup.
