## 1. Delivery Batch Foundation

- [ ] 1.1 Add persistence schema for newsletter delivery batches, batch recipients, audience metadata, resend lineage, and aggregate status fields
- [ ] 1.2 Define TypeScript domain types and service interfaces for delivery batches, audience modes, lifecycle states, and per-recipient statuses
- [ ] 1.3 Implement batch creation helpers that pin newsletter, template, and recipient snapshot inputs at preparation start

## 2. Audience Resolution And Publish Flow

- [ ] 2.1 Implement local audience resolution for default send-to-all, selected classes, selected families, and one family using CMS source-of-truth data
- [ ] 2.2 Extend admin publish validation and confirmation flow to show the resolved audience summary and allow optional audience overrides before publish
- [ ] 2.3 Update newsletter publish orchestration so a successful publish creates a delivery batch and preserves existing public-route behavior

## 3. Preparation And Send Orchestration

- [ ] 3.1 Integrate delivery batches with subscriber sync, personalized rendering, and template-pinned content preparation inputs
- [ ] 3.2 Implement per-recipient preparation and send state tracking so invalid recipients fail independently from valid recipients
- [ ] 3.3 Implement automatic provider handoff for ready recipients in publish-triggered batches and persist aggregate success/failure counts

## 4. Resend And Operator Visibility

- [ ] 4.1 Implement resend batch creation from a prior batch with parent-batch linkage and current recipient validity re-checks
- [ ] 4.2 Support resend narrowing by classes, families, or one family against the prior valid-recipient candidate set
- [ ] 4.3 Expose batch and recipient delivery outcomes in admin workflows, including partial failures and resend history

## 5. Verification And Documentation

- [ ] 5.1 Add unit and integration tests for audience resolution, publish-triggered batch creation, partial-success behavior, and resend eligibility filtering
- [ ] 5.2 Document the publish/send default behavior, audience override workflow, and resend operator procedures
- [ ] 5.3 Run `npm run lint`, `npm test -- --run`, and `npm run build` and capture results in the implementation work
