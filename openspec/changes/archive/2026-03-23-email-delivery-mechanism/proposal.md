## Why

Publishing a newsletter currently changes its visibility state, but it does not define how recipient selection, preparation, and delivery happen. The product now needs a first-class delivery mechanism so publishing can send to all eligible families by default, while still allowing targeted sends and safe resend workflows.

## What Changes

- Add a delivery-batch workflow that resolves newsletter recipients, pins send inputs, prepares personalized content, and hands ready recipients to the email provider.
- Define audience selection rules for default send-to-all behavior plus publish-time overrides for selected classes, selected families, or one specific family.
- Define resend behavior as a new delivery batch that targets previously valid recipients with current eligibility re-checks and traceable linkage to the original batch.
- Define how newsletter publishing integrates with delivery so a successful publish automatically starts preparation and send for the chosen audience.
- Surface delivery outcomes, partial failures, and validation issues so invalid recipients do not block valid sends.

## Capabilities

### New Capabilities
- `newsletter-delivery-workflow`: Delivery batches, audience resolution, publish-triggered sending, and resend behavior for newsletters.

### Modified Capabilities
- `newsletter-admin-workflow`: Publishing requirements and admin lifecycle behavior change so publish defaults to sending all eligible families unless the admin narrows the audience before confirmation.

## Impact

- Affected UI: admin newsletter publish flow, audience-selection controls, resend actions, and delivery status surfaces.
- Affected services: newsletter publish orchestration, recipient resolution, email-content preparation, personalized rendering, and Kit delivery handoff.
- Affected data/systems: delivery batch records, recipient snapshots, preparation/send status tracking, and links between original sends and resend batches.
