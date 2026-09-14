# Historical CMS content import — completed September 12, 2026

Production import completed September 12, 2026 after explicit user authorization. The verified result is recorded in `production-result.json`; the preparation and recovery procedure below is retained for audit. Do not rerun this snapshot migration.

All preparation sections below describe the pre-import plan and are superseded by the final Production completion section. Statements about pending authorization or a missing wrapper are historical, not outstanding work. This directory is separate from the active additive schema migrations in `db/migrations/`.

## Source and destination

Selected source: `db/seed-data.sql`, the checked-in snapshot confirmed by the user for this preparation. The file was present before this deployment; do not assume it contains the latest production content. `source-inventory.json` records its SHA-256, columns, row counts and proposed handling without including row values.

Destination: existing PlanetScale logical database `smz-cms`, on the current shared cluster through CMS Hyperdrive `686ed1534b77435eb5537fabba62e61c`. No additional paid cluster is needed. The 42-table destination schema is already initialized. Successful login has created an application-local user and OIDC identity link, so the destination must not be treated as empty.

The snapshot has 41 table blocks and 125 rows, including 5 newsletters, 10 articles, 17 newsletter/article links, 6 local users, 6 classes, 3 families, 5 students, and one email template with one revision. It has no `user_auth_identities` block. It contains 41 `DISABLE TRIGGER ALL` statements, which must not be executed on production.

## Proposed import contract

- Import approved content and domain records while preserving their IDs wherever possible: newsletters, articles, categories/tags and assignments, classes, families, students and relationships, templates/revisions, and media metadata.
- Reconcile `user_roles` as application-local references only. Match existing destination records by exact normalized email, reject ambiguous matches, and record a source-to-target ID map. Preserve the existing verified OIDC issuer/subject link and its target user. Rewrite every dependent user foreign key through the map. Importing legacy user rows must not grant school-directory roles or application admission in SMZ Auth.
- Keep SMZ Auth authoritative for access, roles and class scopes. Imported CMS class/family records alone do not enroll people in the Auth directory; shared IDs and any separate directory migration must be reconciled before claiming parent/teacher access is ready.
- Exclude authentication events, identity links, legacy role assignments, tracking tokens, queued delivery records, provider sync jobs, webhook records and subscriber mappings from this first import. Keep those rows in the original archived source for a separate history/provider decision.
- Archive historical audit and analytics rows with the original source initially. Do not duplicate them as live migration events. Let current database triggers record actual imported changes.
- Keep delivery disabled throughout. Database media rows do not migrate image/file bytes; verify referenced object URLs and transfer assets separately if needed.

## Implemented and rehearsed

`db/migration/import.mjs` implements the fixed-snapshot importer; `scripts/migrate-data.mjs` is its guarded command-line entry point. A dedicated PostgreSQL 17 rehearsal passed with active foreign keys and audit triggers. It imported 68 rows into 21 selected tables while reusing one simulated pre-existing local user. It preserved that user's OIDC link, kept all local legacy roles at `student`, excluded delivery/sync work, rejected altered source bytes and a stale destination manifest, and refused repeat execution. Both default rollback and an injected halfway failure left the fixture unchanged. See `rehearsal-result.json` for exact counts.

The importer resolves the template/revision cycle in two stages and records inserted primary keys, source-to-target user ID mappings, table checksums and the source hash in the transaction's migration ledger. A commit requires a matching destination dry-run report plus a backup reference. The backup reference is an operator attestation, not an automated backup verification. The production destination has not been rehearsed or modified by these commands; its actual user mapping and manifest must still be reviewed.

## Rehearsal and execution sequence

