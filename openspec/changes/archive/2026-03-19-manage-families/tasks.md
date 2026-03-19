## 1. Family model and service foundations

- [x] 1.1 Add family lifecycle fields and guardian contact constraints with backward-compatible defaults.
- [x] 1.2 Implement family service APIs for create, update, activate, deactivate, and status-filtered listing.
- [x] 1.3 Centralize family validation (required fields, uniqueness, integrity checks) for all write paths.

## 2. Family-child association management

- [x] 2.1 Implement APIs to add/remove child associations for families with referential integrity enforcement.
- [x] 2.2 Build admin UI flows for viewing and editing family-child links in family detail screens.
- [x] 2.3 Add safeguards and UX messaging for invalid associations and deactivation side effects.

## 3. Downstream integration and verification

- [x] 3.1 Update recipient resolution workflows to consume active families by default while supporting include-inactive maintenance views.
- [x] 3.2 Add audit metadata capture for family lifecycle transitions and association updates.
- [x] 3.3 Add service/integration tests covering CRUD, uniqueness conflicts, association integrity, lifecycle transitions, and filtered listings.

## 4. Students and Parents

- [x] Manage Parents
- [x] Manage Students