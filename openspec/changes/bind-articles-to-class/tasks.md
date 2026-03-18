## 1. Data model and service contracts

- [ ] 1.1 Add article targeting fields to newsletter-article association models (`shared` vs `targeted` + class IDs) with backward-compatible defaults for existing records.
- [ ] 1.2 Update admin service APIs for article composition so create/update operations persist class targeting metadata and validate class IDs.
- [ ] 1.3 Update personalized selection services to filter targeted articles by guardian class eligibility while preserving newsletter-relative order.

## 2. Admin authoring workflow updates

- [ ] 2.1 Add class targeting controls to newsletter composition and article edit flows, including clear shared/targeted mode selection.
- [ ] 2.2 Implement save-time validation and error UX for invalid or empty targeted class selections.
- [ ] 2.3 Ensure composition/edit navigation keeps newsletter context after targeting updates and article edits.

## 3. Test coverage and regression safety

- [ ] 3.1 Add service tests for class-binding persistence, validation failures, and eligibility filtering behavior.
- [ ] 3.2 Add integration tests for admin composition flows that configure class targeting on articles and verify round-trip persistence.
- [ ] 3.3 Add personalization/integration tests that confirm shared inclusion, targeted exclusion on non-match, and order preservation after filtering.