1. Confirm the authoritative source: this checked-in snapshot, the current local PostgreSQL database, or another existing deployment. Produce a fresh transaction-consistent export when needed and rerun inventory.
2. Take a recoverable backup of the destination and record a live schema fingerprint, table counts and existing identity links. Establish a brief CMS content-write pause for final preflight and import.
3. Load a destination copy into disposable PostgreSQL 17. Parse the source COPY blocks as data; never run arbitrary statements from the dump. Produce a reviewed manifest of included rows, exclusions, user-ID mappings and any content/key conflicts.
4. Read the destination foreign-key graph and order inserts accordingly, including template/revision cycles and self-references. Keep constraints and audit triggers enabled. Resolve cycles explicitly with valid staged inserts/updates; do not disable triggers or assume all constraints are deferrable.
5. Import with parameterized statements inside a transaction with bounded timeouts and a migration advisory lock. Verify the actual database name is `smz-cms`. Abort on unexpected existing rows, duplicate natural keys, ambiguous user matches, broken references, source hash changes or destination drift. No blanket upserts or destructive resets.
6. Verify selected-table counts, canonical per-row checksums, foreign-key integrity, user-reference mappings and unchanged OIDC links before committing. Record the source hash, manifest hash, inserted IDs, counts and completion in a migration ledger committed in the same transaction. A completed migration ID must reject a second import.
7. Rehearse rollback and repeat execution refusal locally. After review of the rehearsal and explicit authorization to import, run the same manifest through the verified CMS Hyperdrive connection. This preparation request does not execute that step.
8. Verify in the live CMS: admin newsletter and article reads, template rendering, media URLs, and scoped access for existing authorized parent/teacher identities. Do not send email as a migration smoke test.

## Recovery

Any failure before transaction commit rolls back the import. After commit, avoid blind deletes: new records may already have edits or references. Keep writes paused, compare the migration ledger and recorded checksums, then either reverse only unchanged migration-owned rows in dependency order or restore the rehearsed destination backup. Preserve verified Auth links and record the recovery action.

## Available command

```sh
node scripts/prepare-data-migration.mjs db/seed-data.sql db/migration/source-inventory.json --confirmed-source
# Or inventory a freshly exported COPY-format dump into a separate metadata report:
node scripts/prepare-data-migration.mjs /path/to/export.sql /path/to/report.json
```

The command only reads a local snapshot and writes a metadata report. It does not connect to a database, reveal row contents, import records, send email or change roles. The importer and disposable rehearsal are implemented. Production backup verification, a dry run against the actual destination, media checks and final import authorization remain before execution.

With a secure connection supplied through `CMS_MIGRATION_DATABASE_URL` (never a command-line credential):

```sh
node scripts/migrate-data.mjs --mode dry-run --report /private/tmp/cms-production-dry-run.json
# Only after reviewing that report, validating the backup and authorizing production import:
node scripts/migrate-data.mjs --mode commit --approved /private/tmp/cms-production-dry-run.json --backup-reference VERIFIED_BACKUP_REFERENCE --report /private/tmp/cms-production-import.json
```

Both modes require actual database name `smz-cms`; remote URLs must use verified TLS. The deployment's former invalid GitHub database secret must not be reused. This CLI requires a valid direct connection; the portable `importSnapshot` operation can also run with a client obtained from the existing Hyperdrive binding, but a production Hyperdrive execution wrapper is not part of this preparation. Do not recreate a paid cluster or reset credentials just to run a rehearsal.

## Production completion — September 12, 2026

The production backup was restored into a disposable PostgreSQL 17 database and verified against all 42 table checksums, column definitions and constraints. The live production dry run then passed and rolled back. The approved import committed 68 selected rows, reused the existing CMS user and preserved its OIDC link. Ten article audit records were generated by enabled triggers, and one migration ledger record was committed. An independent read confirmed the table counts, excluded tables and login link. Dia then showed 5 newsletters and 10 articles under the existing admin login.

The database's 25-connection limit exposed competing Hyperdrive pool allocations during verification. The CMS origin connection limit was reduced to 5 and Auth's to 10, leaving headroom on the same paid cluster. Query caching remains disabled. No new cluster or plan upgrade was made, and delivery remains disabled.

Private backup, schema, restore verification, live dry-run manifest, commit manifest and post-import capture are under `.wrangler/migration-production-20260912/`. Those files are ignored by Git and restricted to the local user. `backup-verification.json` records the backup and schema hashes. The committed migration ledger also records the backup reference, inserted primary keys and user-ID mapping.

The production wrapper is `scripts/cloudflare-data-migration.mjs`; it uses the existing CMS Hyperdrive through a short-lived authenticated remote preview. It accepts fixed backup/dry-run/commit/verify operations, sends no user-supplied SQL and removes the preview after completion. A commit is never automatically retried. The operation result must be checked in the migration ledger if its response is lost.
