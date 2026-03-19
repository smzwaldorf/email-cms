## 1. Wizard UI foundation

- [x] 1.1 Add a multi-step wizard container and step state model to `StudentManagementPage`.
- [x] 1.2 Implement details step fields and per-step validation blocking forward navigation.
- [x] 1.3 Implement review/success states and clear cancel/back navigation behavior.

## 2. Optional association steps

- [x] 2.1 Add optional family-selection step scoped to active families.
- [x] 2.2 Add optional class-assignment step for initial enrollment setup.
- [x] 2.3 Ensure step skipping is supported without breaking final submission.

## 3. Service orchestration and error handling

- [x] 3.1 Orchestrate submit flow using existing APIs: create student, optional family link, optional class enrollment.
- [x] 3.2 Add partial-failure handling that reports per-operation status and retry guidance.
- [x] 3.3 Extend family-link path coverage for wizard-initiated associations.

## 4. Verification

- [x] 4.1 Add integration tests for wizard step validation, skip path, and successful completion.
- [x] 4.2 Add tests for partial-failure outcomes (student created, optional association fails).
- [x] 4.3 Run targeted test suites and update docs/UI copy where needed for admin onboarding guidance.
