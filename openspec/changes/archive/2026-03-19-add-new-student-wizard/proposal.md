## Why

Admin users currently add students through basic forms with limited guidance, which increases input mistakes and incomplete setup. A step-by-step wizard will make student onboarding more reliable and faster, especially when family/class assignments are needed at creation time.

## What Changes

- Add a multi-step "Add New Student" wizard in admin flows.
- Validate required fields per step before allowing navigation to the next step.
- Support optional setup steps for linking the student to a family and assigning class enrollment during creation.
- Add confirmation and success feedback with clear error handling for failed writes.
- Preserve backward compatibility by keeping existing student APIs usable outside the wizard.

## Capabilities

### New Capabilities
- `student-onboarding-wizard`: Defines wizard-driven student creation behavior, step validation, optional association setup, and completion/error states.

### Modified Capabilities
- `family-management-workflow`: Extend family association requirements to include student linking behavior initiated by wizard completion.

## Impact

- Affected code: `src/pages/StudentManagementPage.tsx`, admin student components, shared form validation utilities, `src/services/adminService.ts`.
- Affected APIs/services: student create flow, family enrollment link flow, student class enrollment flow.
- Tests: new integration tests for wizard step navigation and submit outcomes; service tests for combined create/link behavior.
- UX: introduces guided onboarding path while preserving existing list/edit/delete management screens.
