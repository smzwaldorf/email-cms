## Why

Kit campaigns should be sent as one newsletter campaign covering all eligible recipients, while still personalizing each recipient with CMS-selected content such as first name, last name, and class-dependent article excerpt sets. The existing Kit contact sync handles stable subscriber identity and household metadata, but it needs an explicit newsletter-scoped merge property sync for longer per-recipient CMS content.

## What Changes

- Extend Kit recipient sync so newsletter delivery uses one Kit campaign audience while each recipient receives individualized merge properties.
- Sync eligible newsletter recipients to Kit from ready CMS preparation outputs.
- Sync recipient identity properties such as first name and last name alongside newsletter-scoped content properties.
- Sync class-dependent article excerpt sets from the CMS into deterministic Kit custom fields or merge properties before campaign send.
- Persist property payload fingerprints, provider field identifiers, and per-recipient sync status so failures block only affected recipients before send.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `kit-contact-sync`: Add newsletter-scoped recipient merge property synchronization for class-dependent article excerpts and one-campaign personalized newsletter sends.

## Impact

- Affected specs: kit-contact-sync; related existing specs include personalized-email-workflow, email-content-preparation, newsletter-delivery-workflow, kit-webhook-reconciliation, and kit-send-email-workflow.
- Affected code:
  - New: src/services/kitMergePropertySyncService.ts, src/types/kitMergeProperties.ts, tests/unit/services/kitMergePropertySyncService.test.ts
  - Modified: src/services/emailPlatform/kitAdapter.ts, src/services/emailPlatform/kitMapping.ts, src/services/emailPlatform/runtime.ts, src/services/newsletterDeliveryService.ts, src/services/emailContentPreparationService.ts, src/types/emailPlatform.ts, src/types/emailDelivery.ts, src/types/emailPreparation.ts, src/types/database.ts, supabase/migrations/20260322000000_add_newsletter_delivery_batches.sql
  - Removed: (none)
- Affected systems: CMS preparation outputs, Kit subscriber records, Kit custom fields or merge properties, newsletter delivery batches, provider reconciliation, and one-campaign Kit sends.
