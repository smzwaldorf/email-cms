## 1. Contracts And Persistence

- [x] 1.1 Add src/types/kitMergeProperties.ts and extend src/types/emailPlatform.ts, src/types/emailDelivery.ts, and src/types/emailPreparation.ts with newsletter-scoped merge property payloads, identity merge fields, provider field identifiers, payload fingerprints, sync statuses, and campaign-ready recipient state.
- [x] 1.2 Add or update Supabase migration fields for newsletter-scoped Kit merge property payloads, provider field mappings, local fingerprints, last successful sync timestamps, and provider error details to support Persist per-recipient sync fingerprints and provider field identifiers.
- [x] [P] 1.3 Extend src/services/emailPlatform/kitMapping.ts with deterministic field key generation so Store newsletter-scoped merge properties separately from stable subscriber metadata.

## 2. Merge Property Sync Service

- [x] 2.1 Create src/services/kitMergePropertySyncService.ts that consumes ready preparation outputs to Use CMS preparation output as the Kit merge property source and satisfy System SHALL synchronize eligible recipients to Kit with deterministic identity mapping.
- [x] 2.2 Implement recipient identity and stable metadata sync in src/services/kitMergePropertySyncService.ts for first name, last name, child classes, child names, parent type, and existing Kit subscriber mapping.
- [x] 2.3 Implement newsletter-scoped class article excerpt payload construction in src/services/kitMergePropertySyncService.ts to satisfy System SHALL sync newsletter-scoped class article merge properties to Kit.
- [x] 2.4 Implement payload validation for article count, excerpt length, serialized property size, and required content to Bound merge property payload size and fallback behavior and satisfy System SHALL validate Kit merge property payload limits before provider sync.
- [x] 2.5 Implement idempotent sync and drift handling in src/services/kitMergePropertySyncService.ts to satisfy System SHALL reconcile newsletter-scoped Kit merge properties.

## 3. Kit Adapter And Delivery Integration

- [x] [P] 3.1 Extend src/services/emailPlatform/kitAdapter.ts and src/services/emailPlatform/runtime.ts to create, update, and identify Kit custom fields or merge properties for newsletter-scoped payloads.
- [x] 3.2 Update src/services/newsletterDeliveryService.ts so Keep one Kit campaign with per-recipient merge properties and System SHALL support one Kit campaign with per-recipient CMS personalization by marking only fully synced recipients as campaign-ready.
- [x] 3.3 Update src/services/emailContentPreparationService.ts to expose the prepared identity fields and class article excerpt sets required by Kit merge property sync without recalculating personalization inside Kit sync.

## 4. Verification

- [x] [P] 4.1 Add tests/unit/services/kitMergePropertySyncService.test.ts for identity field sync, single-class excerpts, multi-class excerpts, payload fingerprints, unchanged-payload skip, and drift re-sync.
- [x] [P] 4.2 Update tests/unit/services/emailPlatform/kitAdapter.test.ts and tests/unit/services/emailPlatform/kitMapping.test.ts for newsletter-scoped field creation, deterministic field keys, and provider error handling.
- [x] [P] 4.3 Update tests/unit/services/newsletterDeliveryService.test.ts and tests/unit/services/personalization/emailContentPreparationService.test.ts for one-campaign audience readiness, failed property sync exclusion, oversized payload failures, and missing required excerpt failures.
- [x] 4.4 Run npm test -- tests/unit/services/kitMergePropertySyncService.test.ts tests/unit/services/emailPlatform/kitAdapter.test.ts tests/unit/services/emailPlatform/kitMapping.test.ts tests/unit/services/newsletterDeliveryService.test.ts tests/unit/services/personalization/emailContentPreparationService.test.ts --run and npm run lint, then fix failures introduced by this implementation.
