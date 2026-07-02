## Context

The current Kit sync capability maps eligible guardians to Kit subscribers and synchronizes stable household metadata such as class tags, child names, child classes, and parent type. The upcoming newsletter send flow needs a second layer: newsletter-scoped merge properties that carry each recipient's CMS-prepared article excerpt set into Kit so a single campaign can address all recipients while rendering different content per subscriber.

The CMS remains the source of truth for eligibility, class membership, article selection, excerpt text, ordering, and readiness. Kit receives a bounded, deterministic merge payload per subscriber before the campaign is sent.

## Goals / Non-Goals

**Goals:**

- Sync ready newsletter recipients to Kit as campaign audience members.
- Sync identity merge properties such as first name and last name for every ready recipient.
- Sync newsletter-scoped class article excerpt sets that can differ for every recipient.
- Support one Kit campaign for the newsletter while enabling per-recipient customization from Kit subscriber properties.
- Persist payload fingerprints, field mappings, and per-recipient sync outcomes for retries and reconciliation.

**Non-Goals:**

- Do not move article selection, excerpt generation, or class membership resolution into Kit.
- Do not create one Kit campaign per class, family, or recipient.
- Do not define the final Kit send API call in this change; provider send behavior belongs to the send email workflow.
- Do not implement click tracking or article view analytics in this change.

## Decisions

### Use CMS preparation output as the Kit merge property source

The Kit sync job consumes only recipients marked ready by email content preparation. Each recipient payload includes identity fields, stable recipient identifiers, and the CMS-prepared class article excerpt sets required by the campaign template.

Alternative considered: derive Kit merge properties directly from family, class, and article tables during sync. That would duplicate personalization rules and risk sending content that differs from the prepared CMS preview.

### Store newsletter-scoped merge properties separately from stable subscriber metadata

Stable subscriber metadata such as child names and parent type remains on the existing Kit contact mapping. Newsletter-scoped properties use campaign or delivery-batch namespaced keys, such as newsletter_2026_04_class_articles, so a later newsletter does not overwrite the reconciliation history for an earlier send.

Alternative considered: reuse one generic class_articles property for every newsletter. That is simpler but makes retries and reconciliation ambiguous when multiple sends are in progress or recently completed.

### Keep one Kit campaign with per-recipient merge properties

The delivery flow creates one Kit campaign audience for all ready recipients and updates subscriber merge properties before send. The campaign template references common merge property names so Kit personalizes each email from subscriber-level values.

Alternative considered: split into multiple campaigns by class or content variant. That increases operational overhead and breaks the goal of one newsletter campaign covering all recipients.

### Bound merge property payload size and fallback behavior

The sync service enforces configured limits for article count, excerpt length, and serialized property size before writing to Kit. A recipient whose required content exceeds the limit is marked not sync-ready with an explicit failure instead of silently truncating required article content.

Alternative considered: truncate content automatically during Kit sync. That could send incomplete CMS-approved excerpts without making the change visible to admins.

### Persist per-recipient sync fingerprints and provider field identifiers

Each recipient merge property payload stores a local fingerprint, Kit subscriber identifier, Kit field identifiers, last sync status, and provider error details. Re-runs skip unchanged successful payloads and retry failed or drifted payloads.

Alternative considered: rely on Kit current state as the only source of sync status. That makes local retries and admin troubleshooting dependent on provider availability.

## Risks / Trade-offs

- [Risk] Kit custom field limits can reject long article excerpt sets. Mitigation: validate property size before provider calls and mark only affected recipients as not sync-ready.
- [Risk] Newsletter-scoped field names can grow over time. Mitigation: namespace fields predictably by campaign or delivery batch and persist mappings for reconciliation and cleanup decisions.
- [Risk] A recipient's class content can change after preparation. Mitigation: sync from pinned preparation output and require a new preparation run for changed content.
- [Risk] One campaign depends on every ready recipient's properties being synced before send. Mitigation: gate send readiness per recipient and allow the campaign audience to include only successfully synced recipients.

## Migration Plan

1. Add types and persistence for newsletter-scoped Kit merge property payloads, field mappings, fingerprints, and per-recipient statuses.
2. Implement a Kit merge property sync service that consumes ready preparation outputs.
3. Extend the Kit adapter and mapping utilities to create, update, and identify required custom fields or merge properties.
4. Wire newsletter delivery readiness so only successfully synced recipients advance to the Kit campaign send path.
5. Add tests for identity sync, class-dependent article excerpts, one-campaign audience behavior, payload limit failures, idempotent retries, and drift reconciliation.
6. Roll back by disabling newsletter-scoped merge property sync while keeping existing stable Kit contact sync behavior unchanged.

## Open Questions

- No blocking open questions. Implementation can choose the exact Kit field key format as long as it is deterministic, namespaced, persisted, and covered by tests.
